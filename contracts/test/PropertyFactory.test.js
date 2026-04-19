const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PropertyFactory", function () {
  let factory;
  let admin, operator1, operator2, investor, stranger;

  beforeEach(async function () {
    [admin, operator1, operator2, investor, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PropertyFactory");
    factory = await Factory.connect(admin).deploy();
    await factory.waitForDeployment();
  });

  describe("Operator management", function () {
    it("deployer becomes owner", async function () {
      expect(await factory.owner()).to.equal(admin.address);
    });

    it("owner can add an operator", async function () {
      await expect(factory.connect(admin).addOperator(operator1.address))
        .to.emit(factory, "OperatorAdded")
        .withArgs(operator1.address);
      expect(await factory.isOperator(operator1.address)).to.equal(true);
    });

    it("non-owner cannot add operators", async function () {
      await expect(
        factory.connect(stranger).addOperator(operator1.address)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("rejects duplicate operator", async function () {
      await factory.addOperator(operator1.address);
      await expect(
        factory.addOperator(operator1.address)
      ).to.be.revertedWith("Already an operator");
    });

    it("owner can remove an operator", async function () {
      await factory.addOperator(operator1.address);
      await expect(factory.removeOperator(operator1.address))
        .to.emit(factory, "OperatorRemoved")
        .withArgs(operator1.address);
      expect(await factory.isOperator(operator1.address)).to.equal(false);
    });
  });

  describe("Listing properties", function () {
    beforeEach(async function () {
      await factory.addOperator(operator1.address);
    });

    it("authorized operator can list a property", async function () {
      const tx = await factory.connect(operator1).createProperty(
        ethers.parseEther("100"),
        30,
        "Burj Vista Unit 2304",
        "ipfs://Qm...",
        "Burj Vista 2304",
        "BURJ-2304"
      );
      const receipt = await tx.wait();

      // Find the PropertyCreated event
      const event = receipt.logs.find(
        (log) => {
          try {
            return factory.interface.parseLog(log)?.name === "PropertyCreated";
          } catch { return false; }
        }
      );
      expect(event).to.exist;

      expect(await factory.getPropertyCount()).to.equal(1);
      const allProps = await factory.getAllProperties();
      expect(allProps.length).to.equal(1);
    });

    it("unauthorized address cannot list", async function () {
      await expect(
        factory.connect(stranger).createProperty(
          ethers.parseEther("100"), 30, "t", "m", "n", "s"
        )
      ).to.be.revertedWith("Not an authorized operator");
    });

    it("deploys a fully-wired escrow + token pair", async function () {
      const tx = await factory.connect(operator1).createProperty(
        ethers.parseEther("50"), 30, "Test Property",
        "ipfs://meta", "Test Prop", "TST"
      );
      await tx.wait();

      const [escrowAddress] = await factory.getAllProperties();
      const escrow = await ethers.getContractAt("PropertyEscrow", escrowAddress);

      expect(await escrow.operator()).to.equal(operator1.address);
      expect(await escrow.goal()).to.equal(ethers.parseEther("50"));

      const tokenAddress = await escrow.propertyToken();
      const token = await ethers.getContractAt("PropertyToken", tokenAddress);
      expect(await token.symbol()).to.equal("TST");
      expect(await token.escrow()).to.equal(escrowAddress);
    });
  });

  describe("End-to-end integration", function () {
    it("full lifecycle: list -> contribute -> finalize -> claim shares", async function () {
      // 1. Admin authorizes operator
      await factory.addOperator(operator1.address);

      // 2. Operator lists property (10 ETH goal, 30 days)
      await factory.connect(operator1).createProperty(
        ethers.parseEther("10"), 30, "Integration Test Property",
        "ipfs://integration", "Integration Test", "INT"
      );
      const [escrowAddress] = await factory.getAllProperties();
      const escrow = await ethers.getContractAt("PropertyEscrow", escrowAddress);
      const token = await ethers.getContractAt("PropertyToken", await escrow.propertyToken());

      // 3. Investor contributes 10 ETH (goal met)
      await escrow.connect(investor).contribute({ value: ethers.parseEther("10") });
      expect(await escrow.totalRaised()).to.equal(ethers.parseEther("10"));

      // 4. Fast-forward past deadline
      const { time } = require("@nomicfoundation/hardhat-network-helpers");
      await time.increase(31 * 24 * 60 * 60);

      // 5. Operator finalizes, receives ETH
      const beforeOp = await ethers.provider.getBalance(operator1.address);
      const tx = await escrow.connect(operator1).finalize();
      const rc = await tx.wait();
      const gas = rc.gasUsed * rc.gasPrice;
      const afterOp = await ethers.provider.getBalance(operator1.address);
      expect(afterOp - beforeOp + gas).to.equal(ethers.parseEther("10"));

      // 6. Investor claims shares — gets 10 * 1000 = 10,000 tokens
      await escrow.connect(investor).claimShares();
      expect(await token.balanceOf(investor.address))
        .to.equal(ethers.parseEther("10000"));
      expect(await token.totalSupply())
        .to.equal(ethers.parseEther("10000"));
    });
  });
});
