import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../api/client';

type MissingPart = {
  part_num: string;
  color_id: number;
  quantity?: number;
  needed?: number;
  have?: number;
  missing?: number;
};

type BuildabilityResponse = {
  set_num: string;
  name?: string;
  coverage: number;
  total_needed: number;
  display_total?: number | null;
  total_have: number;
  missing_parts: MissingPart[];
};

function computeMissing(part: MissingPart): { required: number; have: number; missing: number } {
  const required = part.needed ?? part.quantity ?? 0;
  const have = part.have ?? (required - (part.missing ?? 0));
  const normalizedHave = Number.isFinite(have) ? Math.max(have, 0) : 0;
  const missing = part.missing ?? Math.max(required - normalizedHave, 0);
  return {
    required,
    have: normalizedHave,
    missing
  };
}

const suggestedSets = ['21330-1', '71819-1', '21318-1'];

export default function BuildabilityChecker(): JSX.Element {
  const [setId, setSetId] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BuildabilityResponse | null>(null);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => () => abortController.current?.abort(), []);

  const fetchBuildability = useCallback(
    async (requestedSet: string) => {
      const trimmed = requestedSet.trim();
      if (!trimmed) {
        setStatus('idle');
        setError('Enter a set number, e.g. 21330-1.');
        setResult(null);
        return;
      }

      abortController.current?.abort();
      const controller = new AbortController();
      abortController.current = controller;

      setStatus('loading');
      setError(null);

      try {
        const data = await apiClient.get<BuildabilityResponse>(
          `${API_BASE}/api/buildability/compare?set=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        setResult(data);
        setStatus('success');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setStatus('error');
        setResult(null);
        setError(err instanceof Error ? err.message : 'Unable to fetch buildability.');
      }
    },
    []
  );

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void fetchBuildability(setId);
    },
    [fetchBuildability, setId]
  );

  const coverage = useMemo(() => {
    if (!result) {
      return 0;
    }
    const ratio = Number.isFinite(result.coverage) ? result.coverage : 0;
    if (ratio > 1) {
      return Math.min(ratio / 100, 1);
    }
    return Math.max(Math.min(ratio, 1), 0);
  }, [result]);

  const coverageLabel = useMemo(() => `${(coverage * 100).toFixed(1)}%`, [coverage]);

  return (
    <section>
      <h2>
        <span>🛠️</span> Buildability check
      </h2>
      <form onSubmit={onSubmit} className="form-row">
        <label htmlFor="set-id" style={{ flex: '1 1 220px' }}>
          Set number
          <input
            id="set-id"
            name="set-id"
            placeholder="e.g. 21330-1"
            value={setId}
            onChange={(event) => setSetId(event.target.value)}
            autoComplete="off"
          />
          <small className="help-text">Latest inventory version is used automatically.</small>
        </label>
        <button type="submit" style={{ alignSelf: 'flex-end', minWidth: '140px' }}>
          {status === 'loading' ? 'Checking…' : 'Check buildability'}
        </button>
      </form>

      {status === 'error' && error ? (
        <p className="status error">{error}</p>
      ) : status === 'success' && result ? (
        <div>
          <p className="status success">
            {result.name ? `${result.name} — ` : ''}
            Coverage {coverageLabel} ({result.total_have} / {result.total_needed} parts)

            <div className="muted" style={{ marginTop: 6 }}>
              <div>Required parts (no spares/figs): {result.total_needed.toLocaleString()}</div>
              {typeof result.display_total === "number" ? (
                <div>Box parts: {result.display_total.toLocaleString()}</div>
              ) : null}
            </div>

          </p>
          <div className="coverage-meter" aria-label={`Coverage ${coverageLabel}`}>
            <div className="coverage-bar">
              <span style={{ width: coverageLabel }} />
            </div>
            <span className="badge">{coverageLabel}</span>
          </div>

          {result.missing_parts.length === 0 ? (
            <p className="status success">You have everything you need to build this set!</p>
          ) : (
            <div>
              <h3>Missing parts</h3>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Part #</th>
                    <th scope="col">Color</th>
                    <th scope="col">Required</th>
                    <th scope="col">Have</th>
                    <th scope="col">Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {result.missing_parts.map((part) => {
                    const metrics = computeMissing(part);
                    return (
                      <tr key={`${part.part_num}-${part.color_id}`}>
                        <td>{part.part_num}</td>
                        <td>{part.color_id}</td>
                        <td>{metrics.required}</td>
                        <td>{metrics.have}</td>
                        <td>{metrics.missing}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {status === 'idle' && (
        <p className="status">Try one of these sets: {suggestedSets.join(', ')}.</p>
      )}

      {status === 'loading' && <p className="status">Looking up inventory coverage…</p>}
    </section>
  );
}
