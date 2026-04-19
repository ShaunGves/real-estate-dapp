import { Link } from "react-router-dom";
import { formatEther } from "ethers";
import { shortAddress } from "../utils/wallet";
import { ipfsToHttp } from "../utils/ipfs";

export default function PropertyCard({ summary, escrowAddress, imageUrl }) {
  const goal = formatEther(summary.goal);
  const raised = formatEther(summary.totalRaised);
  const progress = summary.goal === 0n
    ? 0
    : Math.min(100, Number((summary.totalRaised * 10000n) / summary.goal) / 100);

  const deadline = new Date(Number(summary.deadline) * 1000);
  const isActive = deadline > new Date();
  const goalReached = summary.totalRaised >= summary.goal;
  const daysLeft = Math.max(
    0,
    Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24))
  );

  const status = isActive
    ? { label: "Funding", cls: "bg-sky-900/50 text-sky-400 border-sky-800" }
    : goalReached && summary.finalized
    ? { label: "Owned", cls: "bg-emerald-900/50 text-emerald-400 border-emerald-800" }
    : goalReached
    ? { label: "Pending Finalize", cls: "bg-amber-900/50 text-amber-400 border-amber-800" }
    : { label: "Failed", cls: "bg-red-900/50 text-red-400 border-red-800" };

  return (
    <Link
      to={`/property/${escrowAddress}`}
      className="block bg-slate-800/70 rounded-xl overflow-hidden border border-slate-700 hover:border-sky-500 transition"
    >
      {imageUrl ? (
        <img
          src={ipfsToHttp(imageUrl)}
          alt={summary.title}
          className="w-full h-44 object-cover"
          onError={(e) => (e.target.style.display = "none")}
        />
      ) : (
        <div className="w-full h-44 bg-gradient-to-br from-sky-700 to-amber-600 flex items-center justify-center">
          <span className="text-5xl font-bold text-white/40">
            {summary.title.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 text-xs rounded border ${status.cls}`}>
            {status.label}
          </span>
          <span className="px-2 py-0.5 text-xs bg-slate-900 text-slate-400 rounded font-mono border border-slate-700">
            {summary.tokenSymbol}
          </span>
        </div>

        <h3 className="text-lg font-bold text-white mb-2 truncate">
          {summary.title}
        </h3>

        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-300">
              <span className="font-bold text-white">{raised}</span> ETH
            </span>
            <span className="text-slate-400">of {goal} ETH</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-amber-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between text-xs text-slate-400">
          <span>by {shortAddress(summary.operator)}</span>
          <span>{isActive ? `${daysLeft} days left` : "Ended"}</span>
        </div>
      </div>
    </Link>
  );
}
