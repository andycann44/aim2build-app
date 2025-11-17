import React from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import SearchPage from "./pages/SearchPage";
import BuildabilityPage from "./pages/BuildabilityPage";
import InventoryPage from "./pages/InventoryPage";
import MySetsPage from "./pages/MySetsPage";
import WishlistPage from "./pages/WishlistPage";
import SettingsPage from "./pages/SettingsPage";

const App: React.FC = () => {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-main">Aim2Build</span>
          <span className="brand-sub">LEGO helper</span>
        </div>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            Search
          </NavLink>
          <NavLink to="/my-sets" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            My Sets
          </NavLink>
          <NavLink to="/inventory" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            Inventory
          </NavLink>
          <NavLink to="/buildability" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            Buildability
          </NavLink>
          <NavLink to="/wishlist" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            Wishlist
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            Settings
          </NavLink>
        </nav>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/my-sets" element={<MySetsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/buildability" element={<BuildabilityPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
