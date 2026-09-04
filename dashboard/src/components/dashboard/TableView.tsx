import type { SegmentSummary } from "../../lib/useDashboardState";
import facts from "../../data/segments.json";

type Facts = Record<string, Record<string, number | string | null>>;

/** The text equivalent of everything on screen.
 *
 *  This is what makes the colour-dependent encodings legal rather than merely
 *  mitigated: every value the charts show is reachable here as text.
 */
export function TableView({ segments, onClose }: {
  segments: SegmentSummary[]; onClose: () => void;
}) {
  const f = facts as Facts;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="All segments as a table">
      <div className="modal-head">
        <h2>All segments</h2>
        <span className="mono tiny">{segments.length} rows</span>
        <button className="ghost" onClick={onClose} autoFocus>Close</button>
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
                  <td>{s.tier}</td>
                  <td className="mono">{s.risk.toFixed(5)}</td>
                  <td className="mono">{t.slope_deg ?? "—"}</td>
                  <td className="mono">{t.aspect_deg ?? "—"}</td>
                  <td className="mono">{t.elevation_m ?? "—"}</td>
                  <td className="mono">{t.twi ?? "—"}</td>
                  <td className="mono">{t.scars_within_500m ?? 0}</td>
                  <td>{t.insar_coverage === "none" ? "not observable" : String(t.creep_state)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
