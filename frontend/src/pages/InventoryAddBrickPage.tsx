/// <reference types="vite/client" />
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import RequireAuth from "../components/RequireAuth";
import BuildabilityPartsTile from "../components/BuildabilityPartsTile";
import { API_BASE } from "../api/client";
import { authHeaders } from "../utils/auth";
import PageHero from "../components/PageHero";

type ParentCategory = {
  key: string;
  label: string;
  img_url?: string | null;
  sort_order?: number | null;
  part_cat_id?: number | null;
};

type ChildCategory = {
  part_cat_id: number;
  label: string;
  img_url?: string | null;
  sort_order?: number | null;
};

type QuickFilterImage = {
  filter_key: string;
  label: string;
  img_url?: string | null;
  sort_order?: number | null;
};

type PartSummary = {
  part_num: string;
  part_name?: string | null;
  part_cat_id?: number | null;
  color_count?: number | null;
  default_color_id?: number | null;
  default_img_url?: string | null;
};

const PAGE_SIZE = 120;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/(\d)\s*x\s*(\d)/g, "$1 x $2")
    .replace(/\s+/g, " ")
    .trim();
const normKey = (value: string) => (value || "").toLowerCase().trim();
const partKey = (partNum: string, colorId: number) => `${partNum}::${colorId}`;

const FALLBACK_PARENT_CAT_ID: Record<string, number> = {
  slope: 3, // Bricks Sloped
  minifig: 13,
  plate: 14, // Plates (except slopes and tiles)
  wheel: 29,
  window: 16,
  animal: 28,
  bar: 32,
  plants: 76,
};

const InventoryAddBrickInner: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const parentKeyParam = qs.get("parent_key") || qs.get("cat") || "";
  const filterParam = qs.get("filter") || "";
  const queryParam = qs.get("q") || "";
  const childParam = qs.get("child") || "";

  const childPartCatId = useMemo(() => {
    const n = Number(childParam);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [childParam]);

  const [parents, setParents] = useState<ParentCategory[]>([]);
  const [children, setChildren] = useState<ChildCategory[]>([]);
  const [quickFilters, setQuickFilters] = useState<QuickFilterImage[]>([]);
  const [parts, setParts] = useState<PartSummary[]>([]);
  const [term, setTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("");
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [filtersEmpty, setFiltersEmpty] = useState(false);
  const [anySizeImages, setAnySizeImages] = useState<string[]>([]);
  const [anySizeIdx, setAnySizeIdx] = useState(0);
  const [isFilterScrolling, setIsFilterScrolling] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [owned, setOwned] = useState<Record<string, number>>({});
  const lastParentKeyRef = useRef<string>("");
  const lastAnySizeKeyRef = useRef<string>("");
  const filterScrollTimeoutRef = useRef<number | null>(null);

  const handleFilterScroll = useCallback(() => {
    setIsFilterScrolling(true);
    if (filterScrollTimeoutRef.current) {
      window.clearTimeout(filterScrollTimeoutRef.current);
    }
    filterScrollTimeoutRef.current = window.setTimeout(() => {
      setIsFilterScrolling(false);
      filterScrollTimeoutRef.current = null;
    }, 200);
  }, []);

  const selectedParent = useMemo(() => {
    if (!parents.length) return null;
    return parents.find((p) => p.key === parentKeyParam) || null;
  }, [parents, parentKeyParam]);

  const mode = useMemo<"parents" | "children" | "filters" | "grid">(() => {
    const hasSearchOrFilter = !!term.trim() || !!selectedFilter;
    const isTechnic = parentKeyParam === "technic";
    const isMinifig = parentKeyParam === "minifig";
    const allowNoFilterGrid = filtersLoaded && filtersEmpty;

    if (!parentKeyParam) return "parents";

    if (isTechnic) {
      if (!childParam) return "children";
      if (!selectedFilter && !term.trim() && !allowNoFilterGrid) return "filters";
      return "grid";
    }

      if (isMinifig) {
        if (!childParam) return "children";
        return "grid";
      }

      // all other parents
      if (!hasSearchOrFilter && !allowNoFilterGrid) return "filters";
      return "grid";
    }, [parentKeyParam, childParam, term, selectedFilter, filtersLoaded, filtersEmpty]);

  useEffect(() => {
    console.log("[add-bricks]", {
      parentKeyParam,
      childParam,
      term,
      selectedFilter,
      mode,
    });
  }, [parentKeyParam, childParam, term, selectedFilter, mode]);

  const filteredParts = useMemo(() => {
    const termNorm = normalize(term);

    const next = parts.filter((p) => {
      const name = normalize(p.part_name ?? "");
      const num = normalize(p.part_num ?? "");
      const hasImage = !!p.default_img_url;

      if (termNorm) {
        const matches = name.includes(termNorm) || num.includes(termNorm);
        if (!matches) return false;
      } else if (!hasImage) {
        // "Any size" (no search) shows only imaged parts
        return false;
      }
      return true;
    });

    return next.sort((a, b) => {
      const ac = Number(a.color_count ?? 0);
      const bc = Number(b.color_count ?? 0);
      if (bc !== ac) return bc - ac;
      return String(a.part_num).localeCompare(String(b.part_num));
    });
  }, [parts, term]);

  const visibleParts = useMemo(() => filteredParts.slice(0, visibleCount), [filteredParts, visibleCount]);

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(location.search);
      Object.entries(next).forEach(([key, value]) => {
        if (value && value.trim()) params.set(key, value);
        else params.delete(key);
      });
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    },
    [location.pathname, location.search, navigate]
  );

  // --- one-time URL cleanup (kills parent_id=undefined etc) ---
  useEffect(() => {
    const raw = qs.get("parent_id");
    if (!raw) return;

    const s = raw.trim();
    const bad = !s || s.toLowerCase() === "undefined" || !/^\d+$/.test(s);

    // if we're using parent_key routing, parent_id should not be present at all
    if (bad || parentKeyParam) {
      setParams({ parent_id: null });
    }
  }, [qs, parentKeyParam, setParams]);

  const loadParents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/catalog/categories/parents`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) throw new Error(`Failed to load categories (${res.status})`);
      const data = (await res.json()) as ParentCategory[];
      setParents(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load categories.");
      setParents([]);
    }
  }, []);

  const loadChildren = useCallback(async (parentKey: string) => {
    try {
      const params = new URLSearchParams();
      if (parentKey && parentKey.trim()) params.set("parent_key", parentKey);
      else {
        setChildren([]);
        return;
      }

      const res = await fetch(`${API_BASE}/api/catalog/categories/children?${params.toString()}`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) throw new Error(`Failed to load children (${res.status})`);
      const data = (await res.json()) as ChildCategory[];
      console.log("[add-bricks] children loaded:", Array.isArray(data) ? data.length : -1);
      setChildren(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load categories.");
      setChildren([]);
    }
  }, []);

  const loadQuickFilters = useCallback(async (parentKey: string, scopeKind = "cat", scopeId = -1) => {
    try {
      const params = new URLSearchParams();
      params.set("parent_key", parentKey);
      if (scopeKind) params.set("scope_kind", scopeKind);
      if (Number.isFinite(scopeId)) params.set("scope_id", String(scopeId));
      const res = await fetch(`${API_BASE}/api/brick/filters?${params.toString()}`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) throw new Error(`Failed to load filters (${res.status})`);
      const data = (await res.json()) as QuickFilterImage[];
      const list = Array.isArray(data) ? data : [];
      setQuickFilters(list);
      setFiltersLoaded(true);
      setFiltersEmpty(list.length === 0);
    } catch {
      setQuickFilters([]);
      setFiltersLoaded(true);
      setFiltersEmpty(false);
    }
  }, []);

  const resolveChildCatId = useCallback(
    (parentKey: string): number | null => {
      // 1) explicit from URL
      if (childPartCatId) return childPartCatId;

      // 2) parent row (when provided)
      const parentRow = parents.find((p) => p.key === parentKey);
      const parentCatId = Number(parentRow?.part_cat_id ?? 0);
      if (Number.isFinite(parentCatId) && parentCatId > 0) return parentCatId;

      // 3) hardcoded fallback for parents that do not expose part_cat_id
      const hardcoded = FALLBACK_PARENT_CAT_ID[parentKey];
      if (Number.isFinite(hardcoded) && hardcoded > 0) return hardcoded;

      // 4) fallback to first loaded child (if we have it)
      const fallbackChildCatId = Number(children[0]?.part_cat_id ?? 0);
      if (Number.isFinite(fallbackChildCatId) && fallbackChildCatId > 0) return fallbackChildCatId;

      return null;
    },
    [childPartCatId, parents, children]
  );

  const loadAnySizeImages = useCallback(
    async (parentKey: string) => {
      const isTechnic = parentKey === "technic";
      const isMinifig = parentKey === "minifig";

      // both technic and minifig require explicit child selection
      if ((isTechnic || isMinifig) && !childPartCatId) return;

      const resolvedCatId = resolveChildCatId(parentKey);
      if (!resolvedCatId) return;

      const requestKey = `${parentKey}::${resolvedCatId}`;
      if (lastAnySizeKeyRef.current === requestKey) return;
      lastAnySizeKeyRef.current = requestKey;

      try {
        const params = new URLSearchParams();
        params.set("parent_key", parentKey);
        params.set("filter_key", "all");
        params.set("child_part_cat_id", String(resolvedCatId));
        params.set("limit", "50");
        const res = await fetch(`${API_BASE}/api/brick/parts?${params.toString()}`, {
          headers: { ...authHeaders() },
        });
        if (!res.ok) return;
        const data = (await res.json()) as PartSummary[];
        const imgs = (Array.isArray(data) ? data : [])
          .map((p) => (p.default_img_url || "").trim())
          .filter((src) => !!src);
        setAnySizeImages(imgs);
        setAnySizeIdx(0);
      } catch {
        setAnySizeImages([]);
        setAnySizeIdx(0);
      }
    },
    [childPartCatId, resolveChildCatId]
  );

  const loadPartsByParent = useCallback(
    async (parentKey: string, filterKey: string, q: string) => {
      // HARD GATE: do not fetch until filter or search exists
      const hasSearch = !!(q || "").trim();
      const hasFilter = !!(filterKey || "").trim();
      const allowNoFilter = filtersLoaded && filtersEmpty && parentKey !== "technic";
      if (!hasSearch && !hasFilter && !allowNoFilter) {
        setParts([]);
        return;
      }

      const isTechnic = parentKey === "technic";
      const isMinifig = parentKey === "minifig";

      // strict: technic + minifig require explicit child selection (URL param)
      if ((isTechnic || isMinifig) && !childPartCatId) {
        setParts([]);
        return;
      }

      const resolvedCatId = resolveChildCatId(parentKey);
      if (!resolvedCatId) {
        setParts([]);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("parent_key", parentKey);
        params.set("filter_key", (filterKey || "all").trim() || "all");

        const qq = (q || "").trim();
        if (qq) params.set("q", qq);

        // backend requires child_part_cat_id (and minifig subcats use it too)
        params.set("child_part_cat_id", String(resolvedCatId));

        const res = await fetch(`${API_BASE}/api/brick/parts?${params.toString()}`, {
          headers: { ...authHeaders() },
        });
        if (!res.ok) throw new Error("Failed to load parts");
        const data = (await res.json()) as PartSummary[];
        setParts(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load parts");
        setParts([]);
      } finally {
        setLoading(false);
      }
    },
    [childPartCatId, resolveChildCatId, filtersLoaded, filtersEmpty]
  );

  const loadInventory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/inventory/canonical-parts`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        const k = partKey(String(row.part_num), Number(row.color_id));
        map[k] = Number(row.qty ?? row.qty_total ?? 0);
      });
      setOwned(map);
    } catch {
      // ignore
    }
  }, []);

  const changeQty = useCallback(
    async (part_num: string, color_id: number, delta: number) => {
      const k = partKey(part_num, color_id);
      const prev = owned[k] ?? 0;
      const optimistic = Math.max(prev + delta, 0);
      setOwned((m) => ({ ...m, [k]: optimistic }));

      try {
        if (delta > 0) {
          await fetch(`${API_BASE}/api/inventory/add-canonical`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ part_num, color_id, qty: delta }),
          });
        } else if (delta < 0) {
          await fetch(`${API_BASE}/api/inventory/decrement-canonical`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ part_num, color_id, qty: Math.abs(delta) }),
          });
        }
      } catch (err: any) {
        setOwned((m) => ({ ...m, [k]: prev }));
        setError(err?.message || "Failed to update inventory.");
      }
    },
    [owned]
  );

  useEffect(() => {
    void loadParents();
  }, [loadParents]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  // When parent changes: load quickfilters; technic/minifig require child selection
  useEffect(() => {
    const pkey = parentKeyParam || "";
    if (!pkey) return;
    if (lastParentKeyRef.current === pkey) return;
    lastParentKeyRef.current = pkey;

    setSelectedFilter("");
    setTerm("");
    setFiltersLoaded(false);
    setFiltersEmpty(false);
    setAnySizeImages([]);
    setAnySizeIdx(0);
    setVisibleCount(PAGE_SIZE);
    setChildren([]);
    setParts([]);

    if (pkey === "technic") {
      void loadChildren(pkey);
      setParams({ child: null, filter: null, q: null });
      return;
    }

    if (pkey === "minifig") {
      void loadChildren(pkey);
      setParams({ child: null, filter: null, q: null });
      return;
    }

    void loadChildren(pkey);
    void loadQuickFilters(pkey);

    setParams({ child: null, filter: null, q: null });
  }, [parentKeyParam, loadChildren, loadQuickFilters, setParams]);

  useEffect(() => {
    if (parentKeyParam !== "technic") return;
    if (!childPartCatId) return;
    setFiltersLoaded(false);
    setFiltersEmpty(false);
    setAnySizeImages([]);
    setAnySizeIdx(0);
    void loadQuickFilters("technic", "cat", childPartCatId);
  }, [parentKeyParam, childPartCatId, loadQuickFilters]);

  useEffect(() => {
    if (parentKeyParam !== "minifig") return;
    if (!childPartCatId) return;
    setFiltersLoaded(false);
    setFiltersEmpty(false);
    setAnySizeImages([]);
    setAnySizeIdx(0);
    void loadQuickFilters("minifig", "cat", childPartCatId);
  }, [parentKeyParam, childPartCatId, loadQuickFilters]);

  useEffect(() => {
    if (!parentKeyParam) return;
    void loadAnySizeImages(parentKeyParam);
  }, [parentKeyParam, childPartCatId, children, parents, loadAnySizeImages]);

  useEffect(() => {
    if (anySizeImages.length <= 1) return;
    if (isFilterScrolling) return;
    const id = window.setInterval(() => {
      setAnySizeIdx((prev) => (prev + 1) % anySizeImages.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, [anySizeImages, isFilterScrolling]);

  // reflect URL -> state
  useEffect(() => {
    if (filterParam) setSelectedFilter(normKey(filterParam));
    else setSelectedFilter("");

    if (queryParam) setTerm(queryParam);
    else setTerm("");
  }, [filterParam, queryParam]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [term, selectedFilter]);

  const shouldShowGrid = useMemo(() => mode === "grid", [mode]);

  // Grid load: strict (requires resolved child_part_cat_id)
  useEffect(() => {
    if (!shouldShowGrid) return;
    if (!parentKeyParam) return;

    if (parentKeyParam === "minifig") {
      if (!childPartCatId) return;
    } else {
      const resolvedCatId = resolveChildCatId(parentKeyParam);
      if (!resolvedCatId) return;
    }

    void loadPartsByParent(parentKeyParam, selectedFilter, term);
  }, [shouldShowGrid, parentKeyParam, childPartCatId, selectedFilter, term, loadPartsByParent, resolveChildCatId]);

  const openPickColour = useCallback(
    (partNum: string) => {
      const params = new URLSearchParams();
      const pkey = parentKeyParam || selectedParent?.key;
      if (pkey) {
        params.set("parent_key", pkey);
        params.set("cat", pkey);
      }
      if (childParam) params.set("child", childParam);
      if (selectedFilter) params.set("filter", selectedFilter);
      if (term.trim()) params.set("q", term.trim());
      const qs2 = params.toString();
      navigate(`/inventory/add/bricks/part/${encodeURIComponent(partNum)}${qs2 ? `?${qs2}` : ""}`);
    },
    [navigate, selectedParent, parentKeyParam, childParam, selectedFilter, term]
  );

  const breadcrumb = useMemo(() => {
    const partsCrumb: string[] = [];
    if (selectedParent?.label) partsCrumb.push(selectedParent.label);
    if (selectedFilter) partsCrumb.push(selectedFilter === "all" ? "Any size" : selectedFilter);
    return partsCrumb.join(" → ");
  }, [selectedParent, selectedFilter]);

  return (
    <div className="a2b-page a2b-page-inventory-add-brick">
      <PageHero
        title="Add Bricks"
        subtitle={selectedParent ? `Category: ${selectedParent.label}` : "Pick a category to start"}
        left={
          <button type="button" className="a2b-hero-button a2b-cta-dark" onClick={() => navigate("/inventory/add")}>
            ← Back to categories
          </button>
        }
      >
        <div style={{ marginTop: "0.65rem", maxWidth: 720 }}>
          <input
            value={term}
            onChange={(e) => {
              const next = e.target.value;
              setTerm(next);
              setParams({ q: next || null });
            }}
            placeholder="Search part number or name"
            style={{
              width: "100%",
              borderRadius: 14,
              padding: "0.8rem 1rem",
              border: "1px solid rgba(255,255,255,0.35)",
              outline: "none",
              fontSize: "1rem",
            }}
          />
        </div>
      </PageHero>

      <div className="a2b-conveyor-crumb">
        {breadcrumb ? <span>{breadcrumb}</span> : <span>Pick a category below</span>}
        <button
          type="button"
          className="a2b-crumb-back"
          onClick={() => {
            if (selectedFilter) {
              setSelectedFilter("");
              setParams({ filter: null });
              return;
            }
            if (parentKeyParam === "technic" && childParam) {
              setParams({ child: null, filter: null, q: null });
              return;
            }
            if (parentKeyParam === "minifig" && childParam) {
              setParams({ child: null, filter: null, q: null });
              return;
            }
            setParams({ parent_id: null, parent_key: null, cat: null, child: null, filter: null, q: null });
          }}
          disabled={!selectedParent && !parentKeyParam}
        >
          Back
        </button>
      </div>

      {mode === "parents" && parents.length > 0 && (
        <div className="a2b-conveyor a2b-conveyor--tight">
          <div className="a2b-conveyor-track a2b-filter-track" aria-label="Parents">
            {parents.map((parent) => (
              <button
                key={parent.key}
                type="button"
                className={"a2b-filter-tile" + (parentKeyParam === parent.key ? " a2b-filter-tile--active is-selected" : "")}
                onClick={() => {
                  setSelectedFilter("");
                  setTerm("");
                  setParams({
                    parent_id: null,
                    parent_key: parent.key,
                    cat: parent.key,
                    child: null,
                    filter: null,
                    q: null,
                  });
                }}
                aria-label={parent.label}
                title={parent.label}
              >
                <div className="a2b-filter-tile-inner">
                  <div className="a2b-filter-img">
                    {parent.img_url ? (
                      <img src={parent.img_url} alt={parent.label} loading="lazy" decoding="async" />
                    ) : (
                      <div className="a2b-filter-placeholder" />
                    )}
                  </div>
                  <span className="a2b-filter-label">{parent.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "filters" && (
        <div className="a2b-conveyor a2b-conveyor--tight">
          <div className="a2b-conveyor-track a2b-filter-track" aria-label="Filters" onScroll={handleFilterScroll}>
            {quickFilters
              .map((f) => ({ ...f, filter_key: normKey(f.filter_key) }))
              .filter((f) => !!f.filter_key)
              .filter((f) => {
                const k = normKey(f.filter_key);
                const l = normalize(f.label || "");
                if (k === "all-bricks" || k === "all_bricks" || k === "allbricks") return false;
                if (l === "all bricks") return false;
                return true;
              })
              .filter((f, idx, arr) => arr.findIndex((x) => x.filter_key === f.filter_key) === idx)
              .map((f) => {
                const active = normKey(selectedFilter) === f.filter_key;
                const label = f.filter_key === "all" ? "Any size" : f.label;
                const isAnySize = f.filter_key === "all";
                const anySizeImg = isAnySize ? anySizeImages[anySizeIdx] : null;

                return (
                  <button
                    key={f.filter_key}
                    type="button"
                    className={"a2b-filter-tile" + (active ? " a2b-filter-tile--active is-selected" : "")}
                    onClick={() => {
                      setSelectedFilter(f.filter_key);
                      setParams({ filter: f.filter_key });
                    }}
                    aria-label={label}
                    title={label}
                  >
                    <div className="a2b-filter-tile-inner">
                      <div className="a2b-filter-img">
                        {anySizeImg || f.img_url ? (
                          <img src={anySizeImg || f.img_url || ""} alt={label} loading="lazy" decoding="async" />
                        ) : (
                          <div className="a2b-filter-placeholder" />
                        )}
                      </div>
                      <span className="a2b-filter-label">{label}</span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {mode === "children" && parentKeyParam === "technic" && (
        <div className="a2b-conveyor a2b-conveyor--tight">
          <div className="a2b-conveyor-track a2b-filter-track" aria-label="Technic Children">
            {children.map((child) => (
              <button
                key={child.part_cat_id}
                className="a2b-filter-tile"
                onClick={() => {
                  setParams({ child: String(child.part_cat_id), filter: null, q: null });
                }}
              >
                <div className="a2b-filter-tile-inner">
                  <div className="a2b-filter-img">
                    {child.img_url ? <img src={child.img_url} alt={child.label} /> : <div className="a2b-filter-placeholder" />}
                  </div>
                  <span className="a2b-filter-label">{child.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "children" && parentKeyParam === "minifig" && (
        <div className="a2b-conveyor a2b-conveyor--tight">
          <div className="a2b-conveyor-track a2b-filter-track" aria-label="Minifig Children">
            {children.map((child) => (
              <button
                key={child.part_cat_id}
                className="a2b-filter-tile"
                onClick={() => {
                  setParams({ child: String(child.part_cat_id), filter: null, q: null });
                }}
              >
                <div className="a2b-filter-tile-inner">
                  <div className="a2b-filter-img">
                    {child.img_url ? <img src={child.img_url} alt={child.label} /> : <div className="a2b-filter-placeholder" />}
                  </div>
                  <span className="a2b-filter-label">{child.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <div style={{ padding: "0.75rem" }}>Loading…</div>}
      {error && <div style={{ padding: "0.75rem", color: "#dc2626" }}>{error}</div>}

      {mode === "grid" && parentKeyParam && !loading && !error && (
        <div style={{ marginTop: "0.75rem" }}>
          {!shouldShowGrid ? (
            <div className="a2b-placeholder-panel">Pick a filter above to see parts.</div>
          ) : filteredParts.length === 0 ? (
            <div style={{ padding: "0.75rem", color: "#64748b" }}>No parts found.</div>
          ) : (
            <>
              <div className="parts-grid" style={{ marginBottom: "1rem" }}>
                {visibleParts.map((p) => {
                  const colorCount = Number(p.color_count ?? 0);
                  const isSingle = colorCount === 1 && Number.isFinite(p.default_color_id as number);
                  const colorId = isSingle ? Number(p.default_color_id) : -1;
                  const ownedQty = isSingle ? owned[partKey(p.part_num, colorId)] ?? 0 : 0;
                  const imgUrl = p.default_img_url;
                  const showTextTile = !imgUrl && term.trim().length > 0;

                  const tile = showTextTile ? (
                    <div className="a2b-text-tile">
                      <div className="a2b-text-tile-header">
                        <div className="a2b-text-tile-num">{p.part_num}</div>
                        {isSingle ? (
                          <div className="a2b-text-tile-qty">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                changeQty(p.part_num, colorId, -1);
                              }}
                              disabled={ownedQty <= 0}
                              aria-label="Decrease"
                            >
                              −
                            </button>
                            <span>{ownedQty}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                changeQty(p.part_num, colorId, 1);
                              }}
                              aria-label="Increase"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <div className="a2b-text-tile-action">Pick colours</div>
                        )}
                      </div>
                      <div className="a2b-text-tile-name">{p.part_name || "Unnamed part"}</div>
                    </div>
                  ) : (
                    <BuildabilityPartsTile
                      part={{
                        part_num: p.part_num,
                        color_id: colorId,
                        part_img_url: (imgUrl ?? null) as any,
                      }}
                      partName={p.part_name ?? null}
                      need={0}
                      have={ownedQty}
                      mode="inventory"
                      editableQty={isSingle}
                      onChangeQty={isSingle ? (delta) => changeQty(p.part_num, colorId, delta) : undefined}
                      showBottomLine={false}
                      showInfoButton={false}
                    />
                  );

                  if (isSingle) {
                    return (
                      <div key={p.part_num} style={{ position: "relative", overflow: "visible", borderRadius: 24 }}>
                        {tile}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={p.part_num}
                      type="button"
                      className="a2b-part-tile-button"
                      onClick={() => openPickColour(p.part_num)}
                      aria-label={`Pick colour for ${p.part_num}`}
                    >
                      {tile}
                    </button>
                  );
                })}
              </div>

              {visibleParts.length < filteredParts.length && (
                <div style={{ display: "flex", justifyContent: "center", paddingBottom: "1rem" }}>
                  <button type="button" className="a2b-hero-button" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const InventoryAddBrickPage: React.FC = () => (
  <RequireAuth pageName="inventory-add-brick">
    <InventoryAddBrickInner />
  </RequireAuth>
);

export default InventoryAddBrickPage;