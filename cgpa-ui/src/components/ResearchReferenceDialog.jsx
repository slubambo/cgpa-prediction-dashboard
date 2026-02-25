import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  Box,
  Button,
  Typography,
  Grid,
  Paper,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { DEFAULT_RESEARCH_CONTEXT } from "../constants/researchContext";

const toMetric = (value, digits = 4) =>
  value == null || Number.isNaN(value) ? "—" : Number(value).toFixed(digits);

const formatFeature = (feature) =>
  (feature || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const computeRelativeGain = (bestBaseline, finalValue, lowerIsBetter = true) => {
  if (
    bestBaseline == null ||
    finalValue == null ||
    Number.isNaN(Number(bestBaseline)) ||
    Number.isNaN(Number(finalValue))
  ) {
    return null;
  }

  const baseline = Number(bestBaseline);
  const final = Number(finalValue);
  const absolute = lowerIsBetter ? baseline - final : final - baseline;
  const percent = baseline === 0 ? 0 : (absolute / Math.abs(baseline)) * 100;
  return { absolute, percent };
};

export default function ResearchReferenceDialog({
  open,
  onClose,
  researchContext,
  globalImportance = [],
}) {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("md"));

  const context = researchContext || DEFAULT_RESEARCH_CONTEXT;
  const finalMetrics = context?.final_metrics || DEFAULT_RESEARCH_CONTEXT.final_metrics;
  const modelComparison = Array.isArray(context?.model_comparison)
    ? context.model_comparison
    : DEFAULT_RESEARCH_CONTEXT.model_comparison;
  const metricExplanations =
    context?.metric_explanations || DEFAULT_RESEARCH_CONTEXT.metric_explanations;

  const topGlobal = useMemo(() => {
    if (Array.isArray(context?.top_global_features) && context.top_global_features.length > 0) {
      return context.top_global_features.slice(0, 8);
    }
    if (Array.isArray(globalImportance) && globalImportance.length > 0) {
      return [...globalImportance]
        .sort((a, b) => (b.importance || 0) - (a.importance || 0))
        .slice(0, 8);
    }
    return DEFAULT_RESEARCH_CONTEXT.top_global_features;
  }, [context?.top_global_features, globalImportance]);

  const bestBaseline = useMemo(() => {
    const finalModelName = (context?.final_model_name || "").toLowerCase();
    const baselineRows = modelComparison.filter((row) => {
      const name = String(row.model || "").toLowerCase();
      if (name.includes("final")) return false;
      if (finalModelName && name.includes(finalModelName)) return false;
      return true;
    });
    if (baselineRows.length === 0) return null;

    return {
      bestMae: Math.min(...baselineRows.map((row) => Number(row.mae))),
      bestRmse: Math.min(...baselineRows.map((row) => Number(row.rmse))),
      bestR2: Math.max(...baselineRows.map((row) => Number(row.r2))),
    };
  }, [context?.final_model_name, modelComparison]);

  const maeGain = computeRelativeGain(bestBaseline?.bestMae, finalMetrics?.mae, true);
  const rmseGain = computeRelativeGain(bestBaseline?.bestRmse, finalMetrics?.rmse, true);
  const r2Gain = computeRelativeGain(bestBaseline?.bestR2, finalMetrics?.r2, false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isSmall}
    >
      <DialogContent sx={{ p: 0 }}>
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: "divider",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h6">Research and Viva Reference</Typography>
            <Typography variant="body2" color="text.secondary">
              Model-wide context that is constant across predictions.
            </Typography>
          </Box>
          <Button variant="outlined" onClick={onClose}>
            Close
          </Button>
        </Box>

        <Box sx={{ p: 2.5 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Final Model Snapshot
                </Typography>
                <Typography variant="body2">
                  <strong>Model:</strong> {context?.final_model_name || "—"}
                </Typography>
                <Typography variant="body2">
                  <strong>Features:</strong> {context?.feature_count || "—"}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>MAE:</strong> {toMetric(finalMetrics?.mae, 4)}
                </Typography>
                <Typography variant="body2">
                  <strong>RMSE:</strong> {toMetric(finalMetrics?.rmse, 4)}
                </Typography>
                <Typography variant="body2">
                  <strong>R2:</strong> {toMetric(finalMetrics?.r2, 4)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
                  {context?.source_note || DEFAULT_RESEARCH_CONTEXT.source_note}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={8}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Why Random Forest Was Kept as Final
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
                  Compared against the best non-final baselines, the tuned final model
                  gives better error and fit metrics.
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip
                    size="small"
                    label={
                      maeGain
                        ? `MAE improvement: ${toMetric(maeGain.absolute, 4)} (${toMetric(maeGain.percent, 1)}%)`
                        : "MAE improvement: —"
                    }
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label={
                      rmseGain
                        ? `RMSE improvement: ${toMetric(rmseGain.absolute, 4)} (${toMetric(rmseGain.percent, 1)}%)`
                        : "RMSE improvement: —"
                    }
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label={
                      r2Gain
                        ? `R2 gain: ${toMetric(r2Gain.absolute, 4)} (${toMetric(r2Gain.percent, 1)}%)`
                        : "R2 gain: —"
                    }
                    variant="outlined"
                  />
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Model Comparison (from Notebook)
                </Typography>
                <TableContainer sx={{ overflowX: "auto" }}>
                  <Table size="small" sx={{ minWidth: 640 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Model</TableCell>
                        <TableCell align="right">MAE</TableCell>
                        <TableCell align="right">RMSE</TableCell>
                        <TableCell align="right">R2</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {modelComparison.map((row) => (
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
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Metric Notes for Non-Technical Audience
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, height: "100%" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        MAE ({toMetric(finalMetrics?.mae, 4)})
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {metricExplanations?.mae}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, height: "100%" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        RMSE ({toMetric(finalMetrics?.rmse, 4)})
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {metricExplanations?.rmse}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, height: "100%" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        R2 ({toMetric(finalMetrics?.r2, 4)})
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {metricExplanations?.r2}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Top Model-Wide Drivers
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {topGlobal.map((item, idx) => (
                    <Chip
                      key={`${item.feature}-${idx}`}
                      size="small"
                      variant="outlined"
                      label={`${formatFeature(item.feature)} (${toMetric(item.importance, 3)})`}
                    />
                  ))}
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Viva Delivery Notes
                </Typography>
                <Typography variant="body2">1. Start with problem, data, and model choice.</Typography>
                <Typography variant="body2">2. Explain MAE first, then RMSE, then R2.</Typography>
                <Typography variant="body2">3. Present prediction as advisory with uncertainty, not as a final decision.</Typography>
                <Typography variant="body2">4. Use SHAP local effects to explain a specific student profile.</Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

