/** The API serves one scored run, not a history, so this is rendered disabled
 *  rather than populated with invented days. Showing a plausible-looking
 *  30-day strip would be a lie about what the system can currently answer. */
export function DateScrubber() {
  return (
    <div className="scrubber" aria-disabled="true">
      <span className="scrub-label mono">history unavailable</span>
      <div className="scrub-track" role="presentation">
        {Array.from({ length: 30 }, (_, i) => (
          <span className="scrub-tick" key={i} />
        ))}
      </div>
      <span className="scrub-note">
        the API serves a single scored run; per-day history is not stored yet
      </span>
    </div>
  );
}
