import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHero from "../components/PageHero";
import SetTile from "../components/SetTile";

const API = ((import.meta as any)?.env?.VITE_API_BASE || "");

type SetSummary = {
  set_num: string;
  name: string;
  year?: number;
  img_url?: string;
  num_parts?: number;
};

function legoInstructionsUrl(setNum: string) {
  const raw = (setNum || "").trim();
  // LEGO instructions URL expects the base set number (strip "-1", "-2", etc.)
  const q = raw.includes("-") ? raw.split("-")[0] : raw;
  return `https://www.lego.com/en-gb/service/buildinginstructions/${encodeURIComponent(q)}`;
}

function openInstructions(setNum: string) {
  window.open(legoInstructionsUrl(setNum), "_blank", "noopener,noreferrer");
}

export default function InstructionsSearchPage() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sets, setSets] = useState<SetSummary[]>([]);

  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

  async function runSearch() {
    const term = q.trim();
    if (!term) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/api/search?q=${encodeURIComponent(term)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SetSummary[];
      setSets(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Search failed");
      setSets([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page page-search">
      <PageHero
        title=" Set Instructions"
        subtitle='Search for a set, then open it to view instructions / parts. Tip: double-click a tile to open LEGO instructions.'
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            runSearch();
          }}
          style={{
            display: "flex",
            gap: "0.7rem",
            alignItems: "stretch",
            marginBottom: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search set number or name (e.g. 21330 or Home Alone)"
              className="search-input"
              style={{
                width: "calc(100% - 1cm)",
                padding: "0.9rem 1rem",
                borderRadius: "999px",
                border: "2px solid rgba(255,255,255,0.9)",
                outline: "none",
                fontSize: "1rem",
                backgroundColor: "rgba(15,23,42,0.9)",
                color: "#f9fafb",
                boxShadow: "0 0 0 2px rgba(15,23,42,0.35)",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={!canSearch || loading}
            className="search-button"
            style={{
              flex: "0 0 auto",
              padding: "0.85rem 1.6rem",
              borderRadius: "999px",
              border: "2px solid rgba(255,255,255,0.95)",
              fontWeight: 800,
              fontSize: "0.95rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: loading ? "default" : "pointer",
              background: "linear-gradient(135deg,#f97316,#facc15,#22c55e)",
              color: "#111827",
              boxShadow: "0 10px 22px rgba(0,0,0,0.55)",
              opacity: loading ? 0.8 : 1,
            }}
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>
      </PageHero>

      {/* BODY */}
      <div className="page-body" style={{ marginRight: "2.5rem" }}>
        {loading && <p className="search-status">Loading…</p>}
        {error && !loading && <p className="search-error">{error}</p>}

        {!loading && !error && sets.length === 0 && (
          <p className="search-empty">Search for a set to see results here.</p>
        )}

        {sets.length > 0 && (
          <div className="tile-grid">
            {sets.map((s) => (
              <div
                key={s.set_num}
                onDoubleClick={() => openInstructions(s.set_num)}
                title="Double-click to open LEGO instructions"
                style={{ cursor: "pointer" }}
              >
                <SetTile set={{ ...s, in_inventory: false } as any} inMySets={false} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}