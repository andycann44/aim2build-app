import BuildabilityChecker from './components/BuildabilityChecker';
import InventoryManager from './components/InventoryManager';
import MySetsPanel from './components/MySetsPanel';
import WishlistPanel from './components/WishlistPanel';

export default function App(): JSX.Element {
  return (
    <>
      <header>
        <h1>Aim2Build Control Center</h1>
        <p>Track your LEGO® bricks, evaluate buildability, and manage your dream sets.</p>
      </header>
      <main>
        <BuildabilityChecker />
        <section>
          <h2>
            <span>🧱</span> Inventory
          </h2>
          <p className="status">
            Keep your brick counts in sync with the backend inventory service. Every change updates
            buildability instantly.
          </p>
          <InventoryManager />
        </section>
        <section>
          <h2>
            <span>📚</span> Collections
          </h2>
          <div className="card-grid">
            <MySetsPanel />
            <WishlistPanel />
          </div>
        </section>
      </main>
    </>
  );
}
