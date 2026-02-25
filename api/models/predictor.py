# models/predictor.py
import os
import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Optional

# SHAP is optional; we degrade gracefully if not installed / supported
try:
    import shap
    _HAS_SHAP = True
except Exception:
    _HAS_SHAP = False


def _default_band(cgpa: float) -> str:
    """
    Generic CGPA banding (adjust to your institution).
    You can override with env var "CGPA_BAND_THRS" as a JSON array:
    e.g. [4.4, 3.6, 2.8, 2.4] (boundaries for First, 2:1, 2:2, Pass)
    """
    try:
        thrs = os.getenv("CGPA_BAND_THRS")
        if thrs:
            t = json.loads(thrs)
            # expecting 4 thresholds in descending order
            if len(t) == 4:
                if cgpa >= t[0]: return "First Class"
                if cgpa >= t[1]: return "Upper Second"
                if cgpa >= t[2]: return "Lower Second"
                if cgpa >= t[3]: return "Pass"
                return "Probation"
    except Exception:
        pass

    # default thresholds (edit if needed)
    if cgpa >= 4.40: return "First Class"
    if cgpa >= 3.60: return "Upper Second"
    if cgpa >= 2.80: return "Lower Second"
    if cgpa >= 2.40: return "Pass"
    return "Probation"


def _safe_percentile(x, arr):
    try:
        return float(np.round((np.sum(arr <= x) / max(len(arr), 1)) * 100, 2))
    except Exception:
        return None


class CGPAPredictor:
    # Notebook-backed evaluation summary (used for dashboard research context)
    NOTEBOOK_MODEL_COMPARISON = [
        {"model": "Linear Regression", "mae": 0.3244, "rmse": 0.4281, "r2": 0.1961},
        {"model": "Ridge Regression", "mae": 0.3243, "rmse": 0.4280, "r2": 0.1962},
        {"model": "Lasso Regression", "mae": 0.3254, "rmse": 0.4319, "r2": 0.1817},
        {"model": "Random Forest (untuned)", "mae": 0.3157, "rmse": 0.4194, "r2": 0.2283},
        {"model": "XGBoost", "mae": 0.3286, "rmse": 0.4331, "r2": 0.1770},
        {"model": "Random Forest (tuned final)", "mae": 0.3126, "rmse": 0.4158, "r2": 0.2417},
    ]
    NOTEBOOK_FINAL_METRICS = {"mae": 0.3126, "rmse": 0.4158, "r2": 0.2417}
    NOTEBOOK_CV_STATS = {"r2_mean": 0.2501, "r2_std": 0.0598}
    METRIC_EXPLANATIONS = {
        "mae": "Mean Absolute Error: average absolute difference between predicted and actual CGPA. Lower is better.",
        "rmse": "Root Mean Squared Error: similar to MAE but penalizes larger mistakes more strongly. Lower is better.",
        "r2": "R-squared: proportion of CGPA variation explained by the model. Higher is better.",
    }

    """
    Loads the trained model and (optionally) metadata for cohort statistics.
    Provides:
      - predict() -> dict with predicted_cgpa, performance_band
      - rich explanations (global feature importance, local SHAP)
      - student vs cohort comparisons
      - brief guidance strings
    """

    def __init__(self, model_path: Path, metadata_path: Optional[Path] = None):

        model_path = Path(model_path).resolve()
        self.model = joblib.load(model_path)

        # Exact training feature order (23)
        self.feature_names = [
            "age_at_entry",
            "average_olevel_grade",
            "uce_credits",
            "uce_distinctions",
            "alevel_average_grade_weight",
            "alevel_count_weak_grades",
            "alevel_dominant_grade_weight",
            "alevel_std_dev_grade_weight",
            "count_weak_grades_olevel",
            "olevel_subjects",
            "std_dev_olevel_grade",
            "high_school_performance_variance",
            "high_school_performance_stability_index",
            "marital_status",
            "level",
            "gender",
            "is_national",
            "general_paper",
            "campus_id_code",
            "program_id_code",
            "uce_year_code",
            "uace_year_code",
            "year_of_entry_code",
        ]

        # -------- Try to load cohort stats (means, stds, quantiles) --------
        # If you save a metadata JSON at models/metadata.json, we’ll pick it up.
        # Expected format:
        # {
        #   "feature_summary": {
        #       "<feature>": {"mean": ..., "std": ..., "p25": ..., "p50": ..., "p75": ...},
        #       ...
        #   },
        #   "global_importance": [{"feature": "...", "importance": 0.123}, ...]  # optional
        # }
        if metadata_path is None:
            metadata_path = model_path.parent / "metadata.json"

        self.feature_summary = {}
        self.global_importance = None

        try:
            meta = json.loads(Path(metadata_path).read_text(encoding="utf-8"))
            self.feature_summary = meta.get("feature_summary", {}) or {}
            gi = meta.get("global_importance")
            if isinstance(gi, list) and gi:
                self.global_importance = gi
        except Exception:
            # If metadata missing, we’ll still attempt model-based importances.
            self.feature_summary = {}
            self.global_importance = None

        # If model exposes feature_importances_, backfill global importance
        if self.global_importance is None and hasattr(self.model, "feature_importances_"):
            imp = list(map(float, getattr(self.model, "feature_importances_")))
            # Log the top 8 features by importance like system.out.print in Java to appear in terminal
            print("Top 8 model feature importances (if available):")
            for f, i in zip(self.feature_names, imp):
                print(f"{f}: {i:.4f}")
            
            self.global_importance = [
                {"feature": f, "importance": float(i)}
                for f, i in zip(self.feature_names, imp)
            ]
            # Normalize to sum=1 for clean display
            total = sum(i["importance"] for i in self.global_importance) or 1.0
            for d in self.global_importance:
                d["importance"] = d["importance"] / total

        # Init (lazy) SHAP explainer
        self._explainer = None
        self._shap_expected = None

    def _build_research_context(self):
        top_global = []
        if self.global_importance:
            sorted_imp = sorted(
                self.global_importance,
                key=lambda d: d.get("importance", 0),
                reverse=True
            )
            top_global = [
                {
                    "feature": d.get("feature"),
                    "importance": float(d.get("importance", 0.0)),
                }
                for d in sorted_imp[:5]
            ]

        return {
            "final_model_name": type(self.model).__name__,
            "feature_count": len(self.feature_names),
            "final_metrics": self.NOTEBOOK_FINAL_METRICS,
            "cross_validation": self.NOTEBOOK_CV_STATS,
            "model_comparison": self.NOTEBOOK_MODEL_COMPARISON,
            "metric_explanations": self.METRIC_EXPLANATIONS,
            "top_global_features": top_global,
            "source_note": (
                "Performance metrics are from the finalized research notebook "
                "(hold-out test set + 10-fold cross-validation)."
            ),
        }

    def _ensure_shap(self, X: pd.DataFrame):
        """
        Lazily build a SHAP explainer if possible.
        Prefer TreeExplainer if the model is tree-based; otherwise KernelExplainer.
        """
        if not _HAS_SHAP or self._explainer is None:
            try:
                # Tree models
                if hasattr(self.model, "predict_proba") or hasattr(self.model, "feature_importances_"):
                    self._explainer = shap.TreeExplainer(self.model, feature_perturbation="interventional")
                else:
                    # Fallback to model-agnostic (slower)
                    # Use a small background (kmeans) to keep latency reasonable
                    bg = shap.sample(X, 50) if len(X) > 50 else X
                    self._explainer = shap.KernelExplainer(self.model.predict, bg)
                # Expected value
                # TreeExplainer: array-like; KernelExplainer: returns numpy
                ev = self._explainer.expected_value
                if isinstance(ev, (list, np.ndarray)):
                    self._shap_expected = float(np.array(ev).mean())
                else:
                    self._shap_expected = float(ev)
            except Exception:
                self._explainer = None
                self._shap_expected = None

    def _student_vs_cohort(self, row: dict):
        """
        Compare student values to cohort means/quantiles if available.
        Returns list of dicts for display.
        """
        out = []
        for f in self.feature_names:
            sv = row.get(f, None)
            meta = self.feature_summary.get(f, {})
            mean = meta.get("mean")
            p25 = meta.get("p25")
            p50 = meta.get("p50")
            p75 = meta.get("p75")

            status = None
            if mean is not None and sv is not None:
                try:
                    diff = float(sv) - float(mean)
                    if abs(diff) < 1e-9:
                        status = "at average"
                    else:
                        # Simple qualitative status; not a normative judgment—UI decides colors
                        status = "above average" if diff > 0 else "below average"
                except Exception:
                    status = None

            out.append({
                "feature": f,
                "student_value": sv,
                "mean": mean,
                "p25": p25,
                "p50": p50,
                "p75": p75,
                "status": status
            })
        return out

    def _generate_guidance(self, row: dict) -> list[str]:
        """
        Lightweight, hand-crafted guidance rules inspired by thesis findings.
        You can extend or replace with a learned text generator if desired.
        """
        tips = []
        a_avg = row.get("alevel_average_grade_weight")
        o_avg = row.get("average_olevel_grade")
        a_weak = row.get("alevel_count_weak_grades")
        hs_stab = row.get("high_school_performance_stability_index")
        gp = row.get("general_paper")

        if a_avg is not None:
            tips.append("Strong A‑Level average tends to correlate with higher CGPA.")
        if o_avg is not None and a_avg is not None:
            tips.append("Your O‑Level and A‑Level profiles together are influential.")
        if isinstance(a_weak, (int, float)) and a_weak >= 3:
            tips.append("Multiple weak A‑Level grades historically reduce CGPA.")
        if isinstance(hs_stab, (int, float)) and hs_stab < 0.7:
            tips.append("Your high‑school stability index is below the general median.")
        if gp is not None and int(gp) == 0:
            tips.append("General Paper not passed")
        if not tips:
            tips.append("Consistency is a strong predictor of positive outcomes.")

        # De‑duplicate while preserving order
        seen = set()
        deduped = []
        for t in tips:
            if t not in seen:
                deduped.append(t)
                seen.add(t)
        return deduped[:4]  # keep it tight

    def predict(self, features_dict: dict):
        """
        features_dict must contain the 23 keys above (extra keys are ignored upstream).
        Returns a rich dict with:
          - predicted_cgpa, performance_band
          - global_importance (top N)
          - shap (values by feature, expected_value)
          - comparisons (student vs cohort summary)
          - guidance (list of short strings)
        """
        # Keep only known features and preserve order
        row = {k: features_dict[k] for k in self.feature_names}
        X = pd.DataFrame([row], columns=self.feature_names)

        # Core prediction
        y = self.model.predict(X)
        cgpa = float(y[0])
        band = _default_band(cgpa)

        # Global importance (top 8 for signal/noise balance)
        global_imp = self.global_importance or []
        global_imp_sorted = sorted(global_imp, key=lambda d: d["importance"], reverse=True)
        global_top = global_imp_sorted[:8]

        # Cohort comparisons (if metadata is present)
        comparisons = self._student_vs_cohort(row) if self.feature_summary else []

        # Local SHAP values
        shap_payload = {"expected_value": None, "values": []}
        if _HAS_SHAP:
            try:
                # Boot explainer lazily using the row as background if needed
                self._ensure_shap(X)
                if self._explainer is not None:
                    # Some explainers return ndarray, others list-like
                    sv = self._explainer.shap_values(X)
                    # For regressors, TreeExplainer gives 1D array
                    if isinstance(sv, list):
                        # If a list (e.g., for multiclass), average contributions
                        sv = np.array(sv).mean(axis=0)
                    sv = np.array(sv).reshape(1, -1)  # (1, n_features)
                    shap_values_row = sv[0].tolist()
                    shap_payload = {
                        "expected_value": self._shap_expected,
                        "values": [
                            {"feature": f, "shap": float(s)}
                            for f, s in zip(self.feature_names, shap_values_row)
                        ],
                    }
            except Exception:
                # If SHAP fails for any reason, return empty payload
                shap_payload = {"expected_value": None, "values": []}

        # Light‑weight guidance
        guidance = self._generate_guidance(row)

        return {
            "predicted_cgpa": cgpa,
            "performance_band": band,
            "global_importance": global_top,
            "comparisons": comparisons,
            "shap": shap_payload,
            "guidance": guidance,
            "research_context": self._build_research_context(),
        }
