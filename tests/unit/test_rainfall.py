"""Rainfall feature construction — the parts that need no Earth Engine call."""

from datetime import date, timedelta

import pandas as pd
import pytest

from ingestion.clients.rainfall import SOURCES, summarise_antecedent


def _window(pid: str, occurred: date, daily_mm: list[float]) -> pd.DataFrame:
    """daily_mm[0] is the event day, [1] the day before, and so on."""
    return pd.DataFrame(
        {
            "pid": pid,
            "event_pid": pid,
            "occurred_on": occurred,
            "day": [occurred - timedelta(days=i) for i in range(len(daily_mm))],
            "lag_days": list(range(len(daily_mm))),
            "precip_mm": daily_mm,
        }
    )


def test_cumulative_spans_are_nested():
    occurred = date(2015, 7, 4)
    w = _window("0", occurred, [10.0, 5.0, 5.0] + [1.0] * 27)
    out = summarise_antecedent(w, spans=(1, 3, 7, 30))

    assert out["rain_1d_mm"].iloc[0] == 10.0
    assert out["rain_3d_mm"].iloc[0] == 20.0
    assert out["rain_7d_mm"].iloc[0] == 24.0
    assert out["rain_30d_mm"].iloc[0] == 47.0


def test_spans_increase_monotonically():
    """A longer lookback can never accumulate less rain than a shorter one."""
    w = _window("0", date(2016, 8, 1), [3.0] * 30)
    out = summarise_antecedent(w, spans=(1, 3, 7, 15, 30))
    values = [out[f"rain_{s}d_mm"].iloc[0] for s in (1, 3, 7, 15, 30)]
    assert values == sorted(values)


def test_one_row_per_event():
    a = _window("0", date(2015, 7, 4), [10.0, 2.0])
    b = _window("1", date(2016, 10, 15), [40.0, 8.0])
    out = summarise_antecedent(pd.concat([a, b], ignore_index=True))
    assert len(out) == 2
    assert set(out["event_pid"]) == {"0", "1"}


def test_output_is_ordered_by_date():
    late = _window("0", date(2017, 7, 4), [1.0])
    early = _window("1", date(2010, 7, 4), [1.0])
    out = summarise_antecedent(pd.concat([late, early], ignore_index=True))
    assert list(out["occurred_on"]) == sorted(out["occurred_on"])


def test_a_dry_run_up_is_zero_not_missing():
    """Zero antecedent rain is a real observation and must not become NaN."""
    w = _window("0", date(2015, 1, 4), [0.0] * 30)
    out = summarise_antecedent(w)
    assert out["rain_30d_mm"].iloc[0] == 0.0
    assert out.notna().all().all()


@pytest.mark.parametrize("source", sorted(SOURCES))
def test_source_table_is_well_formed(source):
    collection_id, band, scale, needs_sum = SOURCES[source]
    assert collection_id and band
    assert scale > 0
    assert isinstance(needs_sum, bool)


def test_imerg_is_marked_as_needing_summation():
    """IMERG is a half-hourly rate; treating it as a daily total would be 48x wrong."""
    assert SOURCES["imerg"][3] is True
    assert SOURCES["chirps"][3] is False
