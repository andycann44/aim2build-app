import React from "react";
import { Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
import StagingBanner from "./components/StagingBanner";
import SearchPage from "./pages/SearchPage";
import BuildabilityOverviewPage from "./pages/BuildabilityOverviewPage";
import InventoryPage from "./pages/InventoryPage";
import MySetsPage from "./pages/MySetsPage";
import WishlistPage from "./pages/WishlistPage";
import InstructionsSearchPage from "./pages/InstructionsSearchPage";
import SettingsPage from "./pages/SettingsPage";
import BuildabilityDetailsPage from "./pages/BuildabilityDetailsPage";
import MissingPartsPage from "./pages/MissingPartsPage";
import HomePage from "./pages/HomePage";
import AccountPage from "./pages/AccountPage";
import InventoryAddCategoriesPage from "./pages/InventoryAddCategoriesPage";
import InventoryAddBrickPage from "./pages/InventoryAddBrickPage";
import InventoryPickColourPage from "./pages/InventoryPickColourPage";
import InventoryEditPage from "./pages/InventoryEditPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { initSessionIdleGuard } from "./utils/sessionGuard";
import BuildabilityDiscoverPage from "./pages/BuildabilityDiscoverPage";
import SetPage from "./pages/SetPage";
import { getToken } from "./utils/auth";

const App: React.FC = () => {
  const nav = useNavigate();

  React.useEffect(() => {
    return initSessionIdleGuard(() => {
      // Guests should be allowed to browse /set/:setNum without being forced to login
      if (getToken()) nav("/login");
    });
  }, [nav]);

  return (
    <>
      <StagingBanner />
      <div className="app-shell">
        <aside className="app-sidebar">
          <a href="/" className="brand" aria-label="Aim2Build home">
            <img src="/branding/a2b.png" alt="Aim2Build" className="brand-logo" />
          </a>

          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Home
            </NavLink>

            <NavLink to="/search" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Search
            </NavLink>

            <NavLink to="/my-sets" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              My Sets
            </NavLink>

            <NavLink to="/inventory" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Inventory
            </NavLink>

            <NavLink to="/buildability" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Buildability
            </NavLink>

            <NavLink to="/wishlist" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Wishlist
            </NavLink>

            {/* NEW: Instructions (under Wishlist) */}
            <NavLink to="/instructions" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Set Instructions
            </NavLink>

            <NavLink to="/account" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Account
            </NavLink>

            <NavLink to="/settings" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Settings
            </NavLink>
          </nav>
        </aside>

        <main className="main" style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/set/:setNum" element={<SetPage />} />

            <Route path="/search" element={<SearchPage />} />
            <Route path="/my-sets" element={<MySetsPage />} />

            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/inventory/edit" element={<InventoryEditPage />} />
            <Route path="/inventory/add" element={<InventoryAddCategoriesPage />} />
            <Route path="/inventory/add/bricks" element={<InventoryAddBrickPage />} />
            <Route path="/inventory/add/bricks/part/:partNum" element={<InventoryPickColourPage />} />

            <Route path="/buildability" element={<BuildabilityOverviewPage />} />
            <Route path="/buildability/:setNum" element={<BuildabilityDetailsPage />} />
            <Route path="/buildability/:setNum/missing" element={<MissingPartsPage />} />
            <Route path="/buildability/discover" element={<BuildabilityDiscoverPage />} />

            <Route path="/wishlist" element={<WishlistPage />} />

            {/* NEW: Instructions Search */}
            <Route path="/instructions" element={<InstructionsSearchPage />} />

            <Route path="/account" element={<AccountPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            <Route path="/login" element={<AccountPage />} />
            <Route path="/Login" element={<Navigate to="/login" replace />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Routes>

          {/* footer unchanged */}
        </main>
      </div>
    </>
  );
};

export default App;