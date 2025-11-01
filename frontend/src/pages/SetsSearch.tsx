import React, { useEffect, useRef, useState } from 'react';
import { api } from "../lib/api";

// ---------- Config ----------
const API = (import.meta as any)?.env?.VITE_API_BASE || 'http://127.0.0.1:8000';
const MIN_Q = 3;
const LIMIT = 40;

type SetItem = {
  set_num: string;
  name?: string;
  year?: number;
  set_img_url?: string;
  img_url?: string;
};

// Suggestion helper: built-ins + optional external map
function suggestQuery(raw: string, extMap?: Record<string, string>): { alt: string; changed: boolean } {
  const q = (raw || '').trim();
  if (!q) return { alt: q, changed: false };
  const BASE: Record<string, string> = {
    'dail': 'daily',
    'bugel': 'bugle',
    'bugal': 'bugle',
    'castel': 'castle',
    'starwars': 'star wars',
    'star-war': 'star wars',
    'harry poter': 'harry potter'
  };
  // External map overrides built-ins
  const DICT: Record<string, string> = { ...BASE, ...(extMap || {}) };
  const parts = q.split(/\s+/).map((p) => {
    const low = p.toLowerCase();
    if (DICT[low]) return DICT[low];
    if (low.endsWith('dail')) return p + 'y';
    return p;
  });
  const alt = parts.join(' ');
  return { alt, changed: alt.toLowerCase() !== q.toLowerCase() };
}

export default function SetsSearch() {
  // Query + results
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SetItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Add-to-my-sets UI state
  const [addingId, setAddingId] = React.useState<string | null>(null);
  const [addedIds, setAddedIds] = React.useState<Record<string, boolean>>({});
  const [toast, setToast] = React.useState<string>("");

  // UI
  const [cardSize, setCardSize] = useState<'small'|'medium'|'large'>('medium');

  // Spell/alt
  const [spellMap, setSpellMap] = useState<Record<string, string> | null>(null);
  const [altText, setAltText] = useState<string | null>(null);
  const [altItems, setAltItems] = useState<SetItem[] | null>(null);
  const [view, setView] = useState<'primary'|'alt'>('primary');
  const [hint, setHint] = useState('');

  // Abort control
  const abortRef = useRef<AbortController | null>(null);

  // Load external spell map if present
  useEffect(() => {
    let alive = true;
    fetch('/spellmap.json', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!alive) return; if (j && typeof j === 'object') setSpellMap(j as Record<string, string>); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const eligible = q.trim().length >= MIN_Q;

  function extractItems(data: any): SetItem[] {
    if (Array.isArray(data)) return data as SetItem[];
    if (data && Array.isArray(data.items)) return data.items as SetItem[];
    return [];
  }

  async function go() {
    const query = q.trim();
    if (!eligible) return;

    // reset alt state
    setAltText(null); setAltItems(null); setView('primary'); setHint(''); setError('');

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    try {
      // Primary fetch
      const url = `${API}/api/sets/search_sets?q=${encodeURIComponent(query)}&limit=${LIMIT}`;
      const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (r.status === 422) { setResults([]); setBusy(false); return; }
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const data = await r.json();
      const items = extractItems(data);
      setResults(items);

      // Background suggestion
      const { alt, changed } = suggestQuery(query, spellMap || undefined);
      if (changed && alt.toLowerCase() !== query.toLowerCase()) {
        try {
          const url2 = `${API}/api/sets/search_sets?q=${encodeURIComponent(alt)}&limit=${LIMIT}`;
          const r2 = await fetch(url2, { headers: { Accept: 'application/json' }, signal: controller.signal });
          if (r2.ok) {
            const d2 = await r2.json();
            const it2 = extractItems(d2);
            if (it2.length > 0) {
              setAltText(alt); setAltItems(it2);
              if (items.length === 0 || it2.length > Math.floor(items.length * 1.25)) {
                setView('alt');
                setHint(`Showing results for "${alt}" (from "${query}")`);
              } else {
                setHint(`Did you mean "${alt}"?`);
              }
            }
          }
        } catch { /* ignore alt errors */ }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message || 'Request failed');
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter' && eligible && !busy) go();
  };

  // Add to My Sets handler
  async function addToMySets(item: SetItem){
    try{
      setAddingId(item.set_num);
      await api("/api/my-sets/", {
        method: "POST",
        body: JSON.stringify(item),
      });
      setAddedIds(prev => ({ ...prev, [item.set_num]: true }));
      setToast(`Added to My Sets: ${item.name ?? item.set_num}`);
      setTimeout(() => setToast(""), 1500);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '16px' }}>
      {toast && (
        <div style={{position:"fixed", right:16, bottom:16, background:"#111827", color:"#fff", padding:"10px 12px", borderRadius:8, boxShadow:"0 4px 12px rgba(0,0,0,.25)"}}>
          {toast}
        </div>
      )}
      <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        Search Sets
        <span style={{ fontSize: 11, padding: '2px 6px', border: '1px solid #e5e5e5', borderRadius: 6, color: '#555' }}>ui-smart-spell</span>
        {view === 'alt' && altText ? (
          <span title="alt view" style={{ fontSize: 11, padding: '2px 6px', border: '1px solid #d1d5db', borderRadius: 6, color: '#374151' }}>
            viewing: {altText}
          </span>
        ) : null}
      </h3>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="e.g. daily bugle, castle, 10220"
          style={{ flex: '1 1 360px', padding: '8px', border: '1px solid #d1d5db', borderRadius: 6 }}
        />
        <button onClick={go} disabled={!eligible || busy}>Search</button>
        <button onClick={() => { setQ(''); setResults([]); setAltItems(null); setAltText(null); setHint(''); }}>Clear</button>

        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Card size</span>
          <button type="button" onClick={() => setCardSize('small')} aria-pressed={cardSize === 'small'}>S</button>
          <button type="button" onClick={() => setCardSize('medium')} aria-pressed={cardSize === 'medium'}>M</button>
          <button type="button" onClick={() => setCardSize('large')} aria-pressed={cardSize === 'large'}>L</button>
        </div>
      </div>

      {/* Status */}
      <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
        Enter-only mode · limit {LIMIT} · type at least {MIN_Q} chars
      </div>
      {/* Spelling: add/update words in /public/spellmap.json (optional). Falls back to built-in map. */}
      {!!hint && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
          {hint}
          {altText && altItems && (
            view === 'alt'
              ? <button type="button" onClick={() => setView('primary')} style={{ marginLeft: 8 }}>Show "{q.trim()}"</button>
              : <button type="button" onClick={() => setView('alt')} style={{ marginLeft: 8 }}>Show "{altText}"</button>
          )}
        </div>
      )}

      {/* Results */}
      <div className="results-grid" data-size={cardSize} style={{ marginTop: 16 }}>
        {(view === 'alt' && altItems ? altItems : results).map((s) => {
          const img = s.set_img_url || s.img_url || '';
          return (
            <div className="set-card" key={s.set_num}>
              <div style={{ padding: '10px 12px 0 12px' }}>
                <div style={{ fontWeight: 600 }}>{s.set_num}</div>
                <div style={{ color: '#111' }}>{s.name}</div>
                {s.year ? <div style={{ color: '#666', fontSize: 12 }}>{s.year}</div> : null}
              </div>
              <div className="set-thumb" style={{ marginTop: 8 }}>
                {img ? (
                  <img src={img} alt={s.name || s.set_num} loading="lazy" />
                ) : (
                  <div className="no-thumb">No image</div>
                )}
              </div>
              <div className="set-body">
                <div className="set-actions">
                  <button
                    title="Add to My Sets"
                    disabled={addingId === s.set_num || !!addedIds[s.set_num]}
                    onClick={() => addToMySets(s)}
                    style={{ padding: "8px 10px", borderRadius: 8, cursor: (addingId === s.set_num || !!addedIds[s.set_num]) ? "default" : "pointer" }}
                  >
                    {addedIds[s.set_num] ? "Added ✓" : (addingId === s.set_num ? "Saving…" : "Add to My Sets")}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .results-grid { --card-min: 220px; --card-max: 1fr; --thumb-max: 160px; display:grid; grid-template-columns: repeat(auto-fill, minmax(var(--card-min), var(--card-max))); gap:12px; }
        .results-grid[data-size='small'] { --card-min: 160px; --thumb-max: 140px; }
        .results-grid[data-size='large'] { --card-min: 280px; --thumb-max: 220px; }

        .set-card { border:1px solid #e5e5e5; border-radius:8px; overflow:hidden; background:#fff; display:flex; flex-direction:column; }
        .set-thumb { width:100%; height: var(--thumb-max); display:flex; align-items:center; justify-content:center; background:#fff; }
        .set-thumb > img { max-width:100%; max-height: var(--thumb-max); width:auto; height:auto; display:block; }
        .no-thumb { color:#999; font-size:12px; padding:24px 0; }

        .set-body { padding: 10px 12px; display:flex; flex-direction:column; gap:6px; }
        .set-actions { margin-top:auto; display:flex; gap:8px; align-items:center; }
      `}</style>
    </div>
  );
}
