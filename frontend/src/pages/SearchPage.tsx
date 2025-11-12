import { FormEvent, useCallback, useMemo, useState } from 'react';
import SetTile from '../components/SetTile';
import { apiClient } from '../api/client';

type CatalogSet = {
  set_num: string;
  name?: string | null;
  year?: number | null;
  num_parts?: number | null;
  img_url?: string | null;
};

type SearchResponse = {
  results?: CatalogSet[];
  sets?: CatalogSet[];
};

type CoverageSummary = {
  set_num: string;
  coverage: number;
};

type FeedbackState = { kind: 'success' | 'error'; message: string } | null;

function normalizeResults(payload: SearchResponse): CatalogSet[] {
  if (Array.isArray(payload.results)) {
    return payload.results;
  }
  if (Array.isArray(payload.sets)) {
    return payload.sets;
  }
  return [];
}

export default function SearchPage(): JSX.Element {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CatalogSet[]>([]);
  const [coverage, setCoverage] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const handleSearch = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) {
        setResults([]);
        setCoverage({});
        setFeedback({ kind: 'error', message: 'Enter a search term such as "Modular" or a set number.' });
        return;
      }

      setLoading(true);
      setFeedback(null);

      try {
        const payload = await apiClient.get<SearchResponse>(
          `/api/catalog/search?q=${encodeURIComponent(trimmed)}&limit=24`
        );
        const sets = normalizeResults(payload);
        setResults(sets);

        if (sets.length > 0) {
          const setNums = sets.map((set) => set.set_num);
          try {
            const coverageResponse = await apiClient.post<CoverageSummary[]>(
              '/api/buildability/compare_many',
              { sets: setNums }
            );
            const bySet = Object.fromEntries(
              coverageResponse.map((entry) => [entry.set_num, entry.coverage])
            );
            setCoverage(bySet);
          } catch (error) {
            console.error('Failed to load coverage badges', error);
            setCoverage({});
          }
        } else {
          setCoverage({});
        }
      } catch (error) {
        console.error(error);
        setFeedback({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Search failed. Please try again.'
        });
        setResults([]);
        setCoverage({});
      } finally {
        setLoading(false);
      }
    },
    [query]
  );

  const handleAdd = useCallback(async (setNum: string, target: 'mysets' | 'wishlist') => {
    setFeedback(null);
    try {
      const endpoint = target === 'mysets' ? '/api/mysets/add' : '/api/wishlist/add';
      await apiClient.post(`${endpoint}?set=${encodeURIComponent(setNum)}`);
      setFeedback({
        kind: 'success',
        message:
          target === 'mysets'
            ? `Set ${setNum} added to My Sets.`
            : `Set ${setNum} added to your wishlist.`
      });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Request failed. Please try again.'
      });
    }
  }, []);

  const noResultsMessage = useMemo(() => {
    if (loading) {
      return 'Searching the LEGO® catalog…';
    }
    if (results.length === 0 && query.trim().length > 0) {
      return 'No sets found. Try another keyword or set number.';
    }
    return null;
  }, [loading, query, results.length]);

  return (
    <section className="panel">
      <header>
        <h2>Find a set</h2>
        <p>Search the Aim2Build catalog and add sets to your collection or wishlist.</p>
      </header>
      <form className="form-row" onSubmit={handleSearch}>
        <label htmlFor="search-term" className="field">
          Search term
          <input
            id="search-term"
            name="search-term"
            placeholder="21330-1 or Millennium Falcon"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {feedback ? (
        <p className={`status ${feedback.kind === 'error' ? 'error' : 'success'}`}>{feedback.message}</p>
      ) : null}

      {noResultsMessage ? <p className="status">{noResultsMessage}</p> : null}

      <div className="tile-grid">
        {results.map((set) => (
          <SetTile
            key={set.set_num}
            {...set}
            coverage={coverage[set.set_num]}
            actions={
              <div className="action-buttons">
                <button type="button" onClick={() => void handleAdd(set.set_num, 'mysets')}>
                  Add to My Sets
                </button>
                <button type="button" className="secondary" onClick={() => void handleAdd(set.set_num, 'wishlist')}>
                  Add to Wishlist
                </button>
              </div>
            }
          />
        ))}
      </div>
    </section>
  );
}
