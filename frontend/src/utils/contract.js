import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";

import factoryData from "../contracts/PropertyFactory.json";
import escrowData from "../contracts/PropertyEscrow.json";
import tokenData from "../contracts/PropertyToken.json";

export const FACTORY_ADDRESS = factoryData.address;
export const FACTORY_ABI = factoryData.abi;
export const ESCROW_ABI = escrowData.abi;
export const TOKEN_ABI = tokenData.abi;

/**
 * Read-only provider. Uses Alchemy if VITE_ALCHEMY_SEPOLIA_URL is set,
 * else falls back to MetaMask's injected provider.
 */
export function getReadProvider() {
  const rpcUrl = import.meta.env.VITE_ALCHEMY_SEPOLIA_URL;
  if (rpcUrl) return new JsonRpcProvider(rpcUrl);
  if (window.ethereum) return new BrowserProvider(window.ethereum);
  throw new Error(
    "No RPC provider available. Install MetaMask or set VITE_ALCHEMY_SEPOLIA_URL."
  );
}

async function getSigner() {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  const provider = new BrowserProvider(window.ethereum);
  return provider.getSigner();
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function getFactoryReadOnly() {
  return new Contract(FACTORY_ADDRESS, FACTORY_ABI, getReadProvider());
}

export async function getFactoryWithSigner() {
  const signer = await getSigner();
  return new Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
}

// ---------------------------------------------------------------------------
// Per-property escrow (address comes from factory.getAllProperties())
// ---------------------------------------------------------------------------
export function getEscrowReadOnly(escrowAddress) {
  return new Contract(escrowAddress, ESCROW_ABI, getReadProvider());
}

export async function getEscrowWithSigner(escrowAddress) {
  const signer = await getSigner();
  return new Contract(escrowAddress, ESCROW_ABI, signer);
}

// ---------------------------------------------------------------------------
// PropertyToken (address comes from escrow.propertyToken())
// ---------------------------------------------------------------------------
export function getTokenReadOnly(tokenAddress) {
  return new Contract(tokenAddress, TOKEN_ABI, getReadProvider());
}
