import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';

type MySet = {
  set_num: string;
  name?: string;
  year?: number;
  num_parts?: number;
  img_url?: string;
};

type MySetsResponse = {
  sets: MySet[];
};

export default function MySetsPanel(): JSX.Element {
  const [sets, setSets] = useState<MySet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [input, setInput] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  const loadSets = useCallback(
    async (options: { showSpinner?: boolean } = {}) => {
      const { showSpinner = true } = options;
      if (showSpinner) {
        setLoading(true);
      }
      setError(null);
      try {
        const data = await apiClient.get<MySetsResponse>('/api/mysets');
        setSets(data.sets ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load My Sets.');
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    []
  );

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

  const handleAdd = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = input.trim();
      if (!trimmed) {
        setError('Enter a set number to add.');
        return;
      }
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        await apiClient.post(`/api/mysets/add?set=${encodeURIComponent(trimmed)}`);
        setMessage(`Added set ${trimmed} to My Sets.`);
        setInput('');
        await loadSets({ showSpinner: false });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add set.');
      } finally {
        setBusy(false);
      }
    },
    [input, loadSets]
  );

  const handleRemove = useCallback(
    async (setNum: string) => {
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        await apiClient.delete(`/api/mysets/remove?set=${encodeURIComponent(setNum)}`);
        setMessage(`Removed set ${setNum} from My Sets.`);
        await loadSets({ showSpinner: false });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove set.');
      } finally {
        setBusy(false);
      }
    },
    [loadSets]
  );

  return (
    <article className="list-card">
      <header>
        <h3>My Sets</h3>
        <p className="status">
          Catalog your owned sets. The backend resolves dashed or plain IDs automatically.
        </p>
      </header>

      <form onSubmit={handleAdd} className="form-row" aria-label="Add set to My Sets">
        <label htmlFor="myset-id" style={{ flex: '1 1 auto' }}>
          Set number
          <input
            id="myset-id"
            name="myset-id"
            placeholder="e.g. 21330-1"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            autoComplete="off"
          />
        </label>
        <button type="submit" disabled={busy} style={{ alignSelf: 'flex-end', minWidth: '120px' }}>
          {busy ? 'Saving…' : 'Add to My Sets'}
        </button>
      </form>

      {error && <p className="status error">{error}</p>}
      {message && <p className="status success">{message}</p>}

      {loading ? (
        <p className="status">Loading your collection…</p>
      ) : sortedSets.length === 0 ? (
        <p className="empty-state">No sets yet. Add one above to start tracking.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sortedSets.map((set) => (
            <li key={set.set_num} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              {set.img_url ? (
                <img
                  src={set.img_url}
                  alt={set.name ?? set.set_num}
                  style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '0.5rem', flexShrink: 0 }}
                />
              ) : (
                <div
                  aria-hidden="true"
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '0.5rem',
                    background: '#eef2ff',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 600,
                    color: '#4338ca'
                  }}
                >
                  {set.set_num}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <strong>{set.name ?? set.set_num}</strong>
                <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                  {set.year ? `${set.year} • ` : ''}
                  {set.num_parts ? `${set.num_parts} parts` : 'Parts unknown'}
                </div>
              </div>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  void handleRemove(set.set_num);
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
