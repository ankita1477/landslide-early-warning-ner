/** Facts about the corridor itself, as measured by the pipeline's last run.
 *
 *  Screens that have the segment list count it directly; these are for the
 *  places that render before it arrives, and for the road's length, which the
 *  API does not serve. One place to change them if the corridor is rebuilt.
 */
export const CORRIDOR = {
  name: "NH-10",
  from: "Sevoke",
  to: "Gangtok",
  lengthKm: 95.2,
  segments: 96,
  /** Segments where Sentinel-1 has coherent pixels. */
  insarObservable: 33,
} as const;
