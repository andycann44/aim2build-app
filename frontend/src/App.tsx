import React from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import StagingBanner from "./components/StagingBanner";
import Footer from "./components/Footer";

import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import MySetsPage from "./pages/MySetsPage";
import InventoryPage from "./pages/InventoryPage";
import InventoryAddCategoriesPage from "./pages/InventoryAddCategoriesPage";
import InventoryAddBrickPage from "./pages/InventoryAddBrickPage";
import InventoryPickColourPage from "./pages/InventoryPickColourPage";
import InventoryEditPage from "./pages/InventoryEditPage";

import BuildabilityOverviewPage from "./pages/BuildabilityOverviewPage";
import BuildabilityDiscoverPage from "./pages/BuildabilityDiscoverPage";
import BuildabilityDetailsPage from "./pages/BuildabilityDetailsPage";
import MissingPartsPage from "./pages/MissingPartsPage";

import WishlistPage from "./pages/WishlistPage";
import InstructionsSearchPage from "./pages/InstructionsSearchPage";
import SetPartsPage from "./pages/SetPartsPage";

import AccountPage from "./pages/AccountPage";
import SettingsPage from "./pages/SettingsPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";

import AdminPage from "./pages/AdminPage";
import DebugCatalogImagesPage from "./pages/DebugCatalogImagesPage";

export default function App() {
  return (
    <div className="app-shell">
      <div className="app-maxwidth">
        <aside className="app-sidebar">
          {/* IMPORTANT: use client-side routing (no full reload) */}
          <NavLink to="/" end className="brand" aria-label="Aim2Build home">
            <img src="/branding/a2b.png" alt="Aim2Build" className="brand-logo" />
          </NavLink>

          <nav className="app-nav">
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? "app-nav-link app-nav-link-active" : "app-nav-link")}
            >
              <span>Home</span>
              <span className="app-nav-link-indicator">›</span>
            </NavLink>

            <NavLink
              to="/search"
              className={({ isActive }) => (isActive ? "app-nav-link app-nav-link-active" : "app-nav-link")}
            >
              <span>Search</span>
              <span className="app-nav-link-indicator">›</span>
            </NavLink>

            <NavLink
              to="/my-sets"
              className={({ isActive }) => (isActive ? "app-nav-link app-nav-link-active" : "app-nav-link")}
            >
              <span>My Sets</span>
              <span className="app-nav-link-indicator">›</span>
            </NavLink>

            <NavLink
              to="/inventory"
              className={({ isActive }) => (isActive ? "app-nav-link app-nav-link-active" : "app-nav-link")}
            >
              <span>Inventory</span>
              <span className="app-nav-link-indicator">›</span>
            </NavLink>

            <NavLink
              to="/buildability"
              className={({ isActive }) => (isActive ? "app-nav-link app-nav-link-active" : "app-nav-link")}
            >
              <span>Buildability</span>
              <span className="app-nav-link-indicator">›</span>
            </NavLink>

            <NavLink
              to="/wishlist"
              className={({ isActive }) => (isActive ? "app-nav-link app-nav-link-active" : "app-nav-link")}
            >
              <span>Wishlist</span>
              <span className="app-nav-link-indicator">›</span>
            </NavLink>

            <NavLink
              to="/instructions"
              className={({ isActive }) => (isActive ? "app-nav-link app-nav-link-active" : "app-nav-link")}
            >
              <span>Instructions</span>
              <span className="app-nav-link-indicator">›</span>
            </NavLink>

            <NavLink
              to="/account"
              className={({ isActive }) => (isActive ? "app-nav-link app-nav-link-active" : "app-nav-link")}
            >
              <span>Account</span>
              <span className="app-nav-link-indicator">›</span>
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) => (isActive ? "app-nav-link app-nav-link-active" : "app-nav-link")}
            >
              <span>Settings</span>
              <span className="app-nav-link-indicator">›</span>
            </NavLink>
          </nav>

          <div className="app-sidebar-footer">Aim2Build</div>
        </aside>

        <main className="app-main">
          <StagingBanner />

          <div className="app-main-body">
            <Routes>
              {/* Core */}
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/my-sets" element={<MySetsPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/instructions" element={<InstructionsSearchPage />} />
              <Route path="/instructions/:setNum/parts" element={<SetPartsPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />

              {/* Inventory */}
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/inventory/edit" element={<InventoryEditPage />} />
              <Route path="/inventory/add" element={<InventoryAddCategoriesPage />} />
              <Route path="/inventory/add/bricks" element={<InventoryAddBrickPage />} />
              <Route path="/inventory/add/bricks/category/:catKey" element={<InventoryAddBrickPage />} />
              <Route path="/inventory/add/bricks/part/:partNum" element={<InventoryPickColourPage />} />

              {/* Back-compat redirects */}
              <Route path="/inventory/add/brick" element={<Navigate to="/inventory/add/bricks" replace />} />

              {/* Buildability */}
              <Route path="/buildability" element={<BuildabilityOverviewPage />} />
              <Route path="/buildability/discover" element={<BuildabilityDiscoverPage />} />
              <Route path="/buildability/:setNum/missing" element={<MissingPartsPage />} />
              <Route path="/buildability/:setNum" element={<BuildabilityDetailsPage />} />

              {/* Admin / Debug */}
              <Route path="/admin" element={<AdminPage />} />
              {import.meta.env.DEV && <Route path="/debug/catalog-images" element={<DebugCatalogImagesPage />} />}

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>

          <Footer />
        </main>
      </div>
    </div>
  );
}