import toast from "react-hot-toast";

export async function connectWallet() {
  if (!window.ethereum) {
    toast.error("MetaMask not installed. Get it from metamask.io");
    return null;
  }
  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    toast.success("Wallet connected");
    return accounts[0];
  } catch (err) {
    console.error(err);
    toast.error(err.message || "Failed to connect wallet");
    return null;
  }
}

export async function getConnectedAccount() {
  if (!window.ethereum) return null;
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    return accounts[0] || null;
  } catch {
    return null;
  }
}

export async function switchToSepolia() {
  if (!window.ethereum) return false;
  const sepoliaChainId = "0xaa36a7"; // 11155111
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: sepoliaChainId }],
    });
    return true;
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: sepoliaChainId,
          chainName: "Sepolia",
          nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://rpc.sepolia.org"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        }],
      });
      return true;
    }
    return false;
  }
}

export function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
