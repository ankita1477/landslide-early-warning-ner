import { Dialog } from "radix-ui";
import { X } from "lucide-react";

const KEYS = [
  ["↑ ↓", "move through the list"],
  ["Enter", "select the focused kilometre"],
  ["Esc", "clear selection, or close this"],
  ["1 – 4", "toggle Danger, Warning, Caution, Safe"],
  ["c", "clear all filters"],
  ["t", "table view"],
  ["?", "this overlay"],
];

export function Shortcuts({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="modal shortcuts" aria-describedby={undefined}>
          <div className="modal-head">
            <Dialog.Title className="modal-title">Keyboard</Dialog.Title>
            <Dialog.Close asChild><button className="icon-btn" aria-label="Close"><X size={16} /></button></Dialog.Close>
          </div>
          <dl className="keys">
            {KEYS.map(([key, what]) => (
              <div key={key}><dt><kbd className="mono">{key}</kbd></dt><dd>{what}</dd></div>
            ))}
          </dl>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
