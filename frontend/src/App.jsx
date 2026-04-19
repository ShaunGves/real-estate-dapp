import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import PropertyList from "./components/PropertyList";
import PropertyDetails from "./components/PropertyDetails";
import CreateProperty from "./components/CreateProperty";
import MyPortfolio from "./components/MyPortfolio";
import { connectWallet, getConnectedAccount } from "./utils/wallet";
import { getFactoryReadOnly } from "./utils/contract";

function App() {
  const [account, setAccount] = useState(null);
  const [isOperator, setIsOperator] = useState(false);

  useEffect(() => {
    getConnectedAccount().then(setAccount);

    if (window.ethereum) {
      const handleAccounts = (accs) => setAccount(accs[0] || null);
      const handleChain = () => window.location.reload();
      window.ethereum.on("accountsChanged", handleAccounts);
      window.ethereum.on("chainChanged", handleChain);
      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccounts);
        window.ethereum.removeListener("chainChanged", handleChain);
      };
    }
  }, []);

  // Whenever the account changes, check if it's an authorized operator
  useEffect(() => {
    async function check() {
      if (!account) return setIsOperator(false);
      try {
        const factory = getFactoryReadOnly();
        setIsOperator(await factory.isOperator(account));
      } catch (err) {
        console.error("Could not check operator status:", err);
        setIsOperator(false);
      }
    }
    check();
  }, [account]);

  const handleConnect = async () => {
    const acc = await connectWallet();
    if (acc) setAccount(acc);
  };

  return (
    <div className="min-h-screen">
      <Navbar
        account={account}
        isOperator={isOperator}
        onConnect={handleConnect}
      />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<PropertyList />} />
          <Route
            path="/property/:address"
            element={
              <PropertyDetails account={account} onConnect={handleConnect} />
            }
          />
          <Route
            path="/create"
            element={
              <CreateProperty
                account={account}
                isOperator={isOperator}
                onConnect={handleConnect}
              />
            }
          />
          <Route
            path="/portfolio"
            element={
              <MyPortfolio account={account} onConnect={handleConnect} />
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
