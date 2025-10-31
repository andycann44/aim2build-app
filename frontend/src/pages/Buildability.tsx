import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Buildability() {
  const [results, setResults] = useState([]);

  useEffect(() => {
    (async () => {
      const res = await api("/api/buildability/check_all");
      setResults(res?.results ?? []);
    })();
  }, []);

  return (
    <div>
      <h1>Buildable Sets</h1>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {results.map((r) => (
          <li key={r.set_num} style={{ marginBottom: 12 }}>
            <strong>{r.name || r.set_num}</strong> — {r.buildable ? "✅" : "❌"}
          </li>
        ))}
      </ul>
    </div>
  );
}
