import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { authHeaders } from "../api/client";

const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE || "http://35.178.138.33:8000";

type MissingPart = {
  part_num: string;
  color_id: number;
  need: number;
  have: number;
  short: number;
};

type CompareResult = {
  set_num: string;
  coverage: number;
  total_needed: number;
  total_have: number;
  missing_parts: MissingPart[];
};

type CatalogPart = {
  set_num: string;
  part_num: string;
  color_id: number;
  quantity: number;
  part_img_url?: string | null;
  part_name?: string | null;
};

const BuildabilityDetailsPage: React.FC = () => {
  const { setId } = useParams<{ setId: string }>(); // route: /buildability/:setId

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CompareResult | null>(null);
  const [parts, setParts] = useState<CatalogPart[]>([]);

  useEffect(() => {
    if (!setId) {
      setError("No set selected.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const headers = authHeaders(); // OK even if not logged in; will just be {}

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const compareUrl = `${API_BASE}/api/buildability/compare?set=${encodeURIComponent(
          setId
        )}`;
        const partsUrl = `${API_BASE}/api/catalog/parts?set=${encodeURIComponent(
          setId
        )}`;

        const [compareRes, partsRes] = await Promise.all([
          fetch(compareUrl, { headers, signal: controller.signal }),
          fetch(partsUrl, { headers, signal: controller.signal }),
        ]);

        if (!compareRes.ok) {
          const txt = await compareRes.text();
          throw new Error(
            `Compare failed (${compareRes.status}): ${txt || compareRes.statusText}`
          );
        }
        if (!partsRes.ok) {
          const txt = await partsRes.text();
          throw new Error(
            `Parts lookup failed (${partsRes.status}): ${
              txt || partsRes.statusText
            }`
          );
        }

        const compareJson = (await compareRes.json()) as CompareResult;
        const partsJson = (await partsRes.json()) as CatalogPart[];

        setSummary(compareJson);
        setParts(partsJson);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Failed to load buildability details:", err);
        setError(err.message || "Failed to load buildability details.");
      } finally {
        setLoading(false);
      }
    }

    load();

    return () => controller.abort();
  }, [setId]);

  const missingMap = useMemo(() => {
    const map = new Map<string, MissingPart>();
    if (!summary) return map;
    for (const m of summary.missing_parts || []) {
      map.set(`${m.part_num}-${m.color_id}`, m);
    }
    return map;
  }, [summary]);

  if (!setId) {
    return (
      <div className="page buildability-details">
        <h1>Buildability</h1>
        <p>No set selected.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page buildability-details">
        <h1>Set {setId}</h1>
        <p>Loading buildability details…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page buildability-details">
        <h1>Set {setId}</h1>
        <p style={{ color: "red" }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="page buildability-details">
      <h1>Set {setId}</h1>

      {summary && (
        <div style={{ marginBottom: "1.5rem" }}>
          <p>
            Coverage: <strong>{Math.round(summary.coverage * 100)}%</strong>
          </p>
          <p>
            Parts you have: <strong>{summary.total_have}</strong> /{" "}
            <strong>{summary.total_needed}</strong>
          </p>
        </div>
      )}

      {parts.length === 0 ? (
        <p>No parts to display.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.9rem",
            }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "4px" }}>Image</th>
                <th style={{ textAlign: "left", padding: "4px" }}>Part</th>
                <th style={{ textAlign: "right", padding: "4px" }}>Need</th>
                <th style={{ textAlign: "right", padding: "4px" }}>Have</th>
                <th style={{ textAlign: "right", padding: "4px" }}>Short</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => {
                const key = `${p.part_num}-${p.color_id}`;
                const missing = missingMap.get(key);
                const need = missing?.need ?? p.quantity ?? 0;
                const have = missing ? missing.have : need;
                const short = missing?.short ?? 0;

                return (
                  <tr key={key} style={{ borderTop: "1px solid #ccc" }}>
                    <td style={{ padding: "4px" }}>
                      {p.part_img_url ? (
                        <img
                          src={p.part_img_url}
                          alt={p.part_name || p.part_num}
                          style={{ width: 40, height: 40, objectFit: "contain" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 4,
                            border: "1px solid #ddd",
                          }}
                        />
                      )}
                    </td>
                    <td style={{ padding: "4px" }}>
                      <div>{p.part_num}</div>
                      {p.part_name && (
                        <div style={{ opacity: 0.7 }}>{p.part_name}</div>
                      )}
                      <div style={{ opacity: 0.7, fontSize: "0.8em" }}>
                        Colour: {p.color_id}
                      </div>
                    </td>
                    <td style={{ padding: "4px", textAlign: "right" }}>
                      {need}
                    </td>
                    <td style={{ padding: "4px", textAlign: "right" }}>
                      {have}
                    </td>
                    <td
                      style={{
                        padding: "4px",
                        textAlign: "right",
                        color: short > 0 ? "red" : "inherit",
                      }}
                    >
                      {short}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BuildabilityDetailsPage;