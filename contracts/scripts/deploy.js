const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log(`\nDeploying PropertyFactory to network: ${hre.network.name}`);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH\n");

  // 1. Deploy the factory
  const Factory = await hre.ethers.getContractFactory("PropertyFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`PropertyFactory deployed to: ${factoryAddress}`);

  // 2. Self-authorize the deployer as the first operator (educational convenience).
  //    In a real system, the operator list is curated by a regulator/platform admin.
  console.log("\nAuthorizing deployer as the first operator...");
  const tx = await factory.addOperator(deployer.address);
  await tx.wait();
  console.log("Deployer is now an authorized operator");

  // 3. Copy ABIs + factory address into the frontend.
  const frontendContractsDir = path.join(
    __dirname, "..", "..", "frontend", "src", "contracts"
  );
  if (!fs.existsSync(frontendContractsDir)) {
    fs.mkdirSync(frontendContractsDir, { recursive: true });
  }

  const factoryArtifact = await hre.artifacts.readArtifact("PropertyFactory");
  const escrowArtifact  = await hre.artifacts.readArtifact("PropertyEscrow");
  const tokenArtifact   = await hre.artifacts.readArtifact("PropertyToken");

  // Factory: store both address + ABI (we know the address up front)
  fs.writeFileSync(
    path.join(frontendContractsDir, "PropertyFactory.json"),
    JSON.stringify({ address: factoryAddress, abi: factoryArtifact.abi }, null, 2)
  );
  // Escrow + Token: ABI only (addresses differ per property, resolved at runtime)
  fs.writeFileSync(
    path.join(frontendContractsDir, "PropertyEscrow.json"),
    JSON.stringify({ abi: escrowArtifact.abi }, null, 2)
  );
  fs.writeFileSync(
    path.join(frontendContractsDir, "PropertyToken.json"),
    JSON.stringify({ abi: tokenArtifact.abi }, null, 2)
  );
  console.log(`\nABIs + factory address written to ${frontendContractsDir}`);

  // 4. Etherscan verification on public networks.
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost" && hre.network.name !== "ganache") {
    console.log("\nWaiting 5 block confirmations before Etherscan verification...");
    await factory.deploymentTransaction().wait(5);
    try {
      await hre.run("verify:verify", {
        address: factoryAddress,
        constructorArguments: [],
      });
      console.log("PropertyFactory verified on Etherscan");
    } catch (err) {
      console.log("Verification failed (you can retry manually):", err.message);
    }
  }

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
