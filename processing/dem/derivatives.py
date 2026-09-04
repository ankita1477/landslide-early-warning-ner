"""Terrain derivatives from a DEM.

Uses WhiteboxTools rather than richdem: richdem ships no arm64 wheel and its
C++ will not compile against current clang. Whitebox ships a prebuilt binary
and covers every attribute we need.

Slope must be computed in a metric CRS. Computing it on degree-spaced cells
makes the horizontal units incommensurate with the vertical ones and the
values are silently wrong, so `reproject_to_utm` is not optional.
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import calculate_default_transform, reproject

log = logging.getLogger(__name__)

NODATA = -9999.0


def reproject_to_utm(src_path: Path, dst_path: Path, utm_crs: str, res: float = 30.0) -> Path:
    """Warp a geographic DEM onto a square metric grid."""
    with rasterio.open(src_path) as src:
        transform, width, height = calculate_default_transform(
            src.crs, utm_crs, src.width, src.height, *src.bounds, resolution=res
        )
        profile = src.profile | {
            "crs": utm_crs, "transform": transform, "width": width, "height": height,
            "dtype": "float32", "nodata": NODATA,
            # no predictor: whitebox's GeoTIFF reader rejects PREDICTOR=3
            "compress": "deflate", "tiled": True,
        }
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        with rasterio.open(dst_path, "w", **profile) as dst:
            reproject(
                source=rasterio.band(src, 1), destination=rasterio.band(dst, 1),
                src_transform=src.transform, src_crs=src.crs,
                dst_transform=transform, dst_crs=utm_crs,
                resampling=Resampling.bilinear, dst_nodata=NODATA,
            )
    log.info("reprojected to %s at %.0f m -> %d x %d", utm_crs, res, width, height)
    return dst_path


def _read(path: Path) -> np.ndarray:
    with rasterio.open(path) as s:
        a = s.read(1).astype("float32")
        nd = s.nodata
    return np.where(a == nd, np.nan, a) if nd is not None else a


def _write_like(reference: Path, data: np.ndarray, dest: Path) -> Path:
    with rasterio.open(reference) as ref:
        profile = ref.profile | {"dtype": "float32", "nodata": NODATA, "count": 1}
    with rasterio.open(dest, "w", **profile) as dst:
        dst.write(np.nan_to_num(data, nan=NODATA).astype("float32"), 1)
    return dest


def compute_derivatives(dem_utm: Path, out_dir: Path) -> dict[str, Path]:
    """Produce the terrain predictor rasters. DEM must already be in a metric CRS."""
    import whitebox

    out_dir.mkdir(parents=True, exist_ok=True)
    dem_utm, out_dir = dem_utm.resolve(), out_dir.resolve()

    wbt = whitebox.WhiteboxTools()
    # Verbose must be on or the wrapper never calls the callback, so a failure
    # arrives with no explanation. Output goes to a buffer, not the console.
    wbt.verbose = True
    wbt.set_working_dir(str(out_dir))

    paths = {n: out_dir / f"{n}.tif" for n in
             ("slope", "aspect", "plan_curv", "prof_curv", "filled", "flow_accum")}

    def run(label: str, fn, expect: Path, *args, **kwargs) -> None:
        """WhiteboxTools returns 0 even when its binary panics, so trust the file, not
        the code, and keep its output so a failure says why."""
        chatter: list[str] = []
        fn(*args, **kwargs, callback=chatter.append)
        if not expect.exists():
            detail = "\n  ".join(line.strip() for line in chatter if line.strip())
            raise RuntimeError(
                f"whitebox {label} produced no output at {expect}\n  {detail or '(no output)'}"
            )

    run("slope", wbt.slope, paths["slope"], str(dem_utm), str(paths["slope"]), units="degrees")
    run("aspect", wbt.aspect, paths["aspect"], str(dem_utm), str(paths["aspect"]))
    run("plan_curvature", wbt.plan_curvature, paths["plan_curv"],
        str(dem_utm), str(paths["plan_curv"]))
    run("profile_curvature", wbt.profile_curvature, paths["prof_curv"],
        str(dem_utm), str(paths["prof_curv"]))

    # Flow accumulation needs a depressionless surface or flow paths terminate in pits.
    # Wang & Liu rather than whitebox's default `fill_depressions`: that one panics with
    # "Error unwrapping 'output'" on roughly 1 run in 5, regardless of input, and since
    # the wrapper reports success anyway the failure surfaces later as a missing file.
    run("fill_depressions_wang_and_liu", wbt.fill_depressions_wang_and_liu, paths["filled"],
        str(dem_utm), str(paths["filled"]))
    run("d8_flow_accumulation", wbt.d8_flow_accumulation, paths["flow_accum"],
        str(paths["filled"]), str(paths["flow_accum"]), out_type="cells")

    slope_deg = _read(paths["slope"])
    aspect_deg = _read(paths["aspect"])
    accum = _read(paths["flow_accum"])

    # Aspect is circular: 359 deg and 1 deg are adjacent, but a model reading raw
    # degrees sees them as opposite extremes. Encode as a unit vector instead.
    aspect_rad = np.deg2rad(aspect_deg)
    out = {
        "slope": paths["slope"],
        "plan_curv": paths["plan_curv"],
        "prof_curv": paths["prof_curv"],
        "aspect_sin": _write_like(dem_utm, np.sin(aspect_rad), out_dir / "aspect_sin.tif"),
        "aspect_cos": _write_like(dem_utm, np.cos(aspect_rad), out_dir / "aspect_cos.tif"),
    }

    with rasterio.open(dem_utm) as s:
        cell_area = abs(s.transform.a * s.transform.e)

    # Clip slope away from zero: tan(0) = 0 divides to infinity across every flat cell.
    tan_b = np.tan(np.clip(np.deg2rad(slope_deg), 0.001, None))
    sca = (accum + 1.0) * cell_area  # specific catchment area, m^2
    out["twi"] = _write_like(dem_utm, np.log(sca / tan_b), out_dir / "twi.tif")
    out["spi"] = _write_like(dem_utm, np.log1p(sca * tan_b), out_dir / "spi.tif")

    for p in (paths["filled"], paths["aspect"], paths["flow_accum"]):
        p.unlink(missing_ok=True)  # intermediates, not predictors

    log.info("wrote %d derivative rasters to %s", len(out), out_dir)
    return out
