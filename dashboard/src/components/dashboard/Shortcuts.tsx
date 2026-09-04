const KEYS = [
  ["↑ ↓", "move through the watchlist"],
  ["Enter", "select the focused segment"],
  ["Esc", "clear selection, or close this"],
  ["1 – 4", "toggle red, orange, yellow, green"],
  ["c", "clear all filters"],
  ["t", "table view"],
  ["?", "this overlay"],
];

export function Shortcuts({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal shortcuts" role="dialog" aria-modal="true"
         aria-label="Keyboard shortcuts">
      <div className="modal-head">
        <h2>Keyboard</h2>
        <button className="ghost" onClick={onClose} autoFocus>Close</button>
      </div>
      <dl className="keys">
        {KEYS.map(([key, what]) => (
          <div key={key}><dt className="mono">{key}</dt><dd>{what}</dd></div>
        ))}
      </dl>
    </div>
  );
}
