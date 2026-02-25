# routes/predictor.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Extra
from models.predictor import CGPAPredictor
from pathlib import Path
from typing import List, Optional

router = APIRouter()

# Robust model path (adjust if your file lives somewhere else)
MODEL_PATH = Path(__file__).resolve().parents[2] / "final_best_cgpa_model.pkl"
predictor = CGPAPredictor(MODEL_PATH)

# ---------- Request schema (unchanged) ----------
class PredictionRequest(BaseModel):
    # Demographics / institutional
    age_at_entry: float
    marital_status: int
    is_national: int
    gender: int
    level: int

    # Years / codes
    year_of_entry_code: int
    uce_year_code: int
    uace_year_code: int

    # O-Level
    olevel_subjects: int
    uce_distinctions: int
    uce_credits: int
    average_olevel_grade: float
    count_weak_grades_olevel: int
    std_dev_olevel_grade: float

    # A-Level
    general_paper: int
    alevel_average_grade_weight: float
    alevel_std_dev_grade_weight: float
    alevel_dominant_grade_weight: float
    alevel_count_weak_grades: int

    # Institutional codes
    campus_id_code: int
    program_id_code: int

    # Derived HS performance
    high_school_performance_variance: float
    high_school_performance_stability_index: float

    class Config:
        # If the UI accidentally sends extra fields, ignore them instead of 422
        extra = Extra.ignore


# ---------- Response schema (enhanced) ----------
class ImportanceItem(BaseModel):
    feature: str
    importance: float

class ComparisonItem(BaseModel):
    feature: str
    student_value: Optional[float] = None
    mean: Optional[float] = None
    p25: Optional[float] = None
    p50: Optional[float] = None
    p75: Optional[float] = None
    status: Optional[str] = None  # "above average" | "below average" | "at average" | None

class ShapItem(BaseModel):
    feature: str
    shap: float

class ShapPayload(BaseModel):
    expected_value: Optional[float]
    values: List[ShapItem]

class ModelMetricItem(BaseModel):
    model: str
    mae: float
    rmse: float
    r2: float

class FinalMetrics(BaseModel):
    mae: float
    rmse: float
    r2: float

class CrossValidationStats(BaseModel):
    r2_mean: float
    r2_std: float

class ResearchContext(BaseModel):
    final_model_name: str
    feature_count: int
    final_metrics: FinalMetrics
    cross_validation: CrossValidationStats
    model_comparison: List[ModelMetricItem] = []
    metric_explanations: dict[str, str] = {}
    top_global_features: List[ImportanceItem] = []
    source_note: str

class PredictionResponse(BaseModel):
    predicted_cgpa: float
    performance_band: str
    global_importance: List[ImportanceItem] = []
    comparisons: List[ComparisonItem] = []
    shap: ShapPayload = ShapPayload(expected_value=None, values=[])
    guidance: List[str] = []
    research_context: Optional[ResearchContext] = None


@router.post("/api/predict", response_model=PredictionResponse)
async def predict_cgpa(request: PredictionRequest):
    """
    Returns a rich payload:
      - predicted_cgpa, performance_band
      - global_importance (top ~8)
      - comparisons (student vs. cohort stats if metadata available)
      - shap (local explanation) when SHAP is available
      - guidance (2–4 short tips)
    """
    try:
        enriched = predictor.predict(request.dict())
        return PredictionResponse(**enriched)
    except KeyError as ke:
        # This would only happen if any of the 23 keys is missing internally
        raise HTTPException(status_code=400, detail=f"Missing required feature: {ke}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/lookups")
async def get_lookups():
    # Keep light; you can backfill campus/program lists later
    return {"campus_ids": [], "program_ids": []}
