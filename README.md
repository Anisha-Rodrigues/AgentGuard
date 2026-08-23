# AgentGuard — Pay-Per-Verification Marketplace for AI Agents

> **Decentralized Machine-to-Machine (M2M) Pre-Execution Guard on Algorand Testnet**  
> **GoPlausible x402 Facilitator** · **Groq Llama 3.3 LLM Reasoning** · **Bayesian Calibration Engine**  
> 🌐 **Live Web Application**: [https://agent-guard-seven.vercel.app](https://agent-guard-seven.vercel.app)  
> ⚡ **Live Backend API**: [https://agentguard-3vpj.onrender.com](https://agentguard-3vpj.onrender.com)  
> 📦 **GitHub Repository**: [https://github.com/Anisha-Rodrigues/AgentGuard](https://github.com/Anisha-Rodrigues/AgentGuard)  
> 🔍 **Algorand Lora Testnet Explorer**: [https://lora.algokit.io/testnet](https://lora.algokit.io/testnet)

---

## 🎯 The Core Problem & Solution

### The Problem: Single-Agent Overconfidence
When an autonomous AI agent is given spending power (e.g. buying an item, executing a financial settlement, or signing an agreement), it often suffers from **hallucination, incomplete context, or adversarial seller manipulation** (inflated pricing, scam domains, hidden hostile clauses). Relying on a single LLM to make irreversible financial commitments is hazardous.

### The Solution: AgentGuard M2M Verification Marketplace
**AgentGuard** creates a decentralized pay-per-verification marketplace where an AI Shopping Agent automatically consults **three specialized, independent AI verifier agents** before executing any high-stakes purchase:
1. **💰 Price Anomaly Verifier (`/verify/price-check`)**: Detects scalping, price gouging, or suspiciously cheap counterfeit pricing.
2. **🔍 Scam & Seller Reputation Verifier (`/verify/scam-check`)**: Inspects domain age, seller review patterns, and authenticity risks.
3. **📄 Terms & Legal Clause Verifier (`/verify/terms-check`)**: Flags hidden predatory terms, *"no-return / as-is"* traps, or void warranties.

---

## 🤖 Why Machine-to-Machine (M2M) Agentic Commerce Matters

In traditional Web3 applications, a human clicks a button and manually approves popups in Metamask or Pera Wallet. **In autonomous AI agent systems, this human bottleneck breaks autonomy.**

AgentGuard is designed for **True Machine-to-Machine (M2M) Commerce**:
- The Primary AI Agent has its own **programmatic agent keypair / autonomous wallet**.
- When accessing verifier APIs, the verifiers issue standard **HTTP 402 Payment Required (x402)** challenges.
- The Shopping Agent programmatically bundles micro-settlements (0.001 ALGO each) into a **Single Atomic Algorand Transaction Group** (`algosdk.assignGroupID([tx1, tx2, tx3])`).
- The payment settles in under 0.5s on Algorand Testnet with zero human intervention.
- *(Optional)* For presentations and human-in-the-loop governance, users can also connect **Pera Mobile Wallet** via QR code scanning.

---

## 🏛️ On-Chain Architecture & Contract / Account IDs

| Component | Entity / Address | Network / Endpoint | Purpose |
| :--- | :--- | :--- | :--- |
| **Network** | `Algorand Testnet` | `genesisID: testnet-v1.0` | Layer-1 Blockchain Settlement |
| **Testnet Node** | Algonode API | `https://testnet-api.algonode.cloud` | Transaction parameters & broadcast |
| **x402 Facilitator** | GoPlausible Facilitator | `https://facilitator.goplausible.xyz` | HTTP 402 Facilitation & settlement |
| **Price Verifier Account** | `LZCSM6UXZF3S5AX5M4GDKQLVGQAX3C5MHAP2EUY7JFFJ5F4VJ6YLJQUBS4` | Algorand Testnet Account | Receives 0.001 ALGO per price check |
| **Scam Verifier Account** | `WVYI7GC4SA27G577APCNH775Q4GVFNGIIHKAD723UOCF5XMXW5Y45JHZCY` | Algorand Testnet Account | Receives 0.001 ALGO per seller check |
| **Terms Verifier Account** | `IZZC2DV5T2XY6MOG2SF4BGSX2PA5DYGXN7ADBVYLZVD5LH4WHDDPQJF6LI` | Algorand Testnet Account | Receives 0.001 ALGO per terms check |
| **Atomic Grouping** | `algosdk.assignGroupID([tx1, tx2, tx3])` | Lora Explorer Verified | Enforces all-or-nothing 3x settlement |

---

## 🏆 Hackathon Judges' Evaluation Criteria Compliance

| Judge Criteria | AgentGuard Implementation | Evidence / File Location |
| :--- | :--- | :--- |
| **1. Live x402 Payment Flow on Algorand** | Real HTTP 402 Payment Required middleware checking Testnet transactions | [`server/src/x402/facilitator.ts`](file:///server/src/x402/facilitator.ts) |
| **2. GoPlausible Facilitator** | Configured with `https://facilitator.goplausible.xyz` in request headers | [`server/server.js`](file:///server/server.js) & [`services/algorand.ts`](file:///client/src/services/algorand.ts) |
| **3. `@x402` AVM Dependencies in package.json** | Includes `@x402/core`, `@x402/express`, `@x402/avm`, `@x402/fetch`, `@x402-avm/*` | [`server/package.json`](file:///server/package.json), [`client/package.json`](file:///client/package.json) |
| **4. Verifiable on Lora Testnet Explorer** | Clickable Lora Group & Transaction URLs generated for every execution | [https://lora.algokit.io/testnet](https://lora.algokit.io/testnet) |
| **5. Meaningful & Non-Trivial Use Case** | Solves Multi-Agent consensus, Bayesian confidence weighting & autonomous trade defense | [`calibration/engine.ts`](file:///server/src/calibration/engine.ts) |

---

## 🔬 System Workflow & Architecture Diagram

```
                 [ Autonomous Primary AI Shopping Agent ]
                                     │
                   (Discovers high-value item scenario)
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
    [ 🤖 M2M Autonomous Mode ]               [ 📱 Pera Mobile Wallet ]
    Programmatic Agent Keypair               Mobile QR Code Signing
                 │                                       │
                 └───────────────────┬───────────────────┘
                                     │
         1. Create 3x 0.001 ALGO Transactions (Price, Scam, Terms)
         2. Assign Atomic Group ID (algosdk.assignGroupID)
         3. Broadcast to Algorand Testnet Node
         4. Verify on-chain via Lora Explorer (https://lora.algokit.io/testnet)
                                     │
         5. Query x402 Verifier Endpoints with GoPlausible Facilitator:
            ├── POST /verify/price-check  ──► Groq Llama 3.3 Reasoning
            ├── POST /verify/scam-check   ──► Groq Llama 3.3 Reasoning
            └── POST /verify/terms-check  ──► Groq Llama 3.3 Reasoning
                                     │
         6. Bayesian Calibration & Synthesizer Engine:
            ├── Combined Confidence = Σ(w_i · c_i) / Σ(w_i)
            ├── Check Disagreement Policy (Split verdicts halt purchase)
            └── Safety Threshold Evaluation (≥ 70% required)
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
      [ ✅ AI AGENT: APPROVED ]               [ 🚨 AI AGENT: HALTED ]
      Confidence ≥ 70% & Safe               Confidence < 70% or Disagreement
```

---

## 🛍️ Interactive Product Scenarios Catalog

| Product | Risky Scenario Trigger | Safe Scenario Trigger | Expected Decision |
| :--- | :--- | :--- | :---: |
| 📱 **Apple iPhone 15 Pro 128GB** | Price gouged at $1,800 (+63% inflation) | Normal retail at $999 | 🚨 HALTED vs ✅ APPROVED |
| 💻 **MacBook Pro 14" M3 Pro** | Scalped at $3,500 (+75% markup) | Partner certified at $1,999 | 🚨 HALTED vs ✅ APPROVED |
| ⌚ **Rolex Submariner Date** | Listed at $89 (-99% fake clone) | Authenticated at $9,500 | 🚨 HALTED vs ✅ APPROVED |
| 🎮 **Sony PlayStation 5** | Scalper bot price $950 (+90%) | Official retail $499 | 🚨 HALTED vs ✅ APPROVED |
| 🎧 **Apple AirPods Pro 2** | Knockoff $49 (-80% counterfeit) | Genuine $249 | 🚨 HALTED vs ✅ APPROVED |
| 🖥️ **NVIDIA RTX 4090 24GB** | Burned mining GPU at $2,900 | Factory sealed at $1,599 | 🚨 HALTED vs ✅ APPROVED |

---

## 🚀 Local Development Setup

### 1. Clone & Set Workspace
```bash
git clone https://github.com/Anisha-Rodrigues/AgentGuard.git
cd AgentGuard
```

### 2. Configure Environment
Create `server/.env`:
```env
PORT=3001
GROQ_API_KEY=your_groq_api_key_here
ALGORAND_TESTNET_NODE=https://testnet-api.algonode.cloud
GOPLAUSIBLE_FACILITATOR_URL=https://facilitator.goplausible.xyz
```

### 3. Run Server & Client
```bash
# Terminal 1: Backend
cd server
npm install
npm start

# Terminal 2: Frontend
cd client
npm install
npm run dev
```

Visit `http://localhost:5173` to test locally.
