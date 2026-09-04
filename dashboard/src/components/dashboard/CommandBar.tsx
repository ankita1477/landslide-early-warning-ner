import type { Health, Tier } from "../../api/client";
import { TIER_COLOR } from "../../theme";

interface Props {
  counts: { tier: Tier; n: number }[];
  activeBands: Tier[];
  onToggleBand: (band: Tier) => void;
  health: Health | null;
  computedAt: string | null;
  stale: boolean;
  onBack: () => void;
  highContrast: boolean;
  onToggleContrast: () => void;
  onShortcuts: () => void;
}

function scoredLabel(iso: string | null) {
  if (!iso) return "—";
  // Scores are produced in UTC; the corridor is operated in IST.
  const ist = new Date(new Date(iso + "Z").getTime() + 5.5 * 3600 * 1000);
  const day = ist.toUTCString().slice(5, 16);
  const time = ist.toISOString().slice(11, 16);
  return `${day} · ${time} IST`;
}

export function CommandBar({
  counts, activeBands, onToggleBand, health, computedAt, stale, onBack,
  highContrast, onToggleContrast, onShortcuts,
}: Props) {
  return (
    <header className="command-bar">
      <div className="cb-left">
        <button className="icon-btn" onClick={onBack} aria-label="Back to the overview">
          ‹
        </button>
        <div>
          <h1>NH-10 Landslide Risk</h1>
          <p className="cb-sub mono">Sevoke – Gangtok corridor · 109.6 km</p>
        </div>
      </div>

      <div className="cb-center" role="group" aria-label="Filter by risk band">
        {counts.map(({ tier, n }) => {
          const on = activeBands.includes(tier);
          return (
            <button
              key={tier}
              className={on ? "band-chip on" : "band-chip off"}
              style={{ ["--band" as string]: TIER_COLOR[tier] }}
              onClick={() => onToggleBand(tier)}
              aria-pressed={on}
            >
              <span className="chip-dot" aria-hidden="true" />
              <span className="chip-label">{tier}</span>
              <span className={on ? "chip-n mono" : "chip-n mono struck"}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="cb-right">
        <span className="scored mono" title="Last scoring run">
          last scored {scoredLabel(computedAt)}
        </span>
        <span className={stale ? "status stale" : "status live"}>
          <span className="status-dot" aria-hidden="true" />
          {stale ? (
            <>stale · <span className="wide-only">last good run</span></>
          ) : (
            <>
              ok<span className="wide-only"> · {health?.segments_loaded ?? 0} segments</span>
            </>
          )}
        </span>
        <button
          className="icon-btn"
          onClick={onToggleContrast}
          aria-pressed={highContrast}
          title="High-contrast bands: order by lightness alone"
        >
          ◐
        </button>
        <button className="icon-btn" onClick={onShortcuts} aria-label="Keyboard shortcuts">
          ?
        </button>
      </div>
    </header>
  );
}
