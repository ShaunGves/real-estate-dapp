const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PropertyEscrow", function () {
  let escrow, token;
  let operator, investorA, investorB, investorC;
  const GOAL = ethers.parseEther("10");
  const DURATION_DAYS = 30;

  beforeEach(async function () {
    [operator, investorA, investorB, investorC] = await ethers.getSigners();
    const Escrow = await ethers.getContractFactory("PropertyEscrow");
    escrow = await Escrow.deploy(
      operator.address,
      GOAL,
      DURATION_DAYS,
      "Burj Vista Unit 2304",
      "ipfs://QmTestMetadata",
      "Burj Vista 2304",
      "BURJ-2304"
    );
    await escrow.waitForDeployment();

    // Grab the auto-deployed token
    const tokenAddress = await escrow.propertyToken();
    token = await ethers.getContractAt("PropertyToken", tokenAddress);
  });

  describe("Deployment", function () {
    it("stores immutable metadata correctly", async function () {
      expect(await escrow.operator()).to.equal(operator.address);
      expect(await escrow.goal()).to.equal(GOAL);
      expect(await escrow.title()).to.equal("Burj Vista Unit 2304");
      expect(await escrow.metadataURI()).to.equal("ipfs://QmTestMetadata");
      expect(await escrow.totalRaised()).to.equal(0);
      expect(await escrow.finalized()).to.equal(false);
    });

    it("deploys a paired PropertyToken with correct name and symbol", async function () {
      expect(await token.name()).to.equal("Burj Vista 2304");
      expect(await token.symbol()).to.equal("BURJ-2304");
      expect(await token.escrow()).to.equal(await escrow.getAddress());
    });

    it("rejects zero operator", async function () {
      const Escrow = await ethers.getContractFactory("PropertyEscrow");
      await expect(
        Escrow.deploy(ethers.ZeroAddress, GOAL, 30, "t", "m", "n", "s")
      ).to.be.revertedWith("Operator cannot be zero");
    });
  });

  describe("Contributions", function () {
    it("accepts contributions and updates totals", async function () {
      const amount = ethers.parseEther("1.5");
      await expect(escrow.connect(investorA).contribute({ value: amount }))
        .to.emit(escrow, "ContributionMade")
        .withArgs(investorA.address, amount);

      expect(await escrow.contributions(investorA.address)).to.equal(amount);
      expect(await escrow.totalRaised()).to.equal(amount);
    });

    it("aggregates repeat contributions from the same investor", async function () {
      await escrow.connect(investorA).contribute({ value: ethers.parseEther("1") });
      await escrow.connect(investorA).contribute({ value: ethers.parseEther("2") });
      expect(await escrow.contributions(investorA.address))
        .to.equal(ethers.parseEther("3"));
    });

    it("rejects the operator self-contributing", async function () {
      await expect(
        escrow.connect(operator).contribute({ value: ethers.parseEther("1") })
      ).to.be.revertedWith("Operator cannot self-contribute");
    });

    it("rejects zero contributions", async function () {
      await expect(
        escrow.connect(investorA).contribute({ value: 0 })
      ).to.be.revertedWith("Must contribute > 0");
    });

    it("rejects contributions after deadline", async function () {
      await time.increase(31 * 24 * 60 * 60);
      await expect(
        escrow.connect(investorA).contribute({ value: ethers.parseEther("1") })
      ).to.be.revertedWith("Funding window closed");
    });
  });

  describe("Success path: finalize + claimShares", function () {
    beforeEach(async function () {
      // Fully fund: 4 + 4 + 2 = 10 ETH (goal met exactly)
      await escrow.connect(investorA).contribute({ value: ethers.parseEther("4") });
      await escrow.connect(investorB).contribute({ value: ethers.parseEther("4") });
      await escrow.connect(investorC).contribute({ value: ethers.parseEther("2") });
    });

    it("lets operator finalize after deadline when goal met", async function () {
      await time.increase(31 * 24 * 60 * 60);

      const before = await ethers.provider.getBalance(operator.address);
      const tx = await escrow.connect(operator).finalize();
      const rc = await tx.wait();
      const gasCost = rc.gasUsed * rc.gasPrice;
      const after = await ethers.provider.getBalance(operator.address);

      expect(after - before + gasCost).to.equal(ethers.parseEther("10"));
      expect(await escrow.finalized()).to.equal(true);
    });

    it("blocks finalize before deadline", async function () {
      await expect(
        escrow.connect(operator).finalize()
      ).to.be.revertedWith("Deadline not reached");
    });

    it("blocks finalize by non-operator", async function () {
      await time.increase(31 * 24 * 60 * 60);
      await expect(
        escrow.connect(investorA).finalize()
      ).to.be.revertedWith("Only operator");
    });

    it("blocks double finalize", async function () {
      await time.increase(31 * 24 * 60 * 60);
      await escrow.connect(operator).finalize();
      await expect(
        escrow.connect(operator).finalize()
      ).to.be.revertedWith("Already finalized");
    });

    it("mints proportional tokens on claimShares", async function () {
      await time.increase(31 * 24 * 60 * 60);
      await escrow.connect(operator).finalize();

      // Investor A contributed 4 ETH => 4 * 1000 = 4000 whole tokens
      await expect(escrow.connect(investorA).claimShares())
        .to.emit(escrow, "SharesClaimed")
        .withArgs(investorA.address, ethers.parseEther("4000"));

      expect(await token.balanceOf(investorA.address))
        .to.equal(ethers.parseEther("4000"));

      // B claims their 4000
      await escrow.connect(investorB).claimShares();
      expect(await token.balanceOf(investorB.address))
        .to.equal(ethers.parseEther("4000"));

      // C claims their 2000
      await escrow.connect(investorC).claimShares();
      expect(await token.balanceOf(investorC.address))
        .to.equal(ethers.parseEther("2000"));

      // Total supply = 10 ETH * 1000 = 10,000 tokens
      expect(await token.totalSupply()).to.equal(ethers.parseEther("10000"));
    });

    it("prevents double-claim of shares", async function () {
      await time.increase(31 * 24 * 60 * 60);
      await escrow.connect(operator).finalize();
      await escrow.connect(investorA).claimShares();
      await expect(
        escrow.connect(investorA).claimShares()
      ).to.be.revertedWith("No contribution to claim");
    });

    it("rejects claimShares before finalize", async function () {
      await time.increase(31 * 24 * 60 * 60);
      await expect(
        escrow.connect(investorA).claimShares()
      ).to.be.revertedWith("Not finalized yet");
    });

    it("claimableShares view reflects entitlement correctly", async function () {
      // Before finalize: 0
      expect(await escrow.claimableShares(investorA.address)).to.equal(0);

      await time.increase(31 * 24 * 60 * 60);
      await escrow.connect(operator).finalize();

      // After finalize: 4 ETH * 1000 = 4000e18
      expect(await escrow.claimableShares(investorA.address))
        .to.equal(ethers.parseEther("4000"));

      // After claim: 0
      await escrow.connect(investorA).claimShares();
      expect(await escrow.claimableShares(investorA.address)).to.equal(0);
    });
  });

  describe("Failure path: refunds", function () {
    beforeEach(async function () {
      // Only 3 ETH of 10 ETH goal — will fail
      await escrow.connect(investorA).contribute({ value: ethers.parseEther("1") });
      await escrow.connect(investorB).contribute({ value: ethers.parseEther("2") });
    });

    it("lets investors reclaim their ETH after failure", async function () {
      await time.increase(31 * 24 * 60 * 60);

      const before = await ethers.provider.getBalance(investorA.address);
      const tx = await escrow.connect(investorA).claimRefund();
      const rc = await tx.wait();
      const gasCost = rc.gasUsed * rc.gasPrice;
      const after = await ethers.provider.getBalance(investorA.address);

      expect(after - before + gasCost).to.equal(ethers.parseEther("1"));
      expect(await escrow.contributions(investorA.address)).to.equal(0);
    });

    it("blocks finalize when goal not met", async function () {
      await time.increase(31 * 24 * 60 * 60);
      await expect(
        escrow.connect(operator).finalize()
      ).to.be.revertedWith("Goal not met");
    });

    it("blocks refund before deadline", async function () {
      await expect(
        escrow.connect(investorA).claimRefund()
      ).to.be.revertedWith("Deadline not reached");
    });

    it("blocks refund when goal was met", async function () {
      // Top it up so goal is met
      await escrow.connect(investorC).contribute({ value: ethers.parseEther("7") });
      await time.increase(31 * 24 * 60 * 60);
      await expect(
        escrow.connect(investorA).claimRefund()
      ).to.be.revertedWith("Goal was met; no refunds");
    });

    it("prevents double refund", async function () {
      await time.increase(31 * 24 * 60 * 60);
      await escrow.connect(investorA).claimRefund();
      await expect(
        escrow.connect(investorA).claimRefund()
      ).to.be.revertedWith("Nothing to refund");
    });
  });
});
