# EstateToken — Decentralized Real Estate Tokenization

A full-stack Ethereum dapp for fractional real estate ownership. Investors pool ETH t fund property purchases on success, each contributor receives ERC-20 tokens proportional to their stake. On failure, every investor reclaims their ETH. Inspired by Dubai's PRYPCO Mint / DLD tokenization initiative.

> **Important context:** This is an **educational implementation on Ethereum testnet**. Real-world tokenized real estate (like Dubai's PRYPCO Mint) requires SPV legal structures, KYC/AML, regulatory licensing (VARA in the UAE) and direct integration with land registries. This project demonstrates the *on-chain mechanism* that underlies such systems — not a substitute for the legal wrapper.

## Architecture at a glance

```
                    ┌─────────────────────────────┐
                    │      PropertyFactory        │
                    │ (singleton, owner = admin)  │
                    │                             │
                    │ - addOperator(addr)         │
                    │ - createProperty(...)       │
                    │ - getAllProperties()        │
                    └──────────────┬──────────────┘
                                   │ deploys (per property)
                ┌──────────────────┴──────────────────┐
                ▼                                     ▼
     ┌────────────────────┐               ┌────────────────────┐
     │  PropertyEscrow    │  ◀───mints──▶ │   PropertyToken    │
     │  - contribute()    │               │   (ERC-20)         │
     │  - finalize()      │               │   - mint()         │
     │  - claimShares()   │               │     (escrow only)  │
     │  - claimRefund()   │               │   - transfer()     │
     └────────────────────┘               │   - balanceOf()    │
                                          └────────────────────┘

User flow:
  1. Admin authorizes operators                  → factory.addOperator(op)
  2. Operator lists property                     → factory.createProperty(...)
        → deploys Escrow + Token contract pair
  3. Investors fund                              → escrow.contribute({value})
  4a. Goal met by deadline:
        Operator finalizes (gets ETH)            → escrow.finalize()
        Each investor claims tokens              → escrow.claimShares()
  4b. Goal not met by deadline:
        Each investor claims refund              → escrow.claimRefund()
```

## File structure

```
real-estate-dapp/
├── contracts/
│   ├── contracts/
│   │   ├── PropertyToken.sol      # ERC-20 fractional shares
│   │   ├── PropertyEscrow.sol     # Per-property escrow + token claims
│   │   └── PropertyFactory.sol    # Deploys + registers properties
│   ├── scripts/
│   │   ├── deploy.js              # Deploys factory, writes ABIs to frontend
│   │   └── listSampleProperty.js  # Optional: seeds one demo property
│   ├── test/
│   │   ├── PropertyToken.test.js
│   │   ├── PropertyEscrow.test.js
│   │   └── PropertyFactory.test.js   # Includes E2E integration test
│   ├── hardhat.config.js
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── PropertyList.jsx       # Home page: all properties
    │   │   ├── PropertyCard.jsx       # Reusable preview tile
    │   │   ├── PropertyDetails.jsx    # Per-property page; all interactions
    │   │   ├── CreateProperty.jsx     # Operator-only listing form + IPFS
    │   │   └── MyPortfolio.jsx        # Aggregate user holdings
    │   ├── contracts/
    │   │   ├── PropertyFactory.json   # Factory address + ABI (auto-written)
    │   │   ├── PropertyEscrow.json    # ABI only
    │   │   └── PropertyToken.json     # ABI only
    │   ├── utils/
    │   │   ├── wallet.js              # MetaMask connect, network switch
    │   │   ├── contract.js            # ethers Contract factories
    │   │   └── ipfs.js                # Pinata upload + IPFS gateway
    │   ├── App.jsx                    # Routing + wallet/operator state
    │   ├── main.jsx                   # Entry point
    │   └── index.css                  # Tailwind directives
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── .env.example
    └── .gitignore
```

## Prerequisites

- **Node.js 18+**
- **MetaMask** browser extension
- **Ganache** (optional but recommended) — https://archive.trufflesuite.com/ganache/
- **Alchemy account** (free tier) — https://dashboard.alchemy.com
- **Etherscan API key** (free) — https://etherscan.io/myapikey
- **Pinata account** (free, for IPFS metadata) — https://app.pinata.cloud
- **Sepolia ETH** from a faucet — https://sepoliafaucet.com or https://www.alchemy.com/faucets/ethereum-sepolia

---

# Part 1: Smart contracts

## 1a. Test locally with Hardhat Network

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

You should see all tests across `PropertyToken`, `PropertyEscrow`, and `PropertyFactory` (including the end-to-end integration test) pass in a few seconds.

## 1b. Deploy to local Hardhat node

In one terminal:

```bash
cd contracts
npx hardhat node      # starts a local chain on http://127.0.0.1:8545
```

In another terminal:

```bash
cd contracts
npm run deploy:local
```

Output looks like:

```
PropertyFactory deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Deployer is now an authorized operator
ABIs + factory address written to .../frontend/src/contracts
```

The deploy script auto-authorizes the deployer as the first operator so you can immediately list properties.

## 1c. Deploy to Ganache (visual blockchain)

Ganache is the best tool for *seeing* what's happening on-chain — every block, every internal transaction, every state change. With three interacting contracts (factory deploys escrow which deploys token), watching the deployment in Ganache's GUI is genuinely instructive.

1. Launch **Ganache GUI** → "Quickstart Ethereum"
2. Confirm port **7545**, copy a private key from any account
3. Add it to `contracts/.env` as `GANACHE_PRIVATE_KEY=0x...`
4. Deploy: `npm run deploy:ganache`
5. Open Ganache → **Blocks** tab. You'll see one block with the factory deployment. Click it to inspect gas used (around 2-3M gas — much higher than a single contract because PropertyFactory carries the full PropertyEscrow + PropertyToken bytecode that it uses to deploy children).
6. Now seed a property: `npm run seed:ganache`
7. Refresh Ganache → **Blocks** — you'll see *three* new transactions in one block: the `createProperty` call, the internal `new PropertyEscrow(...)` deployment, and the `new PropertyToken(...)` deployment that happens inside the escrow's constructor. This visual is the clearest way to internalize the factory pattern.
8. Add Ganache to MetaMask: Settings → Networks → Add network manually. RPC `http://127.0.0.1:7545`, Chain ID `1337`, Symbol `ETH`. Import a Ganache account using its private key.

## 1d. Deploy to Sepolia testnet via Alchemy

1. **Create Alchemy app:** https://dashboard.alchemy.com → Apps → Create new app → Ethereum / Sepolia. Copy the HTTPS URL.
2. **Throwaway deployer wallet:** Create a fresh MetaMask account, export its private key, fund it with Sepolia ETH from a faucet (~0.1 ETH is plenty).
3. **Configure `contracts/.env`:**
   ```
   ALCHEMY_SEPOLIA_URL=https://eth-sepolia.g.alchemy.com/v2/abc123...
   PRIVATE_KEY=your_private_key_without_0x_prefix
   ETHERSCAN_API_KEY=your_etherscan_key
   ```
4. **Deploy:**
   ```bash
   npm run deploy:sepolia
   ```
5. **Check Etherscan:** `https://sepolia.etherscan.io/address/0xYOUR_FACTORY_ADDRESS` — your factory is live and verified.
6. **Optional: seed a sample property:**
   ```bash
   npm run seed:sepolia
   ```
   Note: each `createProperty` call deploys two new contracts (escrow + token) — you'll see this clearly in Etherscan's "Internal Transactions" tab on the transaction.

---

# Part 2: Frontend

## 2a. Run locally

```bash
cd frontend
npm install
cp .env.example .env       # then edit .env if you have Alchemy/Pinata keys
npm run dev
```

Open http://localhost:5173. The app reads `src/contracts/PropertyFactory.json` (auto-populated by the deploy script) for the factory address.

Make sure MetaMask is on the same network you deployed to.

## 2b. Test the full lifecycle

**Happy path (goal met):**
1. Connect wallet — your deployer account should show an **Operator** badge in the navbar
2. Click **+ List Property**, fill the form (use a small goal like `0.1 ETH`, short duration like `0.001` days for testing — wait, the contract requires whole-day units. Use `1` day and fast-forward time on Ganache instead)
3. Switch to a different MetaMask account (an investor)
4. Click into the property, contribute enough ETH to meet the goal
5. Wait for the deadline (or fast-forward time on Hardhat/Ganache)
6. Switch back to the operator account — a green **Finalize & Receive Funds** button appears
7. Click it. ETH transfers to operator. The property card status changes to "Owned".
8. Switch back to investor — an amber **Claim Shares** button appears. Click it.
9. Tokens mint into your wallet. Visit **My Portfolio** to see them.
10. (Optional) Add the token to MetaMask: Assets → Import tokens → paste the token contract address shown on the property page. Your shares appear as a normal ERC-20 balance.

**Failure path (goal not met):**
Same flow but contribute less than the goal. After the deadline, an orange **Claim Refund** button appears for each contributor.

**Fast-forwarding time on Hardhat Network:**
```javascript
// In a hardhat console (npx hardhat console --network localhost)
await network.provider.send("evm_increaseTime", [86400]);  // 1 day
await network.provider.send("evm_mine");
```

## 2c. Deploy frontend to Vercel

1. **Push to GitHub:**
   ```bash
   cd real-estate-dapp
   git init && git add . && git commit -m "Initial commit"
   gh repo create real-estate-dapp --public --source=. --push
   ```
2. **Vercel:** https://vercel.com/new → import repo
   - **Root Directory:** `frontend`
   - Framework: Vite (auto-detected)
3. **Environment variables:**
   - `VITE_ALCHEMY_SEPOLIA_URL` — your Alchemy URL
   - `VITE_PINATA_JWT` — your Pinata JWT (optional but recommended for IPFS metadata)
4. Deploy. Lock down your Alchemy key by domain (Alchemy dashboard → Networks → Security → Allowlist your Vercel domain).

---

# Part 3: How the contracts work (key code paths)

## The factory pattern

`PropertyFactory.createProperty(...)` includes the line:

```solidity
PropertyEscrow escrow = new PropertyEscrow(...);
```

In Solidity, `new ContractName(...)` deploys a fresh instance of that contract from within your transaction and returns the new address. The factory uses this twice (once for the escrow, and inside the escrow's constructor for the token), so a single `createProperty` transaction deploys *three* contracts at once: the escrow itself, the token it owns, and the binding between them. This is why Etherscan shows multiple "internal transactions" for a single listing.

This is the same pattern used by Uniswap V2 (factory creates pair contracts), Gnosis Safe (factory creates safe contracts), and most other protocols that need user-specific contract instances.

## Mint authorization

When the escrow constructs its token (`new PropertyToken(_tokenName, _tokenSymbol, address(this))`), it passes its own address as the `escrow` parameter. The token's constructor stores this in an `immutable` variable, and the `mint()` function is gated by `require(msg.sender == escrow, ...)`. Result: only the specific escrow that owns this specific token can ever mint shares. No other contract — not even the factory, not even an admin — can dilute supply.

## Pull-pattern claims

`claimShares()` is called by each investor individually rather than the operator looping through all contributors and minting to each. Reasons:
- **Gas distribution:** each investor pays their own minting gas (~50K), instead of the operator paying for everyone (~50K × N investors)
- **Failure isolation:** if one investor's address is unable to receive tokens for any reason, it doesn't block everyone else
- **Re-entrancy safety:** the function zeros out `contributions[msg.sender]` *before* calling `mint()`, following the Checks-Effects-Interactions pattern

The same pattern applies to `claimRefund()` on the failure path.

## Share math

Inside `claimShares`:
```solidity
uint256 tokensToMint = contributed * TOKENS_PER_ETH;  // contributed is in wei
```

ETH has 18 decimals, ERC-20 tokens default to 18 decimals, and `TOKENS_PER_ETH = 1000`. So:
- Contribute 1 ETH (= 10^18 wei) → mint 10^18 × 1000 = 10^21 base units = 1000 whole tokens ✓
- Contribute 0.5 ETH → mint 500 whole tokens ✓

No division, no rounding, exact in all cases.

---

# Part 4: Truffle survival guide

You'll likely encounter older blockchain tutorials, GitHub repos, and StackOverflow answers using Truffle instead of Hardhat. They do the same job but with different commands. Here's a translation table so you can read Truffle code without confusion:

| Hardhat | Truffle equivalent |
|---|---|
| `npx hardhat compile` | `truffle compile` |
| `npx hardhat test` | `truffle test` |
| `npx hardhat node` | `ganache-cli` (separate tool) |
| `npx hardhat run scripts/deploy.js --network sepolia` | `truffle migrate --network sepolia` |
| `hardhat.config.js` | `truffle-config.js` |
| `scripts/` (regular .js files) | `migrations/` (numbered files like `1_deploy_contracts.js`) |
| `@nomicfoundation/hardhat-toolbox` | `truffle` (monolith) |
| `ethers.getContractFactory("X")` | `artifacts.require("X")` |
| `await contract.getAddress()` | `contract.address` |

**Key differences in spirit:**
- Truffle uses a **migrations** system: numbered files run in order and Truffle remembers which ones already ran (similar to database migrations). Hardhat's `scripts/` are just regular Node.js — you re-run them every time.
- Truffle has weaker debugging — no `console.log` inside Solidity, no detailed stack traces. This is the main reason most teams have moved to Hardhat or Foundry.
- The Truffle Suite was officially **sunset by Consensys in late 2023**. New projects should default to Hardhat.

**You can read this code in Truffle:**
```javascript
// migrations/2_deploy_factory.js
const PropertyFactory = artifacts.require("PropertyFactory");
module.exports = async function (deployer) {
  await deployer.deploy(PropertyFactory);
  const factory = await PropertyFactory.deployed();
  console.log("Deployed to:", factory.address);
};
```
The Hardhat equivalent (which we used) is what's in `scripts/deploy.js`.

---

# Part 5: Common issues

**"Not an authorized operator"** — Your wallet hasn't been added as an operator. Run from Hardhat console:
```bash
npx hardhat console --network sepolia
> const f = await ethers.getContractAt("PropertyFactory", "0xYOUR_FACTORY")
> await f.addOperator("0xWALLET_TO_AUTHORIZE")
```

**"insufficient funds for gas"** — Your deployer wallet has no Sepolia ETH. Hit a faucet.

**"nonce too high"** — MetaMask is confused after restarting Ganache. MetaMask → Settings → Advanced → Clear activity tab data.

**Frontend shows "Failed to load properties"** — Check that `frontend/src/contracts/PropertyFactory.json` has the correct address (not `0x0000...`) and that MetaMask is on the right network.

**"Properties don't appear after deploying a new factory"** — The new factory has zero properties. Run `npm run seed:sepolia` (or `:local` / `:ganache`) to add a sample, or list one through the UI.

**Token doesn't show in MetaMask** — Tokens never appear automatically. After claiming shares, MetaMask → Assets → Import tokens → paste the token contract address shown on the property detail page.

**Contract sizes too large to deploy** — If you extend the contracts and hit Ethereum's 24 KB contract size limit, enable the optimizer with higher `runs` in `hardhat.config.js`, or split logic into separate contracts.

---

# Part 6: Where to go from here

In rough order of difficulty:

- **Add Etherscan token logos** so your `BURJ-2304` shows an icon in MetaMask
- **Rental income distribution:** add a `distributeRevenue()` function to the escrow that takes incoming ETH and lets each token holder claim their proportional share (use the snapshot pattern from OpenZeppelin)
- **Secondary market:** integrate Uniswap V3 so token holders can swap their property shares for ETH directly from the dapp (this is the core of what Dubai's Phase 2 secondary market enables)
- **Chainlink price feeds:** denominate goals in USD instead of ETH so users aren't exposed to ETH price volatility during the funding window
- **Governance:** let token holders vote on property decisions (sell? renovate? change property manager?) using OpenZeppelin Governor
- **The Graph:** index `PropertyCreated` events into a GraphQL API so the frontend doesn't need to call `getAllProperties()` and then loop through each escrow
- **L2 deployment:** redeploy to Base Sepolia or Arbitrum Sepolia. The code is identical; you'll just see fees drop by 100x. This is where real activity happens.
- **KYC layer:** for a more realistic regulatory-aware version, integrate something like Quadrata or Civic to gate `contribute()` behind verified identity attestations
