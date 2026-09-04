"""Train the Layer 1 susceptibility model.

Always reports the spatially blocked score alongside the random-split score.
The gap between them is not a curiosity: the random number is what a careless
pipeline would publish, and printing both makes it impossible to quote by
accident.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import geopandas as gpd
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import KFold

from models.susceptibility.spatial_cv import assign_blocks, spatial_cv

log = logging.getLogger(__name__)

NON_FEATURES = {"label", "geometry"}


@dataclass
class CVResult:
    auc_roc: float
    auc_pr: float
    fold_auc: list[float] = field(default_factory=list)
    n_folds: int = 0

    def __str__(self) -> str:
        spread = ""
        if self.fold_auc:
            spread = f" (folds {min(self.fold_auc):.3f}-{max(self.fold_auc):.3f})"
        return f"AUC-ROC {self.auc_roc:.3f}  AUC-PR {self.auc_pr:.3f}{spread}"


def feature_columns(dataset: gpd.GeoDataFrame) -> list[str]:
    return [c for c in dataset.columns if c not in NON_FEATURES]


def _fit_predict(x_train, y_train, x_test):
    import xgboost as xgb

    # scale_pos_weight rather than oversampling: with a few hundred positives,
    # synthetic minority samples mostly interpolate between near-duplicates.
    positive = max(int(y_train.sum()), 1)
    negative = max(len(y_train) - positive, 1)
    model = xgb.XGBClassifier(
        n_estimators=400, max_depth=4, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8,
        scale_pos_weight=negative / positive,
        eval_metric="aucpr", tree_method="hist", random_state=0,
    )
    model.fit(x_train, y_train)
    return model.predict_proba(x_test)[:, 1], model


def _evaluate(splits, x, y) -> CVResult:
    out_of_fold = np.full(len(y), np.nan)
    fold_auc = []
    n = 0
    for train, test in splits:
        if len(np.unique(y[train])) < 2 or len(np.unique(y[test])) < 2:
            continue
        predictions, _ = _fit_predict(x[train], y[train], x[test])
        out_of_fold[test] = predictions
        fold_auc.append(roc_auc_score(y[test], predictions))
        n += 1

    scored = ~np.isnan(out_of_fold)
    return CVResult(
        auc_roc=float(roc_auc_score(y[scored], out_of_fold[scored])),
        auc_pr=float(average_precision_score(y[scored], out_of_fold[scored])),
        fold_auc=fold_auc, n_folds=n,
    )


def train_and_evaluate(
    dataset: gpd.GeoDataFrame, block_size_m: float, n_splits: int = 5,
) -> dict[str, object]:
    """Fit with spatial blocking, and with a random split for comparison."""
    features = feature_columns(dataset)
    x = dataset[features].to_numpy(dtype="float32")
    y = dataset["label"].to_numpy(dtype="int32")
    groups = assign_blocks(dataset, block_size_m=block_size_m)

    blocked = _evaluate(spatial_cv(x, y, groups, n_splits=n_splits), x, y)
    random = _evaluate(KFold(n_splits, shuffle=True, random_state=0).split(x), x, y)

    _, model = _fit_predict(x, y, x)
    importance = (
        pd.Series(model.feature_importances_, index=features)
        .sort_values(ascending=False)
    )

    log.info("blocked  %s over %d blocks", blocked, len(set(groups)))
    log.info("random   %s  <- inflated by leakage, do not report", random)
    log.info("inflation %+.3f AUC", random.auc_roc - blocked.auc_roc)

    return {
        "blocked": blocked, "random": random, "importance": importance,
        "model": model, "features": features, "n_blocks": len(set(groups)),
    }


def predict_raster(model, features: list[str], stack, dest) -> Path:  # noqa: F821
    """Score every cell, writing a 0-1 susceptibility raster.

    Cells with any missing predictor are left as nodata rather than imputed: a
    guessed feature produces a confident-looking score with nothing behind it.
    """
    from pathlib import Path

    import rasterio

    columns = [stack[name].to_numpy().astype("float32").ravel() for name in features]
    matrix = np.column_stack(columns)
    valid = np.isfinite(matrix).all(axis=1)

    scores = np.full(matrix.shape[0], np.nan, dtype="float32")
    if valid.any():
        scores[valid] = model.predict_proba(matrix[valid])[:, 1].astype("float32")

    shape = stack[features[0]].shape
    transform = stack.rio.transform()
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(
        dest, "w", driver="GTiff", height=shape[0], width=shape[1], count=1,
        dtype="float32", crs=stack.rio.crs, transform=transform, nodata=np.nan,
        compress="deflate", tiled=True,
    ) as out:
        out.write(scores.reshape(shape), 1)

    log.info("wrote susceptibility raster: %.1f%% of cells scored",
             100 * valid.mean())
    return dest
