import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';

type InventoryPart = {
  part_num: string;
  color_id: number;
  qty_total: number;
};

export default function InventoryPage(): JSX.Element {
  const [inventory, setInventory] = useState<InventoryPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<InventoryPart[]>('/api/inventory/parts');
      setInventory(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load inventory.');
      setInventory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const sortedInventory = useMemo(
    () =>
      [...inventory].sort((a, b) => {
        const byPart = a.part_num.localeCompare(b.part_num);
        if (byPart !== 0) {
          return byPart;
        }
        return a.color_id - b.color_id;
      }),
    [inventory]
  );

  return (
    <section className="panel">
      <header>
        <h2>Inventory</h2>
        <p>Your brick holdings, grouped by part and color. Refresh updates buildability instantly.</p>
        <button type="button" className="secondary" onClick={() => void loadInventory()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {error ? <p className="status error">{error}</p> : null}
      {loading ? <p className="status">Loading inventory…</p> : null}
      {!loading && sortedInventory.length === 0 ? (
        <p className="empty-state">Inventory is empty. Add parts from My Sets to get started.</p>
      ) : null}

      <div className="inventory-grid">
        {sortedInventory.map((part) => (
          <div key={`${part.part_num}-${part.color_id}`} className="inventory-tile">
            <header>
              <strong>{part.part_num}</strong>
              <span className="badge">{part.qty_total}</span>
            </header>
            <p>Color {part.color_id}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
