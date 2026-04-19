import toast from "react-hot-toast";

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;

/**
 * Upload a JSON object to IPFS via Pinata. Returns the resulting CID
 * as an `ipfs://...` URI suitable for storing on-chain.
 *
 * Falls back gracefully: if no Pinata JWT is configured, returns a
 * placeholder URI and logs a warning so local dev still works.
 */
export async function uploadJsonToIpfs(jsonObject, name = "metadata") {
  if (!PINATA_JWT) {
    console.warn("VITE_PINATA_JWT not set; using placeholder URI.");
    return "ipfs://no-pinata-key-configured";
  }

  try {
    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify({
        pinataContent: jsonObject,
        pinataMetadata: { name },
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Pinata error: ${res.status} ${txt}`);
    }
    const data = await res.json();
    return `ipfs://${data.IpfsHash}`;
  } catch (err) {
    console.error(err);
    toast.error("IPFS upload failed; storing placeholder URI");
    return "ipfs://upload-failed";
  }
}

/**
 * Convert an `ipfs://CID` URI to an HTTPS gateway URL the browser can fetch.
 */
export function ipfsToHttp(uri) {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`;
  }
  return uri; // already http(s) or a placeholder
}

/**
 * Fetch and parse the JSON metadata at an IPFS URI. Returns null on failure.
 */
export async function fetchIpfsJson(uri) {
  try {
    const res = await fetch(ipfsToHttp(uri));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
