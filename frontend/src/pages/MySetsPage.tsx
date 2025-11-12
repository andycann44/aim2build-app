import { useCallback, useEffect, useMemo, useState } from 'react';
import SetTile from '../components/SetTile';
import { apiClient } from '../api/client';

type MySet = {
  set_num: string;
  name?: string | null;
  year?: number | null;
  num_parts?: number | null;
  img_url?: string | null;
};

type MySetsResponse = {
  sets?: MySet[];
};

type PartsResponse = {
  set_num: string;
  parts: { part_num: string; color_id: number; quantity: number }[];
};

type InventoryPart = {
  part_num: string;
  color_id: number;
  qty_total: number;
};

type FeedbackState = { kind: 'success' | 'error'; message: string } | null;

type PartsModalState =
  | null
  | {
      set: MySet;
      loading: boolean;
      error: string | null;
      parts: PartsResponse['parts'];
    };

function normalizeSets(payload: MySetsResponse): MySet[] {
  if (Array.isArray(payload.sets)) {
    return payload.sets;
  }
  return [];
}

export default function MySetsPage(): JSX.Element {
  const [sets, setSets] = useState<MySet[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [partsModal, setPartsModal] = useState<PartsModalState>(null);
  const [busySet, setBusySet] = useState<string | null>(null);

  const loadSets = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const payload = await apiClient.get<MySetsResponse>('/api/mysets');
      setSets(normalizeSets(payload));
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Failed to load My Sets.'
      });
      setSets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSets();
  }, [loadSets]);

  const sortedSets = useMemo(
    () =>
      [...sets].sort((a, b) => {
        const byYear = (b.year ?? 0) - (a.year ?? 0);
        if (byYear !== 0) {
          return byYear;
        }
        return a.set_num.localeCompare(b.set_num);
      }),
    [sets]
  );

  const openPartsModal = useCallback(async (entry: MySet) => {
    setPartsModal({ set: entry, loading: true, error: null, parts: [] });
    try {
      const response = await apiClient.get<PartsResponse>(
        `/api/catalog/parts?set=${encodeURIComponent(entry.set_num)}`
      );
      setPartsModal({ set: entry, loading: false, error: null, parts: response.parts ?? [] });
    } catch (error) {
      setPartsModal({
        set: entry,
        loading: false,
        parts: [],
        error: error instanceof Error ? error.message : 'Failed to load parts list.'
      });
    }
  }, []);

  const closePartsModal = useCallback(() => setPartsModal(null), []);

  const handleAddToInventory = useCallback(
    async (entry: MySet) => {
      setBusySet(entry.set_num);
      setFeedback(null);
      try {
        const [partsResponse, inventory] = await Promise.all([
          apiClient.get<PartsResponse>(`/api/catalog/parts?set=${encodeURIComponent(entry.set_num)}`),
          apiClient.get<InventoryPart[]>('/api/inventory/parts')
        ]);

        const combined = new Map<string, InventoryPart>();

        for (const row of inventory) {
          const key = `${row.part_num}-${row.color_id}`;
          combined.set(key, { ...row });
        }

        for (const part of partsResponse.parts ?? []) {
          const key = `${part.part_num}-${part.color_id}`;
          const existing = combined.get(key);
          const qty_total = (existing?.qty_total ?? 0) + (part.quantity ?? 0);
          combined.set(key, {
            part_num: part.part_num,
            color_id: part.color_id,
            qty_total
          });
        }

        await apiClient.post('/api/inventory/replace', Array.from(combined.values()));
        setFeedback({
          kind: 'success',
          message: `Added inventory for set ${entry.set_num}.`
        });
      } catch (error) {
        setFeedback({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unable to add parts to inventory.'
        });
      } finally {
        setBusySet(null);
      }
    },
    []
  );

  return (
    <section className="panel">
      <header>
        <h2>My Sets</h2>
        <p>Sets you own. Double-click a tile to inspect the part list.</p>
      </header>

      {feedback ? (
        <p className={`status ${feedback.kind === 'error' ? 'error' : 'success'}`}>{feedback.message}</p>
      ) : null}

      {loading ? <p className="status">Loading your sets…</p> : null}
      {!loading && sortedSets.length === 0 ? (
        <p className="empty-state">No sets yet. Use search to add your first set.</p>
      ) : null}

      <div className="tile-grid">
        {sortedSets.map((set) => (
          <SetTile
            key={set.set_num}
            {...set}
            onDoubleClick={() => void openPartsModal(set)}
            actions={
              <button
                type="button"
                onClick={() => void handleAddToInventory(set)}
                disabled={busySet === set.set_num}
              >
                {busySet === set.set_num ? 'Adding…' : 'Add to Inventory'}
              </button>
            }
          />
        ))}
      </div>

      {partsModal ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <header>
              <h3>Parts in {partsModal.set.name ?? partsModal.set.set_num}</h3>
              <button type="button" className="secondary" onClick={closePartsModal}>
                Close
              </button>
            </header>
            {partsModal.loading ? <p className="status">Loading parts…</p> : null}
            {partsModal.error ? <p className="status error">{partsModal.error}</p> : null}
            {!partsModal.loading && !partsModal.error ? (
              <div className="parts-grid">
                {partsModal.parts.length === 0 ? (
                  <p className="empty-state">No part data available for this set.</p>
                ) : (
                  partsModal.parts.map((part) => (
                    <div className="part-tile" key={`${part.part_num}-${part.color_id}`}>
                      <span className="badge">{part.color_id}</span>
                      <strong>{part.part_num}</strong>
                      <span>{part.quantity}×</span>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
