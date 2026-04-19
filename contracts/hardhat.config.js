require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const ALCHEMY_SEPOLIA_URL = process.env.ALCHEMY_SEPOLIA_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: { chainId: 31337 },
    ganache: {
      url: "http://127.0.0.1:7545",
      accounts: process.env.GANACHE_PRIVATE_KEY ? [process.env.GANACHE_PRIVATE_KEY] : [],
    },
    sepolia: {
      url: ALCHEMY_SEPOLIA_URL,
      accounts: PRIVATE_KEY.startsWith("0x") ? [PRIVATE_KEY] : [`0x${PRIVATE_KEY}`],
      chainId: 11155111,
    },
  },
  etherscan: { apiKey: ETHERSCAN_API_KEY },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};
