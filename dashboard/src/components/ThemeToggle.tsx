import { ToggleGroup, Tooltip } from "radix-ui";
import { Monitor, Moon, Sun } from "lucide-react";
import type { ThemeMode } from "../lib/themeMode";

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Follow the system", icon: Monitor },
];

/** Three explicit choices rather than a toggle that guesses: a person who
 *  picks "system" should not lose that the next time they click. */
export function ThemeToggle({ mode, onMode }: { mode: ThemeMode; onMode: (m: ThemeMode) => void }) {
  return (
    <ToggleGroup.Root type="single" value={mode} className="seg-group theme-toggle" aria-label="Appearance"
                      onValueChange={(v) => v && onMode(v as ThemeMode)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <Tooltip.Root key={value}>
          <Tooltip.Trigger asChild>
            <ToggleGroup.Item value={value} className="seg seg-icon" aria-label={label}>
              <Icon size={15} strokeWidth={2} />
            </ToggleGroup.Item>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="tip" sideOffset={6}>{label}<Tooltip.Arrow className="tip-arrow" /></Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      ))}
    </ToggleGroup.Root>
  );
}
