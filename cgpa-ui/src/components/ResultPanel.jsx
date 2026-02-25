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
import { DEFAULT_RESEARCH_CONTEXT } from "../constants/researchContext";

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

const formatFeature = (feature) =>
  FEATURE_LABELS[feature] ||
  feature
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const toCgpa = (value) =>
  value == null || Number.isNaN(value) ? "—" : Number(value).toFixed(2);
const toSigned = (value, digits = 3) =>
  value == null || Number.isNaN(value)
    ? "—"
    : `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(digits)}`;
const clampCgpa = (value) => Math.max(0, Math.min(5, value));

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
export default function ResultPanel({
  result,
  payload,
  lookupLabels = {},
  onOpenResearchReference,
}) {
  const cgpa = result?.predicted_cgpa ?? null;
  const band = result?.performance_band ?? "—";
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

  const topLocalContributors = useMemo(
    () =>
      topShap.slice(0, 4).map((item) => ({
        ...item,
        label: formatFeature(item.feature),
      })),
    [topShap]
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

  const confidenceBand = useMemo(() => {
    if (cgpa == null || Number.isNaN(Number(cgpa))) return null;
    const mae = Number(finalMetrics?.mae);
    const rmse = Number(finalMetrics?.rmse);
    if (!Number.isFinite(mae) || !Number.isFinite(rmse)) return null;
    const predicted = Number(cgpa);
    return {
      maeLow: clampCgpa(predicted - mae),
      maeHigh: clampCgpa(predicted + mae),
      rmseLow: clampCgpa(predicted - rmse),
      rmseHigh: clampCgpa(predicted + rmse),
    };
  }, [cgpa, finalMetrics?.mae, finalMetrics?.rmse]);

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
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={1}
            sx={{ mb: 1.5 }}
          >
            <Typography variant="h6">Prediction Overview</Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{ alignSelf: { xs: "stretch", sm: "auto" } }}
            >
              {onOpenResearchReference && (
                <Button size="small" onClick={onOpenResearchReference}>
                  Research and Viva Notes
                </Button>
              )}
              <Button
                size="small"
                onClick={downloadJSON}
                variant="outlined"
                sx={{ alignSelf: { xs: "stretch", sm: "auto" } }}
              >
                Download Full JSON
              </Button>
            </Stack>
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} lg={4}>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover", height: "100%" }}>
                <Typography variant="body2" color="text.secondary">
                  Predicted CGPA
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {toCgpa(cgpa)}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  useFlexGap
                  flexWrap="wrap"
                  sx={{ mt: 1 }}
                >
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
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 1.5 }}
                >
                  Advisory use only, not a final academic decision.
                </Typography>
                {confidenceBand && (
                  <Paper
                    variant="outlined"
                    sx={{ p: 1.25, mt: 1.5, borderRadius: 1.5, bgcolor: "background.paper" }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      Prediction confidence band
                    </Typography>
                    <Typography variant="body2">
                      Typical (plus/minus MAE): {toCgpa(confidenceBand.maeLow)} to{" "}
                      {toCgpa(confidenceBand.maeHigh)}
                    </Typography>
                    <Typography variant="body2">
                      Conservative (plus/minus RMSE): {toCgpa(confidenceBand.rmseLow)} to{" "}
                      {toCgpa(confidenceBand.rmseHigh)}
                    </Typography>
                  </Paper>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} lg={8}>
              <Stack spacing={2} sx={{ height: "100%" }}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Selected Program and Campus
                  </Typography>
                  <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        Program
                      </Typography>
                      <Tooltip title={String(selectedProgram)}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                          {selectedProgram}
                        </Typography>
                      </Tooltip>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        Campus
                      </Typography>
                      <Tooltip title={String(selectedCampus)}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                          {selectedCampus}
                        </Typography>
                      </Tooltip>
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="caption" color="text.secondary">
                    SHAP local effects for this profile
                  </Typography>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    useFlexGap
                    flexWrap="wrap"
                    sx={{ mt: 1 }}
                  >
                    <Chip
                      size="small"
                      color={(programShap?.shap ?? 0) >= 0 ? "success" : "warning"}
                      label={`Program Δ ${toSigned(programShap?.shap, 3)}`}
                      sx={chipEllipsisSx}
                    />
                    <Chip
                      size="small"
                      color={(campusShap?.shap ?? 0) >= 0 ? "success" : "warning"}
                      label={`Campus Δ ${toSigned(campusShap?.shap, 3)}`}
                      sx={chipEllipsisSx}
                    />
                  </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Key drivers for this student
                  </Typography>
                  {topLocalContributors.length > 0 ? (
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {topLocalContributors.map((item, idx) => (
                        <Box
                          key={`${item.feature}-${idx}`}
                          sx={{
                            p: 1,
                            borderRadius: 1,
                            bgcolor: "background.paper",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1,
                            minWidth: 0,
                          }}
                        >
                          <Tooltip title={item.label}>
                            <Typography variant="body2" sx={{ minWidth: 0 }} noWrap>
                              {item.label}
                            </Typography>
                          </Tooltip>
                          <Chip
                            size="small"
                            color={item.shap >= 0 ? "success" : "warning"}
                            label={toSigned(item.shap, 3)}
                          />
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Top SHAP drivers are not available.
                    </Typography>
                  )}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 1.25 }}
                  >
                    Positive values push prediction upward. Negative values pull it downward.
                  </Typography>
                </Paper>
              </Stack>
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
                  <ListItem key={idx} sx={{ alignItems: "flex-start", py: 0.5, px: 0 }}>
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
