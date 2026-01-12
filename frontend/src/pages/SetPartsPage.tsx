// src/pages/SetPartsPage.tsx
import { API_BASE } from "../api/client";
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageHero from "../components/PageHero";
import InstructionsTile from "../components/InstructionsTile";
import SafeImg from "../components/SafeImg";

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

  const heroTitle = setInfo?.name ?? `Set ${set_num}`;
  const heroSubtitle = [
    set_num,
    setInfo?.year ? String(setInfo.year) : null,
    setInfo?.num_parts ? `${setInfo.num_parts} pcs` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="page page-set-parts" style={{ padding: "1.5rem 0 2.5rem" }}>
      <div style={{ position: "relative" }}>
        <PageHero
          title={heroTitle}
          subtitle={heroSubtitle}
          left={
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="a2b-hero-button a2b-cta-dark"
            >
              ← Back
            </button>
          }
        />

        <div
          className="heroTwoCol"
          style={{
            position: "absolute",
            left: 22,
            right: 22,
            bottom: 18,
            zIndex: 5,
          }}
        >
          <div className="heroLeft" />
          <div className="heroRight">
            <InstructionsTile setNum={set_num || ""} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 1.5rem" }}>
        {setInfo ? (
          <div
            style={{
              marginBottom: "1rem",
              borderRadius: 18,
              overflow: "hidden",
              background: "#0f172a",
              width: 180,
              height: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SafeImg
              src={setInfo.img_url ?? undefined}
              alt={setInfo.name}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          </div>
        ) : null}
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
