import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import type { SegmentSummary } from "../../lib/useDashboardState";
import { TIER_WORD } from "../../theme";
import facts from "../../data/segments.json";

type Facts = Record<string, Record<string, number | string | null>>;

/** The text equivalent of everything on screen.
 *
 *  This is what makes the colour-dependent encodings legal rather than merely
 *  mitigated: every value the charts show is reachable here as text.
 */
export function TableView({ segments, open, onOpenChange }: {
  segments: SegmentSummary[]; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const f = facts as Facts;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="modal table-modal" aria-describedby={undefined}>
          <div className="modal-head">
            <Dialog.Title className="modal-title">All segments</Dialog.Title>
            <span className="mono tiny">{segments.length} rows</span>
            <Dialog.Close asChild><button className="icon-btn" aria-label="Close"><X size={16} /></button></Dialog.Close>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">km</th><th scope="col">Band</th><th scope="col">Risk</th>
                  <th scope="col">Slope°</th><th scope="col">Aspect°</th>
                  <th scope="col">Elev m</th><th scope="col">TWI</th>
                  <th scope="col">Scars &lt;500 m</th><th scope="col">InSAR</th>
                </tr>
              </thead>
              <tbody>
                {[...segments].sort((a, b) => a.chainage_km - b.chainage_km).map((s) => {
                  const t = f[String(s.chainage_km)] ?? {};
                  return (
                    <tr key={s.id}>
                      <td className="mono">{s.chainage_km.toFixed(3)}</td>
                      <td>{TIER_WORD[s.tier]}</td>
                      <td className="mono">{s.risk.toFixed(5)}</td>
                      <td className="mono">{t.slope_deg ?? "—"}</td>
                      <td className="mono">{t.aspect_deg ?? "—"}</td>
                      <td className="mono">{t.elevation_m ?? "—"}</td>
                      <td className="mono">{t.twi ?? "—"}</td>
                      <td className="mono">{t.scars_within_500m ?? 0}</td>
                      <td>{!t.insar_coverage || t.insar_coverage === "none" ? "not observable" : String(t.creep_state)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
