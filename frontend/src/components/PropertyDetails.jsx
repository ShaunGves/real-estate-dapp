import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatEther, parseEther } from "ethers";
import toast from "react-hot-toast";
import {
  getEscrowReadOnly,
  getEscrowWithSigner,
  getTokenReadOnly,
} from "../utils/contract";
import { fetchIpfsJson, ipfsToHttp } from "../utils/ipfs";
import { shortAddress } from "../utils/wallet";

export default function PropertyDetails({ account, onConnect }) {
  const { address } = useParams();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState(null);
  const [myContribution, setMyContribution] = useState(0n);
  const [myTokenBalance, setMyTokenBalance] = useState(0n);
  const [claimableShares, setClaimableShares] = useState(0n);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [contributeAmount, setContributeAmount] = useState("");

  useEffect(() => {
    load();
  }, [address, account]);

  async function load() {
    setLoading(true);
    try {
      const escrow = getEscrowReadOnly(address);
      const s = await escrow.getSummary();
      const summaryObj = {
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
      setSummary(summaryObj);

      const metaJson = await fetchIpfsJson(summaryObj.metadataURI);
      setMeta(metaJson);

      if (account) {
        setMyContribution(await escrow.contributions(account));
        setClaimableShares(await escrow.claimableShares(account));
        const token = getTokenReadOnly(summaryObj.tokenAddress);
        setMyTokenBalance(await token.balanceOf(account));
      } else {
        setMyContribution(0n);
        setClaimableShares(0n);
        setMyTokenBalance(0n);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load property details");
    } finally {
      setLoading(false);
    }
  }

  async function handleContribute(e) {
    e.preventDefault();
    if (!account) return onConnect();
    if (!contributeAmount || Number(contributeAmount) <= 0) {
      return toast.error("Enter a valid amount");
    }
    setBusy(true);
    try {
      const escrow = await getEscrowWithSigner(address);
      toast.loading("Sending contribution...", { id: "tx" });
      const tx = await escrow.contribute({ value: parseEther(contributeAmount) });
      await tx.wait();
      toast.success("Contribution successful", { id: "tx" });
      setContributeAmount("");
      load();
    } catch (err) {
      console.error(err);
      toast.error(err.reason || err.message || "Failed", { id: "tx" });
    } finally { setBusy(false); }
  }

  async function handleFinalize() {
    setBusy(true);
    try {
      const escrow = await getEscrowWithSigner(address);
      toast.loading("Finalizing sale...", { id: "tx" });
      const tx = await escrow.finalize();
      await tx.wait();
      toast.success("Funds transferred to operator", { id: "tx" });
      load();
    } catch (err) {
      console.error(err);
      toast.error(err.reason || err.message || "Failed", { id: "tx" });
    } finally { setBusy(false); }
  }

  async function handleClaimShares() {
    setBusy(true);
    try {
      const escrow = await getEscrowWithSigner(address);
      toast.loading("Minting your shares...", { id: "tx" });
      const tx = await escrow.claimShares();
      await tx.wait();
      toast.success("Shares minted to your wallet", { id: "tx" });
      load();
    } catch (err) {
      console.error(err);
      toast.error(err.reason || err.message || "Failed", { id: "tx" });
    } finally { setBusy(false); }
  }

  async function handleRefund() {
    setBusy(true);
    try {
      const escrow = await getEscrowWithSigner(address);
      toast.loading("Claiming refund...", { id: "tx" });
      const tx = await escrow.claimRefund();
      await tx.wait();
      toast.success("Refund received", { id: "tx" });
      load();
    } catch (err) {
      console.error(err);
      toast.error(err.reason || err.message || "Failed", { id: "tx" });
    } finally { setBusy(false); }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading...</div>;
  }
  if (!summary) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 mb-4">Property not found</p>
        <button onClick={() => navigate("/")}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-white">
          Back
        </button>
      </div>
    );
  }

  const goal = formatEther(summary.goal);
  const raised = formatEther(summary.totalRaised);
  const progress = summary.goal === 0n
    ? 0
    : Math.min(100, Number((summary.totalRaised * 10000n) / summary.goal) / 100);

  const deadline = new Date(Number(summary.deadline) * 1000);
  const isActive = deadline > new Date();
  const goalReached = summary.totalRaised >= summary.goal;
  const isOperator = account && account.toLowerCase() === summary.operator.toLowerCase();

  const myStakePercent = summary.totalRaised === 0n
    ? 0
    : Number((myContribution * 10000n) / summary.totalRaised) / 100;

  const canFinalize = isOperator && !isActive && goalReached && !summary.finalized;
  const canClaimShares = account && summary.finalized && claimableShares > 0n;
  const canRefund = account && !isActive && !goalReached && myContribution > 0n;

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => navigate("/")}
        className="mb-4 text-slate-400 hover:text-white text-sm">
        ← Back to properties
      </button>

      {meta?.image && (
        <img src={ipfsToHttp(meta.image)} alt={summary.title}
          className="w-full h-72 object-cover rounded-xl mb-6"
          onError={(e) => (e.target.style.display = "none")} />
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* LEFT: details */}
        <div className="md:col-span-2 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 text-xs bg-slate-800 text-slate-300 rounded font-mono border border-slate-700">
                {summary.tokenSymbol}
              </span>
              <span className="text-xs text-slate-500">
                Token contract: {shortAddress(summary.tokenAddress)}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{summary.title}</h1>
            {meta?.location && (
              <p className="text-sm text-amber-400 mb-3">📍 {meta.location}</p>
            )}
            <p className="text-sm text-slate-400">
              Operator: <span className="font-mono text-sky-400">{shortAddress(summary.operator)}</span>
            </p>
          </div>

          {meta && (meta.bedrooms || meta.bathrooms || meta.sqft) && (
            <div className="flex gap-6 text-sm bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              {meta.bedrooms && <div><span className="text-slate-500">Beds:</span> <span className="text-white font-semibold">{meta.bedrooms}</span></div>}
              {meta.bathrooms && <div><span className="text-slate-500">Baths:</span> <span className="text-white font-semibold">{meta.bathrooms}</span></div>}
              {meta.sqft && <div><span className="text-slate-500">Area:</span> <span className="text-white font-semibold">{meta.sqft} sqft</span></div>}
            </div>
          )}

          {meta?.description && (
            <div>
              <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-2">Description</h2>
              <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{meta.description}</p>
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-2">How it works</h2>
            <ul className="text-sm text-slate-400 space-y-1.5">
              <li>• Contribute ETH during the funding window</li>
              <li>• If the goal is met by the deadline, the operator receives the pooled ETH</li>
              <li>• You then claim {summary.tokenSymbol} tokens (1 ETH = 1,000 tokens)</li>
              <li>• If the goal is not met, claim your ETH back in full</li>
            </ul>
          </div>
        </div>

        {/* RIGHT: action panel */}
        <div className="md:col-span-1">
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-4 sticky top-4">
            <div>
              <div className="text-2xl font-bold text-white">{raised} ETH</div>
              <div className="text-sm text-slate-400">raised of {goal} ETH goal</div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-gradient-to-r from-sky-500 to-amber-500"
                  style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="text-sm space-y-1.5 pt-2 border-t border-slate-700">
              <Row label={isActive ? "Ends" : "Ended"}>
                {deadline.toLocaleDateString()}
              </Row>
              <Row label="Status">
                <span className={isActive ? "text-sky-400" : goalReached ? (summary.finalized ? "text-emerald-400" : "text-amber-400") : "text-red-400"}>
                  {isActive ? "Funding" : goalReached ? (summary.finalized ? "Owned" : "Awaiting finalize") : "Failed"}
                </span>
              </Row>
            </div>

            {/* User-specific panel */}
            {account && (myContribution > 0n || myTokenBalance > 0n) && (
              <div className="text-sm space-y-1.5 pt-2 border-t border-slate-700">
                <div className="text-xs uppercase text-amber-400 font-semibold tracking-wider mb-1">Your position</div>
                {myContribution > 0n && (
                  <>
                    <Row label="Contributed">{formatEther(myContribution)} ETH</Row>
                    <Row label="Stake">{myStakePercent.toFixed(2)}%</Row>
                  </>
                )}
                {myTokenBalance > 0n && (
                  <Row label="Shares held">
                    {formatEther(myTokenBalance)} {summary.tokenSymbol}
                  </Row>
                )}
                {claimableShares > 0n && (
                  <Row label="Claimable">
                    <span className="text-amber-400">
                      {formatEther(claimableShares)} {summary.tokenSymbol}
                    </span>
                  </Row>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-700">
              {isActive && !isOperator && (
                <form onSubmit={handleContribute} className="space-y-2">
                  <input type="number" step="0.001" min="0"
                    value={contributeAmount}
                    onChange={(e) => setContributeAmount(e.target.value)}
                    placeholder="Amount in ETH" className="input" />
                  <button type="submit" disabled={busy}
                    className="w-full py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 rounded-lg text-white font-semibold">
                    {account ? "Contribute" : "Connect & Contribute"}
                  </button>
                </form>
              )}

              {canFinalize && (
                <button onClick={handleFinalize} disabled={busy}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 rounded-lg text-white font-semibold">
                  Finalize & Receive Funds
                </button>
              )}

              {canClaimShares && (
                <button onClick={handleClaimShares} disabled={busy}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 rounded-lg text-white font-semibold">
                  Claim {formatEther(claimableShares)} {summary.tokenSymbol}
                </button>
              )}

              {canRefund && (
                <button onClick={handleRefund} disabled={busy}
                  className="w-full py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-600 rounded-lg text-white font-semibold">
                  Claim Refund ({formatEther(myContribution)} ETH)
                </button>
              )}

              {isActive && isOperator && (
                <p className="text-xs text-slate-500 text-center">
                  You are the operator. You can finalize after the deadline if the goal is met.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200">{children}</span>
    </div>
  );
}
