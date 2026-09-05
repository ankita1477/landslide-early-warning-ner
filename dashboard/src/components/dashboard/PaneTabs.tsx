import { ToggleGroup } from "radix-ui";
import { List, Map, PanelRight } from "lucide-react";
import type { Pane } from "../../lib/useDashboardState";

/** Below tablet width the three regions become pages. */
export function PaneTabs({ pane, onPane }: { pane: Pane; onPane: (p: Pane) => void }) {
  return (
    <ToggleGroup.Root type="single" value={pane} className="pane-tabs" aria-label="View"
                      onValueChange={(v) => v && onPane(v as Pane)}>
      <ToggleGroup.Item value="list" className="seg"><List size={15} /> List</ToggleGroup.Item>
      <ToggleGroup.Item value="map" className="seg"><Map size={15} /> Map</ToggleGroup.Item>
      <ToggleGroup.Item value="detail" className="seg"><PanelRight size={15} /> Detail</ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}
