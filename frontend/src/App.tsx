import React from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import SearchPage from "./pages/SearchPage";
import BuildabilityPage from "./pages/BuildabilityPage";
import InventoryPage from "./pages/InventoryPage";
import MySetsPage from "./pages/MySetsPage";
import WishlistPage from "./pages/WishlistPage";
import SettingsPage from "./pages/SettingsPage";
import BuildabilityDetailsPage from "./pages/BuildabilityDetailsPage";
import HomePage from "./pages/HomePage";

const App: React.FC = () => {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-main">Aim2Build</span>
          <span className="brand-sub">LEGO helper</span>
        </div>
        <nav className="nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/search"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Search
          </NavLink>
          <NavLink
            to="/my-sets"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            My Sets
          </NavLink>
          <NavLink
            to="/inventory"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Inventory
          </NavLink>
          <NavLink
            to="/buildability"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Buildability
          </NavLink>
          <NavLink
            to="/wishlist"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Wishlist
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Settings
          </NavLink>
        </nav>
      </aside>

      <main className="main" style={{ flex: 1 }}>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/my-sets" element={<MySetsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/buildability" element={<BuildabilityPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/buildability/:setNum"
            element={<BuildabilityDetailsPage />}
          />
        </Routes>

        {/* Small global footer */}
        <footer
          style={{
            marginTop: "1.5rem",
            padding: "0.75rem 1.25rem 1.25rem",
            fontSize: "0.75rem",
            color: "#9ca3af",
            borderTop: "1px solid rgba(31,41,55,0.8)",
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <span>
            Set and part data powered by{" "}
            <a
              href="https://rebrickable.com/"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#e5e7eb", textDecoration: "underline" }}
            >
              Rebrickable.com
            </a>
            . LEGO® is a trademark of the LEGO Group, which does not sponsor or
            endorse this site.
          </span>
          <span style={{ whiteSpace: "nowrap" }}>Built by Aim2</span>
        </footer>

      </main>
    </div>
  );
};

export default App;
