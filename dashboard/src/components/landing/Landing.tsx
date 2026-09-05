import { ArrowRight } from "lucide-react";
import { Hero } from "./Hero";
import { Metrics } from "./Metrics";
import { Method } from "./Method";
import { Proof } from "./Proof";
import { Corridor } from "./Corridor";
import { Mark } from "../Mark";
import type { SegmentSummary } from "../../api/client";

interface Props {
  onEnter: () => void;
  segmentsLoaded: number | null;
  computedAt: string | null;
  segments: SegmentSummary[];
}

export function Landing({ onEnter, segmentsLoaded, computedAt, segments }: Props) {
  return (
    <main className="landing">
      <nav className="topnav" aria-label="Site">
        <div className="topnav-inner">
          <span className="brand"><Mark size={22} /> Landsafe <em>NER</em></span>
          <span className="topnav-note mono">Operations · NH-10 Sevoke–Gangtok</span>
          <button className="btn btn-ink" onClick={onEnter}>
            Open the console <ArrowRight size={16} strokeWidth={2.2} />
          </button>
        </div>
      </nav>

      <div className="inner">
        <Hero segments={segments} computedAt={computedAt} />
        <Metrics />
      </div>
      <Method />
      <div className="inner">
        <Proof />
        <Corridor segments={segments} onEnter={onEnter} ready={segmentsLoaded} />
      </div>
    </main>
  );
}
