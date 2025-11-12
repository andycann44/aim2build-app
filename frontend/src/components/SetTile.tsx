import { ReactNode } from 'react';

type SetTileProps = {
  set_num: string;
  name?: string | null;
  year?: number | null;
  num_parts?: number | null;
  img_url?: string | null;
  coverage?: number | null;
  actions?: ReactNode;
  onDoubleClick?: () => void;
};

function formatCoverage(value: number | null | undefined): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  const ratio = value > 1 ? value / 100 : value;
  const clamped = Math.max(0, Math.min(1, ratio));
  return `${(clamped * 100).toFixed(0)}%`;
}

export default function SetTile({
  set_num,
  name,
  year,
  num_parts,
  img_url,
  coverage,
  actions,
  onDoubleClick
}: SetTileProps): JSX.Element {
  const coverageLabel = formatCoverage(coverage ?? null);

  return (
    <article
      className="set-tile"
      onDoubleClick={onDoubleClick}
      tabIndex={onDoubleClick ? 0 : -1}
      onKeyDown={(event) => {
        if (!onDoubleClick) {
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onDoubleClick();
        }
      }}
      role={onDoubleClick ? 'button' : undefined}
      aria-label={onDoubleClick ? `Open parts for ${name ?? set_num}` : undefined}
    >
      {img_url ? (
        <img src={img_url} alt={name ?? set_num} loading="lazy" />
      ) : (
        <div className="fallback" aria-hidden="true">
          <span>{set_num}</span>
        </div>
      )}
      <div className="content">
        <header>
          <h3>{name ?? set_num}</h3>
          {coverageLabel ? <span className="badge">{coverageLabel}</span> : null}
        </header>
        <dl>
          <div>
            <dt>Set #</dt>
            <dd>{set_num}</dd>
          </div>
          {year ? (
            <div>
              <dt>Year</dt>
              <dd>{year}</dd>
            </div>
          ) : null}
          {num_parts ? (
            <div>
              <dt>Parts</dt>
              <dd>{num_parts}</dd>
            </div>
          ) : null}
        </dl>
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </article>
  );
}
