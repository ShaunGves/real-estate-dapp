import { Link } from "react-router-dom";
import { shortAddress } from "../utils/wallet";

export default function Navbar({ account, isOperator, onConnect }) {
  return (
    <nav className="bg-slate-900/80 backdrop-blur border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-amber-500 flex items-center justify-center font-bold text-slate-900">
            E
          </div>
          <span className="text-xl font-bold text-white">EstateToken</span>
        </Link>

        <div className="flex items-center gap-5">
          <Link to="/" className="text-slate-300 hover:text-white text-sm">
            Properties
          </Link>
          <Link
            to="/portfolio"
            className="text-slate-300 hover:text-white text-sm"
          >
            My Portfolio
          </Link>
          {isOperator && (
            <Link
              to="/create"
              className="text-amber-400 hover:text-amber-300 text-sm font-medium"
            >
              + List Property
            </Link>
          )}

          {account ? (
            <div className="flex items-center gap-2">
              {isOperator && (
                <span
                  title="You are an authorized operator"
                  className="px-2 py-0.5 text-xs bg-amber-900/40 text-amber-400 rounded border border-amber-800"
                >
                  Operator
                </span>
              )}
              <div className="px-3 py-1.5 bg-slate-800 rounded-lg text-sm font-mono text-emerald-400 border border-slate-700">
                {shortAddress(account)}
              </div>
            </div>
          ) : (
            <button
              onClick={onConnect}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-white font-medium transition"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
