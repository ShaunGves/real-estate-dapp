import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  getFactoryReadOnly,
  getEscrowReadOnly,
} from "../utils/contract";
import { fetchIpfsJson } from "../utils/ipfs";
import PropertyCard from "./PropertyCard";

export default function PropertyList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const factory = getFactoryReadOnly();
      const addresses = await factory.getAllProperties();

      // Fetch each escrow's summary in parallel.
      const summaries = await Promise.all(
        addresses.map(async (addr) => {
          const escrow = getEscrowReadOnly(addr);
          const s = await escrow.getSummary();
          // Destructure tuple by index (named return values come back this way)
          const summary = {
            operator: s[0],
            tokenAddress: s[1],
            title: s[2],
            metadataURI: s[3],
            goal: s[4],
            deadline: s[5],
            totalRaised: s[6],
            finalized: s[7],
            tokenName: s[8],
            tokenSymbol: s[9],
          };

          // Try to enrich with IPFS metadata (image URL etc.)
          const meta = await fetchIpfsJson(summary.metadataURI);
          return { escrowAddress: addr, summary, imageUrl: meta?.image };
        })
      );

      setItems(summaries);
    } catch (err) {
      console.error(err);
      setError(
        "Failed to load properties. Check that the factory is deployed and PropertyFactory.json has the correct address."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">
          Own a slice of real estate.
        </h1>
        <p className="text-slate-400">
          Pool ETH with other investors to fund property purchases. Receive
          ERC-20 tokens proportional to your contribution. Trade anytime.
        </p>
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-400">
          Loading properties...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="text-center py-16 bg-slate-800/50 rounded-xl border border-slate-700">
          <p className="text-slate-400 mb-2">No properties listed yet.</p>
          <p className="text-slate-500 text-sm">
            Authorized operators can list a property using the navigation above.
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <PropertyCard key={item.escrowAddress} {...item} />
          ))}
        </div>
      )}
    </div>
  );
}
