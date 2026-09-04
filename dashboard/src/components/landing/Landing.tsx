import { Hero } from "./Hero";
import { Metrics } from "./Metrics";
import { Formula } from "./Formula";
import { LayerSequence } from "./LayerSequence";
import { Proof } from "./Proof";
import { Corridor } from "./Corridor";
import type { SegmentSummary } from "../../api/client";

interface Props {
  onEnter: () => void;
  segmentsLoaded: number | null;
  segments: SegmentSummary[];
}

export function Landing({ onEnter, segmentsLoaded, segments }: Props) {
  return (
    <main className="landing">
      <div className="landing-inner">
        <Hero />
        <Metrics />
        <hr className="hairline" />
        <Formula />
      </div>
      <LayerSequence />
      <div className="landing-inner">
        <hr className="hairline" />
        <Proof />
        <hr className="hairline" />
        <Corridor segments={segments} onEnter={onEnter} ready={segmentsLoaded} />
      </div>
    </main>
  );
}
