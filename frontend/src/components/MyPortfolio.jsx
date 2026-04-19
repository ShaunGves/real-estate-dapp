import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { formatEther } from "ethers";
import {
  getFactoryReadOnly,
  getEscrowReadOnly,
  getTokenReadOnly,
} from "../utils/contract";

export default function MyPortfolio({ account, onConnect }) {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (account) load();
  }, [account]);

  async function load() {
    setLoading(true);
    try {
      const factory = getFactoryReadOnly();
      const addresses = await factory.getAllProperties();

      // For each property: get summary, my contribution, my token balance,
      // and any claimable shares. Filter to only those where I have a stake.
      const results = await Promise.all(
        addresses.map(async (escrowAddress) => {
          const escrow = getEscrowReadOnly(escrowAddress);
          const s = await escrow.getSummary();
          const tokenAddress = s[1];
          const token = getTokenReadOnly(tokenAddress);

          const [contribution, balance, claimable] = await Promise.all([
            escrow.contributions(account),
            token.balanceOf(account),
            escrow.claimableShares(account),
          ]);

          if (contribution === 0n && balance === 0n && claimable === 0n) {
            return null;
          }

          return {
            escrowAddress,
            tokenAddress,
            title: s[2],
            tokenSymbol: s[9],
            totalRaised: s[6],
            finalized: s[7],
            contribution,
            balance,
            claimable,
          };
        })
      );

      setHoldings(results.filter(Boolean));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto bg-slate-800 p-6 rounded-xl border border-slate-700 text-center">
        <h1 className="text-2xl font-bold text-white mb-3">My Portfolio</h1>
        <p className="text-slate-400 mb-4">
          Connect your wallet to see your fractional property holdings.
        </p>
        <button onClick={onConnect}
          className="px-6 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-white font-medium">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">My Portfolio</h1>

      {loading && (
        <div className="text-center py-12 text-slate-400">Loading positions...</div>
      )}

      {!loading && holdings.length === 0 && (
        <div className="text-center py-16 bg-slate-800/50 rounded-xl border border-slate-700">
          <p className="text-slate-400 mb-2">You don't hold any property shares yet.</p>
          <Link to="/" className="text-sky-400 hover:text-sky-300">
            Browse properties →
          </Link>
        </div>
      )}

{!loading && holdings.length > 0 && (
  <div className="space-y-4">
    {holdings.map((h) => {
      // Token balance is the durable record of ownership.
      // Original contribution = balance / 1000 (since 1 ETH = 1000 tokens).
      // Stake % = balance / total token supply, but we don't fetch totalSupply
      // here — derive from totalRaised which equals (totalSupply / 1000) ETH.
      // After claim: contribution may be 0 but balance reflects historical stake.
      const effectiveContribution = h.balance > 0n ? h.balance / 1000n : h.contribution;
      const totalContribution = h.totalRaised; // in wei
      const stakePercent = totalContribution === 0n
        ? 0
        : Number((effectiveContribution * 10000n) / totalContribution) / 100;

            return (
              <Link key={h.escrowAddress}
                to={`/property/${h.escrowAddress}`}
                className="block bg-slate-800 rounded-xl border border-slate-700 hover:border-sky-500 p-5 transition">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white">{h.title}</h3>
                      <span className="px-2 py-0.5 text-xs bg-slate-900 text-slate-400 rounded font-mono border border-slate-700">
                        {h.tokenSymbol}
                      </span>
                    </div>
                  </div>
                  {h.claimable > 0n && (
                    <span className="px-2 py-1 text-xs bg-amber-900/40 text-amber-400 rounded border border-amber-800">
                      {formatEther(h.claimable)} {h.tokenSymbol} claimable
                    </span>
                  )}
                </div>
<div className="grid grid-cols-3 gap-4 text-sm">
  <Stat label="Contributed">{formatEther(effectiveContribution)} ETH</Stat>
  <Stat label="Stake">{stakePercent.toFixed(2)}%</Stat>
  <Stat label="Shares held">
    {formatEther(h.balance)} {h.tokenSymbol}
  </Stat>
</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, children }) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-white font-semibold">{children}</div>
    </div>
  );
}
