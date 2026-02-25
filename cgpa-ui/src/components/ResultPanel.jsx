// src/components/ResultPanel.jsx
import React, { useMemo } from "react";
import {
  Box,
  Paper,
  Grid,
  Typography,
  Chip,
  Divider,
  LinearProgress,
  Button,
  Tooltip,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

const FEATURE_LABELS = {
  age_at_entry: "Age at Entry",
  average_olevel_grade: "Average O-Level Grade",
  uce_credits: "UCE Credits",
  uce_distinctions: "UCE Distinctions",
  alevel_average_grade_weight: "A-Level Average Grade Weight",
  alevel_count_weak_grades: "A-Level Weak Grades",
  alevel_dominant_grade_weight: "A-Level Dominant Grade Weight",
  alevel_std_dev_grade_weight: "A-Level Grade Std Dev",
  count_weak_grades_olevel: "Weak O-Level Grades",
  olevel_subjects: "O-Level Subject Count",
  std_dev_olevel_grade: "O-Level Grade Std Dev",
  high_school_performance_variance: "High School Performance Variance",
  high_school_performance_stability_index: "High School Stability Index",
  marital_status: "Marital Status",
  level: "Academic Level",
  gender: "Gender",
  is_national: "Nationality",
  general_paper: "General Paper",
  campus_id_code: "Campus",
  program_id_code: "Program",
  uce_year_code: "UCE Year",
  uace_year_code: "UACE Year",
  year_of_entry_code: "Year of Entry",
};

const DEFAULT_RESEARCH_CONTEXT = {
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
  source_note:
    "Performance metrics are from the finalized research notebook (hold-out test set + 10-fold cross-validation).",
};

const formatFeature = (feature) =>
  FEATURE_LABELS[feature] ||
  feature
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const toMetric = (value, digits = 4) =>
  value == null || Number.isNaN(value) ? "—" : Number(value).toFixed(digits);

const toCgpa = (value) =>
  value == null || Number.isNaN(value) ? "—" : Number(value).toFixed(2);

const truncateText = (value, max = 36) => {
  if (typeof value !== "string") return value;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

const chipEllipsisSx = {
  maxWidth: "100%",
  "& .MuiChip-label": {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};

/**
 * Props:
 *  - result: API response object
 *  - payload: numeric payload submitted for prediction
 *  - lookupLabels: { campusName, programName } from CSV lookup maps
 */
export default function ResultPanel({ result, payload, lookupLabels = {} }) {
  const cgpa = result?.predicted_cgpa ?? null;
  const band = result?.performance_band ?? "—";
  const globalImp = useMemo(
    () =>
      Array.isArray(result?.global_importance) ? result.global_importance : [],
    [result?.global_importance]
  );
  const shapValues = useMemo(
    () => (Array.isArray(result?.shap?.values) ? result.shap.values : []),
    [result?.shap?.values]
  );
  const expected = result?.shap?.expected_value ?? null;
  const comparisons = useMemo(
    () => (Array.isArray(result?.comparisons) ? result.comparisons : []),
    [result?.comparisons]
  );
  const guidance = useMemo(
    () => (Array.isArray(result?.guidance) ? result.guidance : []),
    [result?.guidance]
  );

  const research = result?.research_context || DEFAULT_RESEARCH_CONTEXT;
  const finalMetrics = research?.final_metrics || {};
  const cvStats = research?.cross_validation || {};
  const comparisonMetrics = Array.isArray(research?.model_comparison)
    ? research.model_comparison
    : [];
  const metricExplanations = research?.metric_explanations || {};
  const topGlobalFromResearch = useMemo(
    () =>
      Array.isArray(research?.top_global_features)
        ? research.top_global_features
        : [],
    [research?.top_global_features]
  );

  const topShap = useMemo(() => {
    const sorted = [...shapValues].sort(
      (a, b) => Math.abs(b.shap) - Math.abs(a.shap)
    );
    return sorted.slice(0, 8).map((d) => ({ ...d, abs: Math.abs(d.shap) }));
  }, [shapValues]);

  const shapSanity = useMemo(() => {
    if (expected == null || shapValues.length === 0 || cgpa == null) return null;
    const sum = shapValues.reduce(
      (acc, item) => acc + (Number.isFinite(item.shap) ? item.shap : 0),
      0
    );
    return {
      expected,
      contributions: sum,
      expectedPlusContrib: expected + sum,
      modelOutput: cgpa,
      delta: expected + sum - cgpa,
    };
  }, [expected, shapValues, cgpa]);

  const programShap = shapValues.find((d) => d.feature === "program_id_code");
  const campusShap = shapValues.find((d) => d.feature === "campus_id_code");

  const topGlobalForChips = useMemo(() => {
    if (topGlobalFromResearch.length > 0) return topGlobalFromResearch;
    return [...globalImp]
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, 5);
  }, [topGlobalFromResearch, globalImp]);

  const topLocalContributors = useMemo(
    () =>
      topShap.slice(0, 3).map((item) => ({
        ...item,
        label: formatFeature(item.feature),
      })),
    [topShap]
  );

  const globalChartData = useMemo(
    () =>
      [...globalImp]
        .sort((a, b) => (b.importance || 0) - (a.importance || 0))
        .slice(0, 8)
        .map((item) => {
          const fullLabel = formatFeature(item.feature);
          return {
            ...item,
            fullLabel,
            shortLabel: truncateText(fullLabel, 24),
          };
        }),
    [globalImp]
  );

  const shapChartData = useMemo(
    () =>
      [...topShap].map((item) => {
        const fullLabel = formatFeature(item.feature);
        return {
          ...item,
          fullLabel,
          shortLabel: truncateText(fullLabel, 24),
        };
      }),
    [topShap]
  );

  const shapAxisDomain = useMemo(() => {
    const maxAbs = shapChartData.reduce(
      (max, item) => Math.max(max, Math.abs(item.shap || 0)),
      0
    );
    const bound = maxAbs > 0 ? Number((maxAbs * 1.2).toFixed(3)) : 0.1;
    return [-bound, bound];
  }, [shapChartData]);

  const selectedProgram = lookupLabels?.programName
    ? `${lookupLabels.programName} (${payload?.program_id_code ?? "—"})`
    : payload?.program_id_code ?? "—";
  const selectedCampus = lookupLabels?.campusName
    ? `${lookupLabels.campusName} (${payload?.campus_id_code ?? "—"})`
    : payload?.campus_id_code ?? "—";

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify({ payload, result }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    a.download = `cgpa_prediction_${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            spacing={1}
            sx={{ mb: 1.5 }}
          >
            <Typography variant="h6">Prediction Overview</Typography>
            <Button
              size="small"
              onClick={downloadJSON}
              variant="outlined"
            >
              Download Full JSON
            </Button>
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover", height: "100%" }}>
                <Typography variant="body2" color="text.secondary">
                  Predicted CGPA
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {toCgpa(cgpa)}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  <Chip size="small" color="success" variant="outlined" label={band} />
                  {expected != null && (
                    <Tooltip title="Baseline prediction before student-specific SHAP contributions.">
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`Baseline: ${toCgpa(expected)}`}
                      />
                    </Tooltip>
                  )}
                </Stack>
                <Box sx={{ mt: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, Math.max(0, ((cgpa || 0) / 5) * 100))}
                    sx={{ height: 8, borderRadius: 999 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    CGPA scale: 0.0 to 5.0
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} md={4}>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover", height: "100%" }}>
                <Typography variant="body2" color="text.secondary">
                  Selected Program and Campus
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <Tooltip title={`Program: ${selectedProgram}`}>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`Program: ${truncateText(String(selectedProgram), 32)}`}
                      sx={chipEllipsisSx}
                    />
                  </Tooltip>
                  <Tooltip title={`Campus: ${selectedCampus}`}>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`Campus: ${truncateText(String(selectedCampus), 32)}`}
                      sx={chipEllipsisSx}
                    />
                  </Tooltip>
                </Stack>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 1.5 }}
                >
                  SHAP local effects for this profile:
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                  <Chip
                    size="small"
                    color={(programShap?.shap ?? 0) >= 0 ? "success" : "warning"}
                    label={`Program Δ ${toCgpa(programShap?.shap)}`}
                  />
                  <Chip
                    size="small"
                    color={(campusShap?.shap ?? 0) >= 0 ? "success" : "warning"}
                    label={`Campus Δ ${toCgpa(campusShap?.shap)}`}
                  />
                </Stack>
              </Box>
            </Grid>

            <Grid item xs={12} md={4}>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover", height: "100%" }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Key drivers for this student
                </Typography>
                {topLocalContributors.length > 0 ? (
                  <Stack spacing={1}>
                    {topLocalContributors.map((item, idx) => (
                      <Chip
                        key={`${item.feature}-${idx}`}
                        size="small"
                        color={item.shap >= 0 ? "success" : "warning"}
                        label={`${truncateText(item.label, 26)}: ${
                          item.shap >= 0 ? "+" : ""
                        }${toMetric(item.shap, 3)}`}
                        sx={chipEllipsisSx}
                      />
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2">Top SHAP drivers are not available.</Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
                  Positive values push prediction upward. Negative values pull it downward.
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                  This is an advisory estimate, not a final academic decision.
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {guidance.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Advisory Insights
              </Typography>
              <List dense disablePadding>
                {guidance.map((tip, idx) => (
                  <ListItem key={idx} sx={{ alignItems: "flex-start", py: 0.5 }}>
                    <ListItemText
                      primaryTypographyProps={{ variant: "body2" }}
                      primary={`• ${tip}`}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </Paper>
      </Grid>

      <Grid item xs={12}>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Research Context and Model Performance
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Final model: <strong>{research?.final_model_name || "—"}</strong>, using{" "}
            <strong>{research?.feature_count || "—"}</strong> engineered/input features.
          </Typography>

          <Grid container spacing={2} sx={{ mb: 1 }}>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
                <Typography variant="overline">MAE</Typography>
                <Typography variant="h6">{toMetric(finalMetrics.mae, 4)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {metricExplanations.mae}
                </Typography>
                <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
                  Typical absolute gap is about {toCgpa(finalMetrics.mae)} CGPA points.
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
                <Typography variant="overline">RMSE</Typography>
                <Typography variant="h6">{toMetric(finalMetrics.rmse, 4)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {metricExplanations.rmse}
                </Typography>
                <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
                  Larger misses are penalized more than MAE.
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
                <Typography variant="overline">R²</Typography>
                <Typography variant="h6">{toMetric(finalMetrics.r2, 4)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {metricExplanations.r2}
                </Typography>
                <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
                  10-fold CV mean R²: {toMetric(cvStats.r2_mean, 4)} (std {toMetric(cvStats.r2_std, 4)}).
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {topGlobalForChips.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Top global drivers from the trained model:
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {topGlobalForChips.map((item, idx) => (
                  <Chip
                    key={`${item.feature}-${idx}`}
                    size="small"
                    variant="outlined"
                    label={`${formatFeature(item.feature)} (${toMetric(item.importance, 3)})`}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {comparisonMetrics.length > 0 && (
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 560 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Model</TableCell>
                    <TableCell align="right">MAE</TableCell>
                    <TableCell align="right">RMSE</TableCell>
                    <TableCell align="right">R²</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {comparisonMetrics.map((row) => (
                    <TableRow key={row.model}>
                      <TableCell>{row.model}</TableCell>
                      <TableCell align="right">{toMetric(row.mae, 4)}</TableCell>
                      <TableCell align="right">{toMetric(row.rmse, 4)}</TableCell>
                      <TableCell align="right">{toMetric(row.r2, 4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            {research?.source_note || DEFAULT_RESEARCH_CONTEXT.source_note}
          </Typography>
        </Paper>
      </Grid>

      <Grid item xs={12}>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Your Top Contributors (SHAP local effects)
          </Typography>
          {shapChartData.length > 0 ? (
            <Box sx={{ height: Math.max(320, shapChartData.length * 34 + 80) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...shapChartData].reverse()}
                  layout="vertical"
                  margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
                >
                  <XAxis type="number" domain={shapAxisDomain} allowDecimals />
                  <YAxis
                    type="category"
                    dataKey="shortLabel"
                    width={180}
                    tick={{ fontSize: 12 }}
                  />
                  <RTooltip
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.fullLabel || _
                    }
                    formatter={(_, __, item) => {
                      const { shap, abs } = item.payload;
                      return `${shap.toFixed(3)} (|Δ| ${abs.toFixed(3)})`;
                    }}
                  />
                  <ReferenceLine x={0} stroke="#808080" strokeDasharray="3 3" />
                  <Bar dataKey="shap" barSize={18}>
                    {[...shapChartData].reverse().map((item, idx) => (
                      <Cell key={idx} fill={item.shap >= 0 ? "#29b77b" : "#ff7f66"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Not available.
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            Positive bars push prediction upward; negative bars pull prediction downward.
          </Typography>
        </Paper>
      </Grid>

      <Grid item xs={12}>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Global Feature Importance (model-wide)
          </Typography>
          {globalChartData.length > 0 ? (
            <Box sx={{ height: Math.max(320, globalChartData.length * 34 + 80) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...globalChartData].reverse()}
                  layout="vertical"
                  margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
                >
                  <XAxis type="number" allowDecimals />
                  <YAxis
                    type="category"
                    dataKey="shortLabel"
                    width={180}
                    tick={{ fontSize: 12 }}
                  />
                  <RTooltip
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.fullLabel || _
                    }
                    formatter={(val) => Number(val).toFixed(3)}
                  />
                  <Bar dataKey="importance">
                    {[...globalChartData].reverse().map((_, idx) => (
                      <Cell key={idx} fill="#1b6ca8" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Not available.
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            Higher values mean the feature has stronger average influence across many students.
          </Typography>
        </Paper>
      </Grid>

      {comparisons.length > 0 && (
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Student vs Cohort Summary
            </Typography>
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 860 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Feature</TableCell>
                    <TableCell align="right">Your Value</TableCell>
                    <TableCell align="right">Mean</TableCell>
                    <TableCell align="right">P25</TableCell>
                    <TableCell align="right">P50</TableCell>
                    <TableCell align="right">P75</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {comparisons.slice(0, 30).map((row, idx) => (
                    <TableRow key={`${row.feature}-${idx}`}>
                      <TableCell>{formatFeature(row.feature)}</TableCell>
                      <TableCell align="right">{toCgpa(row.student_value)}</TableCell>
                      <TableCell align="right">{toCgpa(row.mean)}</TableCell>
                      <TableCell align="right">{toCgpa(row.p25)}</TableCell>
                      <TableCell align="right">{toCgpa(row.p50)}</TableCell>
                      <TableCell align="right">{toCgpa(row.p75)}</TableCell>
                      <TableCell>{row.status || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              Cohort statistics are loaded from stored training metadata.
            </Typography>
          </Paper>
        </Grid>
      )}

      <Grid item xs={12}>
        <Accordion defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Technical Appendix</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {shapSanity && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                SHAP sanity check: baseline {toCgpa(shapSanity.expected)} + contributions{" "}
                {toCgpa(shapSanity.contributions)} ≈ {toCgpa(shapSanity.expectedPlusContrib)} (model{" "}
                {toCgpa(shapSanity.modelOutput)}).
              </Typography>
            )}
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              Raw API response
            </Typography>
            <pre style={{ margin: 0, maxHeight: 240, overflow: "auto" }}>
              {JSON.stringify(result, null, 2)}
            </pre>
            <Typography variant="body2" sx={{ mt: 1.5, mb: 0.5 }}>
              Submitted payload (numeric)
            </Typography>
            <pre style={{ margin: 0, maxHeight: 240, overflow: "auto" }}>
              {JSON.stringify(payload, null, 2)}
            </pre>
          </AccordionDetails>
        </Accordion>
      </Grid>
    </Grid>
  );
}
