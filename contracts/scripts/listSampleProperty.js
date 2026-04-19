/**
 * Seeds the deployed factory with one sample property so that the frontend
 * has something to display immediately. Run AFTER deploy.js.
 *
 *   npx hardhat run scripts/listSampleProperty.js --network sepolia
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const factoryJson = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "..", "frontend", "src", "contracts", "PropertyFactory.json"),
      "utf8"
    )
  );

  const [deployer] = await hre.ethers.getSigners();
  const factory = await hre.ethers.getContractAt(
    "PropertyFactory", factoryJson.address, deployer
  );

  // Sanity: make sure deployer is authorized
  const isOp = await factory.isOperator(deployer.address);
  if (!isOp) {
    console.log("Deployer is not an operator. Authorizing...");
    const tx = await factory.addOperator(deployer.address);
    await tx.wait();
  }

  console.log("Listing sample property...");
  const tx = await factory.createProperty(
    hre.ethers.parseEther("5"),           // 5 ETH goal (low for testnet)
    14,                                    // 14-day window
    "Dubai Marina Studio Apt 1204",        // Title
    "ipfs://QmSamplePropertyMetadataCID",  // Metadata URI
    "Dubai Marina 1204",                   // Token name
    "DM-1204"                              // Token symbol
  );
  const rc = await tx.wait();

  // Pull the PropertyCreated event
  const log = rc.logs.find((l) => {
    try { return factory.interface.parseLog(l)?.name === "PropertyCreated"; }
    catch { return false; }
  });
  const parsed = factory.interface.parseLog(log);
  console.log("\nSample property created:");
  console.log("  Escrow:", parsed.args.escrow);
  console.log("  Token: ", parsed.args.token);
  console.log("  Title: ", parsed.args.title);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
