import React, { useState } from "react";
import { getBuildability, BuildabilityResult } from "../api/client";

const BuildabilityPage: React.FC = () => {
  const [setNum, setSetNum] = useState("");
  const [result, setResult] = useState<BuildabilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await getBuildability(setNum);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to check buildability");
    } finally {
      setLoading(false);
    }
  }

  function coverageBadge(coverage: number) {
    if (coverage >= 0.9) return "green";
    if (coverage >= 0.6) return "amber";
    return "red";
  }

  return (
    <div className="page">
     <div className="page page-buildability">
      {/* HERO HEADER – same style as Search, just without the search box */}
      <div
        className="buildability-hero"
        style={{
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          marginTop: "1.5rem",
          marginRight: "2.5rem",
          marginBottom: "1.5rem",
          marginLeft: "0",
          borderRadius: "18px",
          padding: "1.75rem 1.5rem 1.5rem",
          background:
            "linear-gradient(135deg, #0b1120 0%, #1d4ed8 35%, #fbbf24 70%, #dc2626 100%)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* subtle lego studs strip */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "0 0 auto 0",
            height: "10px",
            display: "flex",
            gap: "2px",
            padding: "0 8px",
          }}
        >
          {[
            "#dc2626",
            "#f97316",
            "#fbbf24",
            "#22c55e",
            "#0ea5e9",
            "#6366f1",
          ].map((c, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                borderRadius: "99px",
                background: c,
                opacity: 0.9,
              }}
            />
          ))}
        </div>

        <h1
          style={{
            fontSize: "2.1rem",
            fontWeight: 800,
            marginTop: "1.2rem",
          }}
        >
          Buildability
        </h1>
          <div className="page-subtitle">
            Check how close your inventory is to building a specific set.
          </div>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleCheck} className="row-space">
          <input
            className="input"
            placeholder="Enter set number, e.g. 21330-1"
            value={setNum}
            onChange={(e) => setSetNum(e.target.value)}
          />
          <button className="button" type="submit" disabled={loading}>
            {loading ? "Checking..." : "Check"}
          </button>
        </form>

        {error && (
          <div style={{ marginTop: 8, color: "#f97373", fontSize: "0.8rem" }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ marginTop: 12 }}>
            <div className="row-space" style={{ marginBottom: 4 }}>
              <div>
                <div className="tile-title">Set {result.set_num}</div>
                <div className="small-muted">
                  You have {result.total_have} of {result.total_needed} parts.
                </div>
              </div>
              <span
                className={`chip ${coverageBadge(result.coverage)}`}
              >
                {(result.coverage * 100).toFixed(1)}% complete
              </span>
            </div>
            <div className="small-muted">
              This is a simple coverage metric. Later we can add details and
              missing-part breakdowns.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuildabilityPage;
