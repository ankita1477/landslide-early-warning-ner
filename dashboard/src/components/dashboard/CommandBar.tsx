import { ArrowLeft, Contrast, Keyboard, Table2 } from "lucide-react";
import { Switch, ToggleGroup, Tooltip } from "radix-ui";
import type { Health, Tier } from "../../api/client";
import { TIER_COLOR, TIER_WORD } from "../../theme";
import { Mark } from "../Mark";
import { CORRIDOR } from "../../lib/corridor";
import { ThemeToggle } from "../ThemeToggle";
import type { ThemeMode } from "../../lib/themeMode";

interface Props {
  counts: { tier: Tier; n: number }[];
  activeBands: Tier[];
  onBands: (bands: Tier[]) => void;
  health: Health | null;
  computedAt: string | null;
  stale: boolean;
  onBack: () => void;
  highContrast: boolean;
  onToggleContrast: () => void;
  onShortcuts: () => void;
  onTable: () => void;
  themeMode: ThemeMode;
  onThemeMode: (m: ThemeMode) => void;
}

function scoredLabel(iso: string | null) {
  if (!iso) return "—";
  // Scores are produced in UTC; the corridor is operated in IST.
  const ist = new Date(new Date(iso + "Z").getTime() + 5.5 * 3600 * 1000);
  return `${ist.toUTCString().slice(5, 16)} · ${ist.toISOString().slice(11, 16)} IST`;
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tip" sideOffset={6}>{label}<Tooltip.Arrow className="tip-arrow" /></Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function CommandBar({
  counts, activeBands, onBands, health, computedAt, stale, onBack,
  highContrast, onToggleContrast, onShortcuts, onTable, themeMode, onThemeMode,
}: Props) {
  return (
    <header className="command-bar">
      <div className="cb-left">
        <Tip label="Back to the overview">
          <button className="icon-btn" onClick={onBack} aria-label="Back to the overview">
            <ArrowLeft size={16} />
          </button>
        </Tip>
        <span className="brand"><Mark size={20} /> Landsafe <em>NER</em></span>
        <span className="cb-sub mono">NH-10 · Sevoke–Gangtok · {CORRIDOR.lengthKm} km</span>
      </div>

      <ToggleGroup.Root type="multiple" value={activeBands} className="bands"
                        aria-label="Filter by risk band"
                        onValueChange={(v) => onBands(v as Tier[])}>
        {counts.map(({ tier, n }) => (
          <ToggleGroup.Item key={tier} value={tier} className="band"
                            style={{ ["--band" as string]: TIER_COLOR[tier] }}>
            <span className="band-dot" aria-hidden="true" />
            <span className="band-word">{TIER_WORD[tier]}</span>
            <span className="band-n mono">{n}</span>
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>

      <div className="cb-right">
        <Tip label="The API serves a single scored run; per-day history is not stored yet">
          <span className="scored mono">{scoredLabel(computedAt)}</span>
        </Tip>
        {/* Until the first answer arrives the API may simply be waking up (a
            free host sleeps when idle), so this says so instead of "live · 0". */}
        <span className={stale ? "status stale" : health ? "status live" : "status waking"}>
          <span className="status-dot" aria-hidden="true" />
          {stale ? "stale"
            : health ? <>live<span className="wide-only"> · {health.segments_loaded} segments</span></>
            : <>connecting<span className="wide-only"> · waking the server</span></>}
        </span>
        <Tip label="High-contrast bands: order by lightness alone">
          <label className="switch-row">
            <Contrast size={15} />
            <Switch.Root className="switch" checked={highContrast} onCheckedChange={onToggleContrast}
                         aria-label="High-contrast bands">
              <Switch.Thumb className="switch-thumb" />
            </Switch.Root>
          </label>
        </Tip>
        <ThemeToggle mode={themeMode} onMode={onThemeMode} />
        <Tip label="All segments as a table (t)">
          <button className="icon-btn" onClick={onTable} aria-label="Table view"><Table2 size={16} /></button>
        </Tip>
        <Tip label="Keyboard shortcuts (?)">
          <button className="icon-btn" onClick={onShortcuts} aria-label="Keyboard shortcuts"><Keyboard size={16} /></button>
        </Tip>
      </div>
    </header>
  );
}
