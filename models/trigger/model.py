"""Layer 2 — probability that rainfall triggers a failure.

The design calls for an LSTM over rainfall sequences. That is the right model
with thousands of labelled events; this corridor has 51. A recurrent network
over 51 positives memorises them, and the honest alternative is a small
regularised model over explicit antecedent-rainfall features, which is what the
build guide allows as the fallback and what the literature uses at this sample
size. The feature set is the same information the LSTM would have to rediscover.

Splits are temporal, never random. A random split puts one day of a storm in
train and the next day in test, and the model then "predicts" weather it has
already seen.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

log = logging.getLogger(__name__)

RAIN_FEATURES = ["rain_1d", "rain_3d", "rain_7d", "rain_15d", "rain_30d"]


@dataclass
class TriggerReport:
    auc_roc: float
    auc_pr: float
    base_rate: float
    brier: float
    n_train: int
    n_test: int
    n_positive_test: int

    @property
    def lift(self) -> float:
        """AUC-PR relative to the base rate — the only fair reading under imbalance."""
        return self.auc_pr / self.base_rate if self.base_rate else float("nan")

    def __str__(self) -> str:
        return (
            f"AUC-ROC {self.auc_roc:.3f}  AUC-PR {self.auc_pr:.3f} "
            f"(base {self.base_rate:.4f}, lift {self.lift:.1f}x)  Brier {self.brier:.4f}  "
            f"train {self.n_train} / test {self.n_test} ({self.n_positive_test} events)"
        )


def temporal_split(frame: pd.DataFrame, test_from_year: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Earlier monsoons train, later monsoons test."""
    years = pd.to_datetime(frame["day"]).dt.year
    train, test = frame[years < test_from_year], frame[years >= test_from_year]
    if not len(test) or test["event"].sum() == 0:
        raise ValueError(f"no events on or after {test_from_year}; pick an earlier split")
    return train, test


def fit(train: pd.DataFrame, features: list[str] | None = None, calibrate: bool = True):
    """Regularised logistic regression, calibrated back to the true base rate.

    Balanced class weights are what make the model learnable at ~50 positives —
    but they fit a balanced prior, so raw outputs read like 0.5 when the real
    frequency is 0.005. That is harmless for ranking and fatal downstream: the
    risk formula multiplies P_t against absolute tier thresholds, so an
    overconfident trigger sends the whole corridor orange.

    So the weighted model is wrapped in a sigmoid calibration fitted on
    held-out folds. Sigmoid rather than isotonic: isotonic needs far more
    positives than this and would just step-fit the handful present.
    """
    features = features or RAIN_FEATURES
    base = make_pipeline(
        StandardScaler(),
        LogisticRegression(class_weight="balanced", C=0.5, max_iter=2000),
    )
    x, y = train[features].to_numpy(), train["event"].to_numpy()
    if not calibrate:
        base.fit(x, y)
        return base

    # Folds are contiguous in time, so calibration never sees a day it trained on.
    model = CalibratedClassifierCV(base, method="sigmoid", cv=TimeSeriesSplit(n_splits=4))
    model.fit(x, y)
    return model


def evaluate(model, test: pd.DataFrame, features: list[str] | None = None,
             n_train: int = 0) -> tuple[TriggerReport, np.ndarray]:
    features = features or RAIN_FEATURES
    y = test["event"].to_numpy()
    p = model.predict_proba(test[features].to_numpy())[:, 1]
    report = TriggerReport(
        auc_roc=float(roc_auc_score(y, p)),
        auc_pr=float(average_precision_score(y, p)),
        base_rate=float(y.mean()),
        brier=float(brier_score_loss(y, p)),
        n_train=n_train, n_test=len(y), n_positive_test=int(y.sum()),
    )
    return report, p


def reliability(y_true, y_prob, n_bins: int = 5) -> pd.DataFrame:
    """Is a stated 0.7 actually right about 70% of the time?"""
    observed, predicted = calibration_curve(
        y_true, y_prob, n_bins=n_bins, strategy="quantile"
    )
    return pd.DataFrame({"predicted": predicted, "observed": observed})


def train_and_report(
    frame: pd.DataFrame, test_from_year: int, features: list[str] | None = None,
) -> dict[str, object]:
    features = features or RAIN_FEATURES
    train, test = temporal_split(frame, test_from_year)
    model = fit(train, features)
    report, probabilities = evaluate(model, test, features, n_train=len(train))

    uncalibrated = fit(train, features, calibrate=False)
    raw_report, _ = evaluate(uncalibrated, test, features, n_train=len(train))
    log.info("trigger (calibrated)   %s", report)
    log.info("trigger (uncalibrated) %s", raw_report)

    coefficients = pd.Series(
        uncalibrated[-1].coef_[0], index=features
    ).sort_values(key=abs, ascending=False)

    return {
        "model": model, "report": report, "probabilities": probabilities,
        "coefficients": coefficients, "test": test, "uncalibrated": raw_report,
        "reliability": reliability(test["event"].to_numpy(), probabilities),
    }
