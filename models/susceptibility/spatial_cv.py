"""Spatially blocked cross-validation.

A random split puts pixel (i, j) in train and (i, j+1) in test. They share
terrain, lithology, rainfall and often the same landslide scar, so the model
memorises location instead of learning process and AUC inflates past 0.98.
Whole contiguous blocks are held out together instead.

Block size is not a guess: `estimate_range_m` fits a variogram to a predictor
raster and returns the distance at which spatial autocorrelation dies out.
Blocks must be comfortably larger than that.
"""

from __future__ import annotations

import logging

import numpy as np
import rasterio
from scipy.optimize import curve_fit
from scipy.spatial import cKDTree
from sklearn.model_selection import GroupKFold

log = logging.getLogger(__name__)

DEFAULT_BLOCK_SIZE_M = 5000.0


def assign_blocks(gdf, block_size_m: float = DEFAULT_BLOCK_SIZE_M) -> np.ndarray:
    """Label each point with the square block it falls in. Requires a metric CRS."""
    if gdf.crs is None or gdf.crs.is_geographic:
        raise ValueError(f"need a projected CRS in metres, got {gdf.crs}")
    bx = np.floor(gdf.geometry.x / block_size_m).astype(int)
    by = np.floor(gdf.geometry.y / block_size_m).astype(int)
    return (bx.astype(str) + "_" + by.astype(str)).to_numpy()


def spatial_cv(X, y, groups, n_splits: int = 5):
    """Yield train/test indices with whole blocks held out."""
    n_blocks = len(np.unique(groups))
    if n_blocks < n_splits:
        raise ValueError(f"{n_blocks} blocks cannot make {n_splits} folds — smaller blocks")
    return GroupKFold(n_splits=n_splits).split(X, y, groups)


def _spherical(h: np.ndarray, nugget: float, sill: float, rng: float) -> np.ndarray:
    """Standard spherical variogram: rises to the sill at `rng`, flat after."""
    h = np.asarray(h, dtype=float)
    inner = nugget + sill * (1.5 * h / rng - 0.5 * (h / rng) ** 3)
    return np.where(h < rng, inner, nugget + sill)


def empirical_variogram(
    raster_path, n_samples: int = 8000, n_lags: int = 25, max_lag_m: float = 6000.0,
    seed: int = 0,
) -> tuple[np.ndarray, np.ndarray]:
    """Semivariance against separation distance, from nearby pixel pairs.

    Pairs come from a KD-tree neighbourhood, not from uniform random pairs.
    Over a 60 km AOI, uniform pairs are almost never within a few hundred
    metres of each other, so the short lags where terrain actually decorrelates
    go unsampled and any fitted range is meaningless.
    """
    rng = np.random.default_rng(seed)
    with rasterio.open(raster_path) as src:
        band = src.read(1, masked=True)
        pixel_m = abs(src.transform.a)

    valid = np.argwhere(~np.ma.getmaskarray(band) & np.isfinite(band.filled(np.nan)))
    if len(valid) < n_samples:
        raise ValueError(f"only {len(valid)} valid cells")
    picks = valid[rng.choice(len(valid), n_samples, replace=False)]
    values = np.asarray(band[picks[:, 0], picks[:, 1]], dtype=float)
    coords = picks[:, ::-1] * pixel_m  # (row, col) -> (x, y) in metres

    tree = cKDTree(coords)
    pairs = np.asarray(list(tree.query_pairs(max_lag_m)))
    if len(pairs) < n_lags * 10:
        raise ValueError(f"only {len(pairs)} pairs within {max_lag_m:.0f} m — widen max_lag_m")
    i, j = pairs[:, 0], pairs[:, 1]

    dist = np.linalg.norm(coords[i] - coords[j], axis=1)
    semivar = 0.5 * (values[i] - values[j]) ** 2

    edges = np.linspace(0, max_lag_m, n_lags + 1)
    idx = np.digitize(dist, edges) - 1
    ok = (idx >= 0) & (idx < n_lags)

    centres = 0.5 * (edges[:-1] + edges[1:])
    gamma = np.array([
        semivar[ok][idx[ok] == b].mean() if (idx[ok] == b).any() else np.nan
        for b in range(n_lags)
    ])
    good = ~np.isnan(gamma)
    return centres[good], gamma[good]


def estimate_range_m(raster_path, **kwargs) -> float:
    """Distance beyond which a predictor stops being self-correlated."""
    lags, gamma = empirical_variogram(raster_path, **kwargs)
    p0 = [gamma.min(), gamma.max() - gamma.min(), lags[len(lags) // 3]]
    bounds = ([0, 0, lags[1]], [gamma.max(), 10 * gamma.max(), lags[-1] * 3])
    try:
        (nugget, sill, rng_m), _ = curve_fit(_spherical, lags, gamma, p0=p0, bounds=bounds)
    except RuntimeError:
        log.warning("variogram fit did not converge; falling back to max lag")
        return float(lags[-1])
    if rng_m > 0.95 * bounds[1][2]:
        log.warning(
            "%s: variogram range hit the search bound (%.0f m) — it is unresolved at this "
            "max_lag_m, not genuinely that large", raster_path, rng_m
        )
    log.info("variogram: nugget=%.3g sill=%.3g range=%.0f m", nugget, sill, rng_m)
    return float(rng_m)


def recommend_block_size(
    raster_paths, safety_factor: float = 2.0, n_splits: int = 5,
    max_fraction_of_extent: float = 0.25,
) -> float:
    """Block size from the autocorrelation range of the predictors.

    Layers whose fitted range exceeds `max_fraction_of_extent` of the study area
    are excluded. A range that large is a regional trend, not autocorrelation —
    raw elevation across a mountain front is the classic case, rising
    monotonically from plain to peak, and it would drive the blocks so large
    that too few remain to form folds.
    """
    extent_m = None
    ranges: dict[str, float] = {}
    for path in raster_paths:
        with rasterio.open(path) as src:
            extent_m = min(
                src.width * abs(src.transform.a), src.height * abs(src.transform.e)
            )
        try:
            ranges[str(path)] = estimate_range_m(path)
        except (ValueError, RuntimeError) as e:
            log.warning("skipping %s: %s", path, e)

    if not ranges or extent_m is None:
        return DEFAULT_BLOCK_SIZE_M

    ceiling = extent_m * max_fraction_of_extent
    local = {k: v for k, v in ranges.items() if v <= ceiling}
    for k, v in ranges.items():
        if k not in local:
            log.warning(
                "%s: range %.0f m exceeds %.0f%% of the %.0f m study area — treating as a "
                "regional trend and excluding it", k, v, max_fraction_of_extent * 100, extent_m
            )
    if not local:
        raise ValueError(
            "every layer looks trend-dominated; detrend them or set block size by hand"
        )

    widest = max(local.values())
    block = float(np.ceil(widest * safety_factor / 1000.0) * 1000.0)

    # A block size that leaves too few blocks cannot make the folds it is for.
    blocks_per_side = extent_m / block
    if blocks_per_side**2 < n_splits * 3:
        capped = float(np.floor(extent_m / np.sqrt(n_splits * 3) / 1000.0) * 1000.0)
        log.warning(
            "%.0f m blocks give only ~%.0f blocks, too few for %d folds — capping to %.0f m",
            block, blocks_per_side**2, n_splits, capped
        )
        block = capped

    log.info(
        "widest local range %.0f m over %d/%d rasters -> %.0f m blocks (~%.0f blocks)",
        widest, len(local), len(ranges), block, (extent_m / block) ** 2
    )
    return block
