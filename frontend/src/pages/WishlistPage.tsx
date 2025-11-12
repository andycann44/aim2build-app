import { useCallback, useEffect, useMemo, useState } from 'react';
import SetTile from '../components/SetTile';
import { apiClient } from '../api/client';

type WishlistEntry = {
  set_num: string;
  name?: string | null;
  year?: number | null;
  num_parts?: number | null;
  img_url?: string | null;
};

type WishlistResponse = {
  sets?: WishlistEntry[];
};

function normalizeWishlist(payload: WishlistResponse): WishlistEntry[] {
  if (Array.isArray(payload.sets)) {
    return payload.sets;
  }
  return [];
}

export default function WishlistPage(): JSX.Element {
  const [entries, setEntries] = useState<WishlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWishlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiClient.get<WishlistResponse>('/api/wishlist');
      setEntries(normalizeWishlist(payload));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load wishlist.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <section className="panel">
      <header>
        <h2>Wishlist</h2>
        <p>Sets you're watching. Wishlist tiles are view-only.</p>
      </header>

      {error ? <p className="status error">{error}</p> : null}
      {loading ? <p className="status">Loading wishlist…</p> : null}
      {!loading && sortedEntries.length === 0 ? (
        <p className="empty-state">Wishlist is empty. Use search to add the sets you want.</p>
      ) : null}

      <div className="tile-grid">
        {sortedEntries.map((entry) => (
          <SetTile key={entry.set_num} {...entry} />
        ))}
      </div>
    </section>
  );
}
