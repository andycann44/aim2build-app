// src/pages/SetPartsPage.tsx
import { API_BASE } from "../api/client";
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API = API_BASE;

type SetSummary = {
  set_num: string;
  name: string;
  year: number;
  img_url?: string;
  num_parts?: number;
};

type SetPart = {
  part_num: string;
  color_id: number;
  quantity: number;
  part_img_url?: string;
  part_name?: string;
};

const SetPartsPage: React.FC = () => {
  const { set_num } = useParams<{ set_num: string }>();
  const navigate = useNavigate();

  const [setInfo, setSetInfo] = useState<SetSummary | null>(null);
  const [parts, setParts] = useState<SetPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!set_num) return;
    setLoading(true);
    setError(null);

    try {
      // 1) Parts for this set
      const partsRes = await fetch(
        `${API}/api/catalog/parts?set=${encodeURIComponent(set_num)}`
      );
      if (!partsRes.ok) {
        throw new Error(`Parts HTTP ${partsRes.status}`);
      }
      const partsData: SetPart[] = await partsRes.json();
      setParts(partsData);

      // 2) Optional: basic set info (name, image, year)
      try {
        const searchRes = await fetch(
          `${API}/api/search?q=${encodeURIComponent(set_num)}`
        );
        if (searchRes.ok) {
          const list: SetSummary[] = await searchRes.json();
          const match =
            list.find((s) => s.set_num === set_num) ?? list[0] ?? null;
          if (match) {
            setSetInfo(match);
          }
        }
      } catch {
        // ignore search errors, parts are the main thing
      }
    } catch (err: any) {
      console.error("Failed to load set parts", err);
      setError(err?.message ?? "Failed to load set parts");
    } finally {
      setLoading(false);
    }
  }, [set_num]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!set_num) {
    return <p style={{ padding: "1.5rem" }}>No set selected.</p>;
  }

  return (
    <div className="page page-set-parts" style={{ padding: "1.5rem 0 2.5rem" }}>
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto 1.75rem",
          padding: "1.25rem 1.5rem",
          borderRadius: 20,
          background:
            "linear-gradient(135deg,#0b1120 0%,#1d4ed8 35%,#f97316 70%,#22c55e 100%)",
          color: "#f9fafb",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
          display: "flex",
          gap: "1.5rem",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            borderRadius: 999,
            border: "none",
            padding: "0.45rem 0.9rem",
            fontSize: "0.8rem",
            cursor: "pointer",
            background: "rgba(15,23,42,0.7)",
            color: "#e5e7eb",
            marginRight: "0.5rem",
          }}
        >
          ← Back
        </button>

        {setInfo?.img_url && (
          <div
            style={{
              borderRadius: 18,
              overflow: "hidden",
              background: "#0f172a",
              width: 140,
              minWidth: 140,
              height: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={setInfo.img_url}
              alt={setInfo.name}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "0.8rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              opacity: 0.9,
              marginBottom: "0.25rem",
            }}
          >
            Set breakdown
          </div>
          <h1
            style={{
              fontSize: "1.7rem",
              fontWeight: 800,
              margin: 0,
              marginBottom: "0.25rem",
              textShadow: "0 4px 18px rgba(0,0,0,0.6)",
            }}
          >
            {setInfo?.name ?? set_num}
          </h1>
          <div style={{ fontSize: "0.9rem", opacity: 0.9 }}>
            {set_num}
            {setInfo?.year ? ` • ${setInfo.year}` : null}
            {setInfo?.num_parts ? ` • ${setInfo.num_parts} pcs` : null}
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 1.5rem",
        }}
      >
        {error && (
          <p style={{ color: "red", marginBottom: "1rem" }}>{error}</p>
        )}

        {loading ? (
          <p>Loading parts…</p>
        ) : parts.length === 0 ? (
          <p>No parts found for this set.</p>
        ) : (
          <div
            style={{
              borderRadius: 18,
              overflow: "hidden",
              background: "#020617",
              boxShadow: "0 18px 40px rgba(15,23,42,0.7)",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                color: "#e5e7eb",
                fontSize: "0.9rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#020617",
                    textAlign: "left",
                    borderBottom: "1px solid rgba(148,163,184,0.4)",
                  }}
                >
                  <th style={{ padding: "0.75rem 1rem" }}>Part #</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Name</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Colour</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                    Quantity
                  </th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr
                    key={`${p.part_num}-${p.color_id}`}
                    style={{
                      borderBottom:
                        "1px solid rgba(30,64,175,0.35)",
                    }}
                  >
                    <td style={{ padding: "0.5rem 1rem", whiteSpace: "nowrap" }}>
                      {p.part_num}
                    </td>
                    <td
                      style={{
                        padding: "0.5rem 1rem",
                        maxWidth: 360,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={p.part_name}
                    >
                      {p.part_name ?? "—"}
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      {p.color_id}
                    </td>
                    <td
                      style={{
                        padding: "0.5rem 1rem",
                        textAlign: "right",
                        fontWeight: 600,
                      }}
                    >
                      {p.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetPartsPage;
