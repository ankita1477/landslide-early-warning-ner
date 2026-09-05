/** The mark: a slab of ground with the road cut across it and one signal arc
 *  above. Three shapes, so it survives 16px. */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="mark">
      <path d="M12 4 L21 9 L12 14 L3 9 Z" fill="currentColor" fillOpacity="0.16" />
      <path d="M3 9 L12 14 L12 19 L3 14 Z" fill="currentColor" fillOpacity="0.45" />
      <path d="M12 14 L21 9 L21 14 L12 19 Z" fill="currentColor" fillOpacity="0.28" />
      <path d="M5.5 10.5 C 8 9, 10 12, 12.5 10.5 C 15 9, 17 11.5, 19 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14.5 5.5 A 4 4 0 0 1 18.5 3.5" fill="none" stroke="var(--orange)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
