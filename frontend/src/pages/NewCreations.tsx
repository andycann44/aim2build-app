import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface BuildSet {
  set_num: string;
  name: string;
  year: number;
  completeness: number;
}

export default function NewCreations() {
  const [sets, setSets] = useState<BuildSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api("/api/v1/buildability/sets?limit=30");
        setSets(res);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={{ padding: "2rem" }}>Loading...</div>;

  return (
    <div style={{ padding: "1rem 2rem" }}>
      <h1 style={{ marginBottom: "1rem" }}>New Creations</h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "1rem",
        }}
      >
        {sets.map((s) => (
          <div
            key={s.set_num}
            style={{
              background: "#fff",
              borderRadius: "8px",
              boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
              overflow: "hidden",
              textAlign: "center",
              padding: "0.5rem",
            }}
          >
            <img
              src={`https://cdn.rebrickable.com/media/sets/${s.set_num}.jpg`}
              alt={s.name}
              style={{ width: "100%", borderBottom: "1px solid #eee" }}
              onError={(e) =>
                ((e.target as HTMLImageElement).src =
                  "https://cdn.rebrickable.com/media/thumbs/parts/3001/1.jpg")
              }
            />
            <h3 style={{ fontSize: "1rem", margin: "0.5rem 0" }}>{s.name}</h3>
            <div style={{ fontSize: "0.9rem", color: "#555" }}>{s.year}</div>
            <div
              style={{
                marginTop: "0.5rem",
                fontWeight: "bold",
                color:
                  s.completeness >= 90
                    ? "green"
                    : s.completeness >= 50
                    ? "orange"
                    : "red",
              }}
            >
              {s.completeness ? `${s.completeness}%` : "0%"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
