import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseEther } from "ethers";
import toast from "react-hot-toast";
import { getFactoryWithSigner } from "../utils/contract";
import { uploadJsonToIpfs } from "../utils/ipfs";

export default function CreateProperty({ account, isOperator, onConnect }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    bedrooms: "",
    bathrooms: "",
    sqft: "",
    imageUrl: "",
    goal: "",
    duration: "",
    tokenName: "",
    tokenSymbol: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!account) return onConnect();
    if (!isOperator) {
      return toast.error("Your wallet is not authorized as an operator");
    }
    if (!form.title || !form.goal || !form.duration || !form.tokenName || !form.tokenSymbol) {
      return toast.error("Title, goal, duration, token name and symbol are required");
    }

    setSubmitting(true);
    try {
      // 1. Pack metadata + upload to IPFS
      toast.loading("Uploading metadata to IPFS...", { id: "create" });
      const metadata = {
        title: form.title,
        description: form.description,
        location: form.location,
        bedrooms: form.bedrooms,
        bathrooms: form.bathrooms,
        sqft: form.sqft,
        image: form.imageUrl,
      };
      const metadataURI = await uploadJsonToIpfs(metadata, form.title);

      // 2. Send the listing transaction
      toast.loading("Sending transaction...", { id: "create" });
      const factory = await getFactoryWithSigner();
      const tx = await factory.createProperty(
        parseEther(form.goal),
        parseInt(form.duration, 10),
        form.title,
        metadataURI,
        form.tokenName,
        form.tokenSymbol
      );
      toast.loading("Waiting for confirmation...", { id: "create" });
      await tx.wait();

      toast.success("Property listed!", { id: "create" });
      navigate("/");
    } catch (err) {
      console.error(err);
      toast.error(err.reason || err.message || "Transaction failed", { id: "create" });
    } finally {
      setSubmitting(false);
    }
  }

  if (account && !isOperator) {
    return (
      <div className="max-w-2xl mx-auto bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h1 className="text-2xl font-bold text-white mb-2">Operator access required</h1>
        <p className="text-slate-400">
          Listing properties is restricted to operators authorized by the
          platform administrator. The deployer of the PropertyFactory can
          authorize you by calling <code className="text-amber-400">addOperator</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">List a Property</h1>
      <p className="text-slate-400 mb-6">
        Deploys a new escrow + ERC-20 token pair on-chain. Investors will be
        able to fund this property until the deadline.
      </p>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 bg-slate-800 p-6 rounded-xl border border-slate-700"
      >
        <Section title="Property details">
          <Field label="Title" required>
            <input name="title" value={form.title} onChange={handleChange}
              placeholder="Burj Vista Unit 2304" className="input" />
          </Field>
          <Field label="Description">
            <textarea name="description" value={form.description} onChange={handleChange}
              rows={3} className="input resize-none"
              placeholder="Two-bedroom apartment with Burj Khalifa views, fully furnished..." />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Location">
              <input name="location" value={form.location} onChange={handleChange}
                placeholder="Downtown Dubai" className="input" />
            </Field>
            <Field label="Image URL">
              <input name="imageUrl" value={form.imageUrl} onChange={handleChange}
                placeholder="ipfs://... or https://..." className="input" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Bedrooms">
              <input name="bedrooms" value={form.bedrooms} onChange={handleChange}
                type="number" min="0" placeholder="2" className="input" />
            </Field>
            <Field label="Bathrooms">
              <input name="bathrooms" value={form.bathrooms} onChange={handleChange}
                type="number" min="0" placeholder="2" className="input" />
            </Field>
            <Field label="Sq ft">
              <input name="sqft" value={form.sqft} onChange={handleChange}
                type="number" min="0" placeholder="1200" className="input" />
            </Field>
          </div>
        </Section>

        <Section title="Funding">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Goal (ETH)" required>
              <input name="goal" value={form.goal} onChange={handleChange}
                type="number" step="0.001" min="0" placeholder="100" className="input" />
            </Field>
            <Field label="Duration (days)" required>
              <input name="duration" value={form.duration} onChange={handleChange}
                type="number" min="1" placeholder="30" className="input" />
            </Field>
          </div>
        </Section>

        <Section title="Share token">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Token name" required>
              <input name="tokenName" value={form.tokenName} onChange={handleChange}
                placeholder="Burj Vista 2304" className="input" />
            </Field>
            <Field label="Token symbol" required>
              <input name="tokenSymbol" value={form.tokenSymbol} onChange={handleChange}
                placeholder="BURJ-2304" className="input" />
            </Field>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Investors receive 1,000 of these tokens for every 1 ETH contributed.
          </p>
        </Section>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition"
        >
          {submitting ? "Creating..." : account ? "List Property" : "Connect Wallet"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider border-b border-slate-700 pb-2">
        {title}
      </h2>
      {children}
    </div>
  );
}
