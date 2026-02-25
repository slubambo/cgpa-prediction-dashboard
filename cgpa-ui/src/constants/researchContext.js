export const DEFAULT_RESEARCH_CONTEXT = {
  final_model_name: "RandomForestRegressor",
  feature_count: 23,
  final_metrics: { mae: 0.3126, rmse: 0.4158, r2: 0.2417 },
  cross_validation: { r2_mean: 0.2501, r2_std: 0.0598 },
  model_comparison: [
    { model: "Linear Regression", mae: 0.3244, rmse: 0.4281, r2: 0.1961 },
    { model: "Ridge Regression", mae: 0.3243, rmse: 0.428, r2: 0.1962 },
    { model: "Lasso Regression", mae: 0.3254, rmse: 0.4319, r2: 0.1817 },
    { model: "Random Forest (untuned)", mae: 0.3157, rmse: 0.4194, r2: 0.2283 },
    { model: "XGBoost", mae: 0.3286, rmse: 0.4331, r2: 0.177 },
    { model: "Random Forest (tuned final)", mae: 0.3126, rmse: 0.4158, r2: 0.2417 },
  ],
  metric_explanations: {
    mae: "Mean Absolute Error: average absolute difference between predicted and actual CGPA. Lower is better.",
    rmse: "Root Mean Squared Error: similar to MAE but penalizes larger mistakes more strongly. Lower is better.",
    r2: "R-squared: proportion of CGPA variation explained by the model. Higher is better.",
  },
  top_global_features: [
    { feature: "average_olevel_grade", importance: 0.228 },
    { feature: "level", importance: 0.13 },
    { feature: "year_of_entry_code", importance: 0.1 },
    { feature: "alevel_average_grade_weight", importance: 0.083 },
    { feature: "program_id_code", importance: 0.076 },
  ],
  source_note:
    "Performance metrics are from the finalized research notebook (hold-out test set + 10-fold cross-validation).",
};

