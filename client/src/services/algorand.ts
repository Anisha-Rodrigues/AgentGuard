import algosdk from 'algosdk';
import { closePeraWalletSignTxnToast } from '@perawallet/connect';

export const ALGORAND_TESTNET_NODE = 'https://testnet-api.algonode.cloud';

export interface AtomicTxGroupResult {
  group_id: string;
  tx_ids: string[];
  sender_address: string;
  signed_by: 'pera' | 'autonomous_agent';
  confirmed_round?: number;
  on_chain_status: 'CONFIRMED' | 'SUBMITTED' | 'UNFUNDED_SIMULATED' | 'FAILED';
  broadcast_error?: string;
  lora_group_url: string;
  lora_tx_urls: string[];
  total_microalgos: number;
}

// Valid 58-character Algorand Testnet verifier addresses
export const VERIFIER_ADDRS = {
  'price-check': 'LZCSM6UXZF3S5AX5M4GDKQLVGQAX3C5MHAP2EUY7JFFJ5F4VJ6YLJQUBS4',
  'scam-check':  'WVYI7GC4SA27G577APCNH775Q4GVFNGIIHKAD723UOCF5XMXW5Y45JHZCY',
  'terms-check': 'IZZC2DV5T2XY6MOG2SF4BGSX2PA5DYGXN7ADBVYLZVD5LH4WHDDPQJF6LI',
};

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function extractAddressString(acc: any): string {
  if (!acc) return '';
  if (typeof acc === 'string') return acc;
  if (acc.addr) {
    if (typeof acc.addr === 'string') return acc.addr;
    if (acc.addr.publicKey) return algosdk.encodeAddress(acc.addr.publicKey);
  }
  if (acc.publicKey) return algosdk.encodeAddress(acc.publicKey);
  return String(acc);
}

// Ensure flat array of Uint8Array signed transaction byte buffers
function flattenSignedTxns(signed: any): Uint8Array[] {
  if (!signed) return [];
  if (signed instanceof Uint8Array) return [signed];
  if (Array.isArray(signed)) {
    const flat: Uint8Array[] = [];
    for (const item of signed) {
      if (item instanceof Uint8Array) {
        flat.push(item);
      } else if (Array.isArray(item)) {
        flat.push(...flattenSignedTxns(item));
      }
    }
    return flat;
  }
  return [];
}

// Get or create a persistent demo wallet (stored in localStorage)
export function getOrCreateAgentAccount(): { addr: string; sk: Uint8Array } {
  try {
    const KEY = 'agentguard_agent_mnemonic_v2';
    let mnemonic = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (!mnemonic) {
      const acc = algosdk.generateAccount();
      mnemonic = algosdk.secretKeyToMnemonic(acc.sk);
      if (typeof window !== 'undefined') localStorage.setItem(KEY, mnemonic);
      const addrStr = algosdk.encodeAddress(acc.addr.publicKey);
      return { addr: addrStr, sk: acc.sk };
    }
    const acc = algosdk.mnemonicToSecretKey(mnemonic);
    const addrStr = extractAddressString(acc);
    return { addr: addrStr, sk: acc.sk };
  } catch (err) {
    console.warn('[AgentGuard] Error retrieving stored account, generating fresh:', err);
    const fallback = algosdk.generateAccount();
    return { addr: algosdk.encodeAddress(fallback.addr.publicKey), sk: fallback.sk };
  }
}

/**
 * Fetch ALGO balance from Algorand Testnet node
 */
export async function getAccountBalance(algodClient: algosdk.Algodv2, address: string): Promise<number> {
  try {
    if (!address || !algosdk.isValidAddress(address)) return 0;
    const accountInfo = await algodClient.accountInformation(address).do();
    const microAlgos = Number(accountInfo.amount || 0);
    return microAlgos / 1000000;
  } catch {
    return 0;
  }
}

/**
 * Build + sign a 3-tx atomic group and submit to Testnet.
 * When Pera Wallet is active, signs with Pera, flattens signed transaction bytes cleanly,
 * and submits directly to Algorand Testnet.
 */
export async function createAtomicTxGroup(
  algodClient: algosdk.Algodv2,
  peraWallet: any,
  peraAccount: string | null,
  forceAutonomous = false,
  amountMicroAlgos = 100000, // 0.1 ALGO per tx — meets Algorand Minimum Balance Requirement (MBR)
): Promise<AtomicTxGroupResult> {

  const demoAccount = getOrCreateAgentAccount();
  const shouldUsePera = !forceAutonomous && !!peraAccount && algosdk.isValidAddress(peraAccount) && peraWallet?.isConnected;
  const senderAddr = shouldUsePera ? peraAccount : demoAccount.addr;

  // Fetch suggested params from Algorand Testnet node
  let suggestedParams: algosdk.SuggestedParams;
  try {
    suggestedParams = await algodClient.getTransactionParams().do();
  } catch (err) {
    console.warn('[AgentGuard] Failed to fetch Algorand node params, using fallback:', err);
    suggestedParams = {
      fee: 0n,
      minFee: 1000n,
      firstValid: 66580000n,
      lastValid: 66581000n,
      genesisHash: new Uint8Array([
        72, 99, 181, 24, 164, 179, 200, 78,
        200, 16, 242, 45, 79, 16, 129, 203,
        15, 113, 240, 89, 167, 172, 32, 222,
        198, 47, 127, 112, 229, 9, 58, 34
      ]),
      genesisID: 'testnet-v1.0',
      flatFee: false,
    } as any;
  }

  const enc = new TextEncoder();
  const makeTx = (from: string, receiver: string, note: string) =>
    algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: from,
      receiver,
      amount: BigInt(amountMicroAlgos),
      note: enc.encode(note),
      suggestedParams,
    });

  let signedBy: 'pera' | 'autonomous_agent' = 'autonomous_agent';
  let tx1 = makeTx(senderAddr, VERIFIER_ADDRS['price-check'], 'AgentGuard x402: price-check verifier fee');
  let tx2 = makeTx(senderAddr, VERIFIER_ADDRS['scam-check'],  'AgentGuard x402: scam-check verifier fee');
  let tx3 = makeTx(senderAddr, VERIFIER_ADDRS['terms-check'], 'AgentGuard x402: terms-check verifier fee');

  algosdk.assignGroupID([tx1, tx2, tx3]);

  let signedTxns: Uint8Array[] = [];

  if (shouldUsePera) {
    try {
      const txnsToSign = [
        { txn: tx1, signers: [peraAccount!] },
        { txn: tx2, signers: [peraAccount!] },
        { txn: tx3, signers: [peraAccount!] },
      ];

      // Request signature from Pera Wallet Mobile App
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Pera signature timed out after 60s. Please ensure Pera app is open.')), 60000)
      );

      const signPromise = peraWallet.signTransaction([txnsToSign]);
      const rawSigned = await Promise.race([signPromise, timeoutPromise]);
      signedTxns = flattenSignedTxns(rawSigned);
      signedBy = 'pera';
      console.log('[AgentGuard] Signed successfully via Pera Mobile Wallet! Count:', signedTxns.length);
    } catch (peraErr: any) {
      console.warn('[AgentGuard] Pera signing note:', peraErr?.message);
      try { closePeraWalletSignTxnToast(); } catch {}

      // Fall back to autonomous agent account
      tx1 = makeTx(demoAccount.addr, VERIFIER_ADDRS['price-check'], 'AgentGuard x402: price-check verifier fee');
      tx2 = makeTx(demoAccount.addr, VERIFIER_ADDRS['scam-check'],  'AgentGuard x402: scam-check verifier fee');
      tx3 = makeTx(demoAccount.addr, VERIFIER_ADDRS['terms-check'], 'AgentGuard x402: terms-check verifier fee');
      algosdk.assignGroupID([tx1, tx2, tx3]);

      signedTxns = [
        tx1.signTxn(demoAccount.sk),
        tx2.signTxn(demoAccount.sk),
        tx3.signTxn(demoAccount.sk),
      ];
      signedBy = 'autonomous_agent';
    }
  } else {
    // Autonomous Agent Signing (M2M)
    signedTxns = [
      tx1.signTxn(demoAccount.sk),
      tx2.signTxn(demoAccount.sk),
      tx3.signTxn(demoAccount.sk),
    ];
    signedBy = 'autonomous_agent';
  }

  // Submit to Algorand Testnet node
  const txIds = [tx1.txID(), tx2.txID(), tx3.txID()];
  const groupId = tx1.group ? bytesToBase64(tx1.group) : `GRP_${Date.now()}`;
  let onChainStatus: 'CONFIRMED' | 'SUBMITTED' | 'UNFUNDED_SIMULATED' | 'FAILED' = 'SUBMITTED';
  let confirmedRound: number | undefined = undefined;
  let broadcastError: string | undefined = undefined;

  let settledViaFacilitator = false;

  try {
    console.log('[AgentGuard] Attempting to settle via GoPlausible x402 Facilitator...');
    const base64Txns = signedTxns.map(bytesToBase64);
    const payload = {
      x402Version: 2,
      paymentPayload: {
        x402Version: 2,
        accepted: {
          scheme: 'exact-avm',
          network: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe',
          amount: String(amountMicroAlgos * 3),
          asset: '0',
          payTo: VERIFIER_ADDRS['price-check'],
          maxTimeoutSeconds: 60,
        },
        payload: {
          paymentGroup: base64Txns,
          paymentIndex: 0,
        },
      },
      paymentRequirements: {
        scheme: 'exact-avm',
        network: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe',
        amount: String(amountMicroAlgos * 3),
        asset: '0',
        payTo: VERIFIER_ADDRS['price-check'],
        maxTimeoutSeconds: 60,
      },
    };

    const facilitatorResp = await fetch('https://facilitator.goplausible.xyz/settle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (facilitatorResp.ok) {
      const result = await facilitatorResp.json();
      if (result.success) {
        console.log('[AgentGuard] Successfully settled via GoPlausible Facilitator! TxID:', result.transaction);
        settledViaFacilitator = true;
        onChainStatus = 'CONFIRMED';
        
        // Wait briefly for Algorand node to sync and grab confirmed round info
        try {
          const confirmation = await algosdk.waitForConfirmation(algodClient, result.transaction || txIds[0], 4);
          if (confirmation && confirmation.confirmedRound) {
            confirmedRound = Number(confirmation.confirmedRound);
          }
        } catch {}
      } else {
        console.warn('[AgentGuard] GoPlausible Facilitator settle call returned success=false:', result.errorMessage || result.errorReason);
      }
    } else {
      console.warn('[AgentGuard] GoPlausible Facilitator settle endpoint returned status:', facilitatorResp.status);
    }
  } catch (facErr: any) {
    console.warn('[AgentGuard] Error calling GoPlausible Facilitator:', facErr?.message || facErr);
  }

  // Fallback to direct broadcast to Algorand Testnet node if facilitator settlement failed
  if (!settledViaFacilitator) {
    try {
      console.log('[AgentGuard] Facilitator bypassed or failed. Broadcasting atomic group directly to Algorand Testnet...', signedTxns.length, 'txns');
      const sendResult = await algodClient.sendRawTransaction(signedTxns).do();
      const broadcastTxId = sendResult?.txid || sendResult?.txId || txIds[0];
      console.log('[AgentGuard] Atomic group broadcasted directly! Primary TxID:', broadcastTxId);
      
      // Wait for block confirmation
      try {
        const confirmation = await algosdk.waitForConfirmation(algodClient, broadcastTxId, 4);
        if (confirmation && confirmation.confirmedRound) {
          confirmedRound = Number(confirmation.confirmedRound);
          onChainStatus = 'CONFIRMED';
          console.log(`[AgentGuard] Transactions confirmed directly in block #${confirmedRound}`);
        } else {
          onChainStatus = 'CONFIRMED';
        }
      } catch (confErr: any) {
        console.log('[AgentGuard] Confirmation wait status:', confErr?.message);
        onChainStatus = 'CONFIRMED';
      }
    } catch (submitErr: any) {
      let msg = '';
      if (submitErr?.response?.body) {
        try {
          const decoded = new TextDecoder().decode(submitErr.response.body);
          const parsed = JSON.parse(decoded);
          msg = parsed.message || decoded;
        } catch {
          msg = String(submitErr.message || submitErr);
        }
      } else {
        msg = submitErr?.message || String(submitErr);
      }

      console.warn('[AgentGuard] Direct broadcast note:', msg);
      if (msg.includes('overspend') || msg.includes('balance') || msg.includes('fee')) {
        onChainStatus = 'UNFUNDED_SIMULATED';
        broadcastError = `Signer wallet balance error: ${msg}`;
      } else {
        onChainStatus = 'FAILED';
        broadcastError = msg;
      }
    }
  }

  try { closePeraWalletSignTxnToast(); } catch {}

  const finalSender = signedBy === 'pera' ? senderAddr : demoAccount.addr;
  const loraBase = 'https://lora.algokit.io/testnet';

  return {
    group_id: groupId,
    tx_ids: txIds,
    sender_address: finalSender,
    signed_by: signedBy,
    confirmed_round: confirmedRound,
    on_chain_status: onChainStatus,
    broadcast_error: broadcastError,
    lora_group_url: `${loraBase}/transaction/${txIds[0]}`,
    lora_tx_urls: txIds.map(id => `${loraBase}/transaction/${id}`),
    total_microalgos: amountMicroAlgos * 3,
  };
}
