const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PropertyToken", function () {
  let token, escrowSigner, randomUser;

  beforeEach(async function () {
    [escrowSigner, randomUser] = await ethers.getSigners();
    const PropertyToken = await ethers.getContractFactory("PropertyToken");
    // The deployer plays the role of "escrow" for unit-test isolation
    token = await PropertyToken.deploy("Test Property", "TEST", escrowSigner.address);
    await token.waitForDeployment();
  });

  it("initializes name, symbol, and escrow correctly", async function () {
    expect(await token.name()).to.equal("Test Property");
    expect(await token.symbol()).to.equal("TEST");
    expect(await token.escrow()).to.equal(escrowSigner.address);
    expect(await token.totalSupply()).to.equal(0);
  });

  it("rejects zero escrow address", async function () {
    const PropertyToken = await ethers.getContractFactory("PropertyToken");
    await expect(
      PropertyToken.deploy("X", "X", ethers.ZeroAddress)
    ).to.be.revertedWith("Escrow address cannot be zero");
  });

  it("allows escrow to mint", async function () {
    await token.mint(randomUser.address, ethers.parseEther("100"));
    expect(await token.balanceOf(randomUser.address)).to.equal(ethers.parseEther("100"));
    expect(await token.totalSupply()).to.equal(ethers.parseEther("100"));
  });

  it("blocks non-escrow from minting", async function () {
    await expect(
      token.connect(randomUser).mint(randomUser.address, 1n)
    ).to.be.revertedWith("Only escrow can mint");
  });

  it("blocks minting after closeMinting", async function () {
    await token.closeMinting();
    await expect(
      token.mint(randomUser.address, 1n)
    ).to.be.revertedWith("Minting is permanently closed");
  });

  it("supports standard ERC-20 transfers", async function () {
    await token.mint(randomUser.address, ethers.parseEther("10"));
    const [, , third] = await ethers.getSigners();
    await token.connect(randomUser).transfer(third.address, ethers.parseEther("3"));
    expect(await token.balanceOf(randomUser.address)).to.equal(ethers.parseEther("7"));
    expect(await token.balanceOf(third.address)).to.equal(ethers.parseEther("3"));
  });
});
