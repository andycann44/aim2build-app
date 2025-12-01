import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';

type WishlistEntry = {
  set_num: string;
  name?: string;
  year?: number;
  img_url?: string;
};

type WishlistResponse = {
  sets: WishlistEntry[];
};

export default function WishlistPanel(): JSX.Element {
  const [entries, setEntries] = useState<WishlistEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [input, setInput] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  const loadWishlist = useCallback(
    async (options: { showSpinner?: boolean } = {}) => {
      const { showSpinner = true } = options;
      if (showSpinner) {
        setLoading(true);
      }
      setError(null);
      try {
        const data = await apiClient.get<WishlistResponse>('/api/wishlist');
        setEntries(data.sets ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load wishlist.');
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void loadWishlist();
  }, [loadWishlist]);

  const sortedEntries = useMemo(
    () =>
      [...entries].sort((a, b) => {
        const byYear = (b.year ?? 0) - (a.year ?? 0);
        if (byYear !== 0) {
          return byYear;
        }
        return a.set_num.localeCompare(b.set_num);
      }),
    [entries]
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
        await apiClient.post(`/api/wishlist/add?set=${encodeURIComponent(trimmed)}`);
        setMessage(`Added set ${trimmed} to your wishlist.`);
        setInput('');
        await loadWishlist({ showSpinner: false });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add set.');
      } finally {
        setBusy(false);
      }
    },
    [input, loadWishlist]
  );

  const handleRemove = useCallback(
    async (setNum: string) => {
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        await apiClient.delete(`/api/wishlist/remove?set=${encodeURIComponent(setNum)}`);
        setMessage(`Removed set ${setNum} from your wishlist.`);
        await loadWishlist({ showSpinner: false });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove set.');
      } finally {
        setBusy(false);
      }
    },
    [loadWishlist]
  );

  return (
    <article className="list-card">
      <header>
        <h3>Wishlist</h3>
        <p className="status">Keep track of the sets you want to build next.</p>
      </header>

      <form onSubmit={handleAdd} className="form-row" aria-label="Add set to wishlist">
        <label htmlFor="wishlist-id" style={{ flex: '1 1 auto' }}>
          Set number
          <input
            id="wishlist-id"
            name="wishlist-id"
            placeholder="e.g. 75313"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            autoComplete="off"
          />
        </label>
        <button type="submit" disabled={busy} style={{ alignSelf: 'flex-end', minWidth: '120px' }}>
          {busy ? 'Saving…' : 'Add to wishlist'}
        </button>
      </form>

      {error && <p className="status error">{error}</p>}
      {message && <p className="status success">{message}</p>}

      {loading ? (
        <p className="status">Loading wishlist…</p>
      ) : sortedEntries.length === 0 ? (
        <p className="empty-state">Wishlist is empty. Add a dream set above.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sortedEntries.map((entry) => (
            <li key={entry.set_num} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              {entry.img_url ? (
                <img
                  src={entry.img_url}
                  alt={entry.name ?? entry.set_num}
                  style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '0.5rem', flexShrink: 0 }}
                />
              ) : (
                <div
                  aria-hidden="true"
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '0.5rem',
                    background: '#fff7ed',
                    border: '1px dashed #f97316',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 600,
                    color: '#ea580c'
                  }}
                >
                  {entry.set_num}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <strong>{entry.name ?? entry.set_num}</strong>
                <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                  {entry.year ? `${entry.year} release` : 'Year unknown'}
                </div>
              </div>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  void handleRemove(entry.set_num);
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
