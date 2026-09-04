"""Sentinel-1 displacement from COMET-LiCS pre-processed interferograms.

Processing SLCs from scratch means ~10 GB per acquisition and hours of compute
per interferogram. LiCSAR publishes unwrapped, geocoded interferograms for the
Himalaya already, so this reads those instead.

The products are striped GeoTIFFs on a slow server (~15 KB/s here), so a full
download is impractical — 11 MB takes about thirteen minutes. They do accept
byte ranges, so GDAL reads only the rows covering the AOI, which is roughly a
fifth of each file and a minute per read. Reads run concurrently because the
bottleneck is latency, not local CPU.
"""

from __future__ import annotations

import logging
import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

import numpy as np
import pandas as pd
import rasterio
from rasterio.windows import from_bounds

log = logging.getLogger(__name__)

BASE = "https://gws-access.jasmin.ac.uk/public/nceo_geohazards/LiCSAR_products.public"

# Sentinel-1 C-band. One radian of unwrapped phase is this many mm of range change.
WAVELENGTH_MM = 55.465
MM_PER_RADIAN = WAVELENGTH_MM / (4 * np.pi)

# Below this the pixel is not measuring the ground, only noise.
COHERENCE_MIN = 0.30

os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")


@dataclass(frozen=True)
class Frame:
    """A LiCSAR frame. Never mix frames or tracks in one time series — different
    viewing geometries project ground motion onto different line-of-sight
    vectors, so the displacements are not comparable."""

    frame_id: str

    @property
    def track(self) -> int:
        return int(self.frame_id[:3])

    def url(self, primary: str, secondary: str, product: str) -> str:
        pair = f"{primary}_{secondary}"
        return f"{BASE}/{self.track}/{self.frame_id}/interferograms/{pair}/{pair}.geo.{product}.tif"


NH10_FRAME = Frame("048D_06252_131313")  # descending, covers the corridor fully


def read_window(url: str, bbox: tuple[float, float, float, float]):
    """Read just the AOI window of a remote GeoTIFF."""
    with rasterio.open(f"/vsicurl/{url}") as src:
        window = from_bounds(*bbox, src.transform)
        data = src.read(1, window=window)
        transform = src.window_transform(window)
    return data, transform


def fetch_pair(
    frame: Frame, primary: str, secondary: str, bbox, coherence_min: float = COHERENCE_MIN
):
    """Line-of-sight displacement in mm for one interferogram, coherence-masked."""
    phase, transform = read_window(frame.url(primary, secondary, "unw"), bbox)
    coherence, _ = read_window(frame.url(primary, secondary, "cc"), bbox)

    # LiCSAR coherence is stored 0-255.
    coherence = coherence.astype("float32") / 255.0
    # Positive phase is motion away from the satellite; displacement toward it is
    # conventionally positive, hence the sign.
    displacement = -phase.astype("float32") * MM_PER_RADIAN

    invalid = (phase == 0) | ~np.isfinite(phase) | (coherence < coherence_min)
    displacement[invalid] = np.nan
    return displacement, coherence, transform


def reference_epochs(displacement_mm: np.ndarray) -> np.ndarray:
    """Remove the common-mode signal from each epoch.

    A raw chain carries the atmosphere and orbital ramp along with the ground.
    Water vapour alone shifts a whole scene by tens of mm between passes, which
    integrates into an apparent velocity of the same order as real creep — the
    corridor came out moving at a uniform 12-26 mm/yr before this. Subtracting
    each epoch's spatial median references every pixel to the scene as a whole,
    so what remains is motion *relative to* the surrounding ground, which is what
    a creep signal actually is. It is the cheap stand-in for GACOS: it removes
    the bulk offset, not the spatially varying part.
    """
    medians = np.nanmedian(displacement_mm.reshape(len(displacement_mm), -1), axis=1)
    return displacement_mm - medians[:, None, None]


def fetch_chain(
    frame: Frame, pairs: list[tuple[str, str]], bbox, workers: int = 8,
    coherence_min: float = COHERENCE_MIN,
) -> dict:
    """Fetch every link of a chain concurrently and integrate it into a series.

    Each link measures displacement between consecutive epochs, so the cumulative
    sum is the displacement history. A pixel missing from any link breaks its
    chain, and its later values are left as NaN rather than being bridged —
    interpolating across an unmeasured interval invents motion that was never
    observed.
    """
    def load(index_pair):
        index, (primary, secondary) = index_pair
        try:
            displacement, coherence, transform = fetch_pair(
                frame, primary, secondary, bbox, coherence_min
            )
            return index, displacement, coherence, transform
        except Exception as error:
            log.warning("pair %s_%s failed: %s", primary, secondary, error)
            return index, None, None, None

    results = [None] * len(pairs)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for index, displacement, coherence, transform in pool.map(
            load, enumerate(pairs)
        ):
            results[index] = (displacement, coherence, transform)

    usable = [(i, r) for i, r in enumerate(results) if r[0] is not None]
    if not usable:
        raise RuntimeError("every interferogram failed to load")
    shape = usable[0][1][0].shape
    transform = usable[0][1][2]

    increments = np.full((len(pairs), *shape), np.nan, dtype="float32")
    coherences = np.full((len(pairs), *shape), np.nan, dtype="float32")
    for index, (displacement, coherence, _) in usable:
        if displacement.shape == shape:
            increments[index] = displacement
            coherences[index] = coherence

    cumulative = np.nancumsum(np.nan_to_num(increments, nan=0.0), axis=0)
    # Once a link is missing the running total is no longer anchored to reality.
    broken = np.cumsum(np.isnan(increments), axis=0) > 0
    cumulative[broken] = np.nan

    epochs = [pairs[0][0]] + [secondary for _, secondary in pairs]
    dates = pd.to_datetime(epochs, format="%Y%m%d")
    stack = np.concatenate([np.zeros((1, *shape), dtype="float32"), cumulative], axis=0)

    stack = reference_epochs(stack)
    observed = float(np.isfinite(stack[-1]).mean())
    log.info(
        "chain: %d/%d links loaded, %d epochs, %.1f%% of AOI pixels survive to the end",
        len(usable), len(pairs), len(dates), observed * 100,
    )
    return {
        "dates": dates, "displacement_mm": stack, "coherence": np.nanmean(coherences, axis=0),
        "transform": transform, "n_links": len(usable), "coverage_fraction": observed,
    }
