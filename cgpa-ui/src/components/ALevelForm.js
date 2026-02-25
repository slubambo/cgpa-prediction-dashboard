import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Grid,
  TextField,
  Typography,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Chip,
  Box,
  FormControl,
  InputLabel,
  Select,
  Divider,
  LinearProgress,
} from "@mui/material";

// ---- Grading systems (ordered as requested) ----
const GRADING = {
  LEGACY_25: "LEGACY_25", // earliest: max 25 era (4 principals + GP)
  CLASSIC_18: "CLASSIC_18", // well-known “18-point” era (3 principals + subsidiaries)
  COMPETENCY_60: "COMPETENCY_60", // current competency-based; HEIs often map to 60
};

const LETTERS = ["A", "B", "C", "D", "E", "O", "F"];

// Points per letter for each system (used to compute the features you emit)
const POINTS = {
  [GRADING.LEGACY_25]: { A: 9, B: 8, C: 7, D: 6, E: 5, O: 1, F: 0 },
  [GRADING.CLASSIC_18]: { A: 6, B: 5, C: 4, D: 3, E: 2, O: 1, F: 0 },
  [GRADING.COMPETENCY_60]: { A: 20, B: 15, C: 10, D: 5, E: 2, O: 1, F: 0 },
};

// Distinction/weak rules for features
const isWeak = (letter) => letter === "D" || letter === "E" || letter === "F";

// UACE year options
const CURRENT_YEAR = new Date().getFullYear();
const UACE_MIN_YEAR = 1980;
const ALL_UACE_YEARS = Array.from(
  { length: CURRENT_YEAR - UACE_MIN_YEAR + 1 },
  (_, i) => CURRENT_YEAR - i
);

// Subject limits per framework (principals only)
const SUBJECT_LIMITS = {
  [GRADING.LEGACY_25]: { min: 4, max: 4 },
  [GRADING.CLASSIC_18]: { min: 3, max: 3 },
  [GRADING.COMPETENCY_60]: { min: 2, max: 3 },
};

const toFinite = (value) => {
  if (value === "" || value === null || typeof value === "undefined") {
    return NaN;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

// Helper: only emit to parent when values truly changed
function emitIfChanged(prevRef, next, emit) {
  const prev = prevRef.current || {};
  let changed = false;
  for (const k of Object.keys(next)) {
    if (prev[k] !== next[k]) {
      changed = true;
      break;
    }
  }
  if (changed) {
    prevRef.current = next;
    for (const [k, v] of Object.entries(next)) emit(k, v);
  }
}

export default function ALevelForm({ data, onChange, touched = {} }) {
  // ---- Stabilize onChange for effects (avoid loops)
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // ---- Local UI state (rehydrate from data if present)
  const initialGrading = (data && data._alevel_grading) || GRADING.CLASSIC_18;
  const [grading, setGrading] = useState(initialGrading);

  const [uaceYear, setUaceYear] = useState(
    typeof data.uace_year_code === "number"
      ? data.uace_year_code
      : ""
  );

  const [gpPass, setGpPass] = useState(
    typeof data.general_paper === "number" ? data.general_paper : 1
  );

  // For count, prefer saved value (if valid for the framework), otherwise min
  const limitsAtInit = SUBJECT_LIMITS[initialGrading];
  const savedCount = Number.isFinite(data?._alevel_principalCount)
    ? data._alevel_principalCount
    : undefined;
  const [principalCount, setPrincipalCount] = useState(
    savedCount
      ? Math.min(limitsAtInit.max, Math.max(limitsAtInit.min, savedCount))
      : limitsAtInit.min
  );

  // Subjects: prefer stored array; otherwise start EMPTY
  const savedSubjects = Array.isArray(data?._alevel_subjects)
    ? data._alevel_subjects
    : null;
  const [subjects, setSubjects] = useState(
    savedSubjects && savedSubjects.length
      ? savedSubjects.slice(0, Math.max(3, principalCount))
      : Array.from({ length: Math.max(3, principalCount) }, () => "")
  );

  // Sync principalCount when framework changes (respect limits)
  useEffect(() => {
    const { min, max } = SUBJECT_LIMITS[grading];
    setPrincipalCount((prev) => {
      if (grading === GRADING.COMPETENCY_60) {
        return Math.min(max, Math.max(min, prev));
      }
      return min; // fixed for legacy/classic
    });
  }, [grading]);

  // Ensure subjects array has enough slots; trim if too many
  useEffect(() => {
    setSubjects((prev) => {
      let next = [...prev];
      if (next.length < principalCount) {
        next = next.concat(
          Array.from({ length: principalCount - next.length }, () => "")
        );
      } else if (next.length > principalCount) {
        next = next.slice(0, principalCount);
      }
      return next;
    });
  }, [principalCount]);

  // Persist UI-only state back to parent (so it survives navigation)
  useEffect(() => {
    onChangeRef.current("_alevel_grading", grading);
    onChangeRef.current("_alevel_principalCount", principalCount);
    onChangeRef.current("_alevel_subjects", subjects);
  }, [grading, principalCount, subjects]);

  // ---- Derived calculations (principals only)
  const calc = useMemo(() => {
    const pts = POINTS[grading];
    const letters = subjects.slice(0, principalCount).filter((x) => x !== "");

    const weights = letters.map((L) => pts[L] ?? 0);
    const total = weights.reduce((a, b) => a + b, 0);
    const avg = weights.length ? total / weights.length : 0;

    const mean = avg;
    const variance =
      weights.length > 1
        ? weights.reduce((s, x) => s + Math.pow(x - mean, 2), 0) /
          weights.length
        : 0;
    const std = Math.sqrt(variance);

    // dominant (mode) weight
    const freq = new Map();
    for (const w of weights) freq.set(w, (freq.get(w) || 0) + 1);
    const dominant =
      weights.length === 0
        ? 0
        : [...freq.entries()].sort((a, b) =>
            a[1] === b[1] ? b[0] - a[0] : b[1] - a[1]
          )[0][0];

    const countWeak = letters.filter(isWeak).length;

    // Following your variance/stability pattern
    const hsVariance = Number((std || 0).toFixed(3));
    const hsStability = Number(
      (hsVariance > 0 ? 1 / (1 + hsVariance) : 1).toFixed(3)
    );

    return {
      alevel_total_grade_weight: Number(total.toFixed(2)),
      alevel_average_grade_weight: Number(avg.toFixed(2)),
      alevel_std_dev_grade_weight: Number(std.toFixed(3)),
      alevel_dominant_grade_weight: dominant,
      alevel_count_weak_grades: countWeak,
      alevel_num_subjects: letters.length,
      high_school_performance_variance: hsVariance,
      high_school_performance_stability_index: hsStability,
    };
  }, [grading, subjects, principalCount]);

  // ---- Emit to parent model only when data values actually changed
  const lastEmitted = useRef(null);
  useEffect(() => {
    emitIfChanged(
      lastEmitted,
      {
        uace_year_code: uaceYear,
        general_paper: gpPass,
        ...calc,
      },
      (k, v) => onChangeRef.current(k, v)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uaceYear, gpPass, calc]);

  // ---- Field helper
  const req = (name, value) => ({
    value,
    error:
      touched[name] &&
      (value === "" || value === null || typeof value === "undefined"),
    helperText:
      touched[name] &&
      (value === "" || value === null || typeof value === "undefined")
        ? "Required"
        : " ",
  });

  // UACE years are constrained so invalid options are not shown.
  const entryYear = toFinite(data.year_of_entry_code);
  const uceYear = toFinite(data.uce_year_code);
  const entryHas = !Number.isNaN(entryYear);
  const uceHas = !Number.isNaN(uceYear);

  const minUaceYear = uceHas ? uceYear + 2 : UACE_MIN_YEAR;
  const maxUaceYear = entryHas ? entryYear - 1 : CURRENT_YEAR;
  const constrainedUaceYears = ALL_UACE_YEARS.filter(
    (year) => year >= minUaceYear && year <= maxUaceYear
  );

  const uaceReq = req("uace_year_code", uaceYear);
  const uaceHelper = uaceReq.error
    ? uaceReq.helperText
    : constrainedUaceYears.length === 0
    ? "No valid UACE year for the selected Entry and UCE years."
    : entryHas && uceHas
    ? "Years shown satisfy both Entry and UCE year ordering."
    : entryHas
    ? "Only years at least 1 year before university entry are shown."
    : "Select Year of Entry first to narrow valid UACE years.";

  useEffect(() => {
    const selected = Number(uaceYear);
    const hasSelected = Number.isFinite(selected);
    if (!hasSelected) return;
    if (constrainedUaceYears.includes(selected)) return;
    setUaceYear("");
  }, [uaceYear, constrainedUaceYears]);

  // ---- UI helpers
  // const { min: minSubs, max: maxSubs } = SUBJECT_LIMITS[grading];

  // ---- Progress (purely visual)
  const filledSubjects = subjects
    .slice(0, principalCount)
    .filter(Boolean).length;
  const totalRequired = principalCount + 2; // principals + (Year + GP)
  const completed =
    filledSubjects +
    (uaceYear ? 1 : 0) +
    (gpPass === 0 || gpPass === 1 ? 1 : 0);
  const progress = Math.round((completed / totalRequired) * 100);

  return (
    <Box sx={{ mt: 4 }}>
      {/* Header card */}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 1,
          bgcolor: "background.paper",
          borderColor: "divider",
        }}
      >
        <Typography variant="subtitle1" gutterBottom>
          Subjects & Grading
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select the grading era you used, enter your UACE year and General
          Paper result, then choose letter grades for your principal subjects.
          We’ll compute the model features automatically.
        </Typography>

        <Box sx={{ mt: 2 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 5 }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 0.5 }}
          >
            Form completion: {progress}%
          </Typography>
        </Box>
      </Paper>

      {/* Framework switch */}
      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 1,
          bgcolor: "background.default",
          borderColor: "divider",
        }}
      >
        <Typography variant="subtitle1" gutterBottom>
          Grading framework
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Choose the grading framework used when you sat UACE.
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={grading}
          onChange={(_, v) => v && setGrading(v)}
          size="small"
          sx={{ flexWrap: "wrap", gap: 1 }}
        >
          <ToggleButton value={GRADING.CLASSIC_18}>
            Classic (18 pts)
          </ToggleButton>
          <ToggleButton value={GRADING.LEGACY_25}>Legacy (25 pts)</ToggleButton>
          <ToggleButton value={GRADING.COMPETENCY_60}>
            Competency (≈60 pts)
          </ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ mt: 2, p: 2, borderRadius: 1, bgcolor: "action.hover" }}>
          <Typography variant="body2" color="text.secondary">
            {grading === GRADING.LEGACY_25 && (
              <>
                <strong>Legacy (Max 25 points):</strong> Typically{" "}
                <strong>4 principal subjects</strong> were offered (letters
                A–F), with General Paper taken separately. Mapping used: A=9,
                B=8, C=7, D=6, E=5, O=1, F=0.
              </>
            )}
            {grading === GRADING.CLASSIC_18 && (
              <>
                <strong>Classic (Max 18 points):</strong> Standard era with{" "}
                <strong>3 principal subjects</strong>. Universities aggregate
                best three principals out of 18 (A=6, B=5, C=4, D=3, E=2; O=1,
                F=0). Subsidiaries (GP, Sub‑Math/ICT/Bio) are policy
                requirements but not counted in the principal‑weight features
                here.
              </>
            )}
            {grading === GRADING.COMPETENCY_60 && (
              <>
                <strong>Competency‑Based (Current):</strong> Offer{" "}
                <strong>2–3 principal subjects</strong> plus compulsory core
                (e.g., GP, Sub‑ICT). Mapping used: A≈20, B≈15, C≈10, D≈5, E≈2;
                O=1, F=0.
              </>
            )}
          </Typography>
        </Box>

        {/* Principal count selector */}
        <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "center" }}>
          <FormControl size="small" sx={{ width: 280 }}>
            <InputLabel id="principal-count-label">
              Number of principal subjects
            </InputLabel>
            <Select
              labelId="principal-count-label"
              label="Number of principal subjects"
              value={principalCount}
              onChange={(e) => {
                const val = Number(e.target.value);
                const { min, max } = SUBJECT_LIMITS[grading];
                setPrincipalCount(Math.min(max, Math.max(min, val)));
              }}
              disabled={grading !== GRADING.COMPETENCY_60}
            >
              {Array.from(
                {
                  length:
                    SUBJECT_LIMITS[grading].max -
                    SUBJECT_LIMITS[grading].min +
                    1,
                },
                (_, i) => SUBJECT_LIMITS[grading].min + i
              ).map((n) => (
                <MenuItem key={n} value={n}>
                  {n} principal{n > 1 ? "s" : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Chip
            size="small"
            variant="outlined"
            label={
              grading === GRADING.LEGACY_25
                ? "Framework: 4 principals (+GP)"
                : grading === GRADING.CLASSIC_18
                ? "Framework: 3 principals (+subs)"
                : "Framework: 2–3 principals (+core)"
            }
          />
        </Box>
      </Paper>

      {/* Inputs */}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 1,
          bgcolor: "background.paper",
          borderColor: "divider",
        }}
      >
        <Typography variant="subtitle1" gutterBottom>
          Enter your details
        </Typography>
        <Grid container spacing={2.5}>
          {/* UACE Year */}
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="UACE Year"
              value={uaceYear}
              onChange={(e) => setUaceYear(Number(e.target.value))}
              error={uaceReq.error}
              helperText={uaceHelper}
            >
              <MenuItem value="" disabled>
                {constrainedUaceYears.length === 0
                  ? "No valid UACE years yet"
                  : "Select year"}
              </MenuItem>
              {constrainedUaceYears.map((y) => (
                <MenuItem key={y} value={y}>
                  {y}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* General Paper */}
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="General Paper (Pass?)"
              value={gpPass}
              onChange={(e) => setGpPass(Number(e.target.value))}
              helperText="Often required for admission; not part of principal‑weight totals."
            >
              <MenuItem value={1}>Passed</MenuItem>
              <MenuItem value={0}>Did not pass</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Principal letter inputs */}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 1,
          bgcolor: "background.paper",
          borderColor: "divider",
        }}
      >
        <Grid container spacing={2.5}>
          {Array.from({ length: principalCount }).map((_, i) => (
            <Grid item xs={12} sm={6} md={6} key={i}>
              <TextField
                select
                fullWidth
                label={`Subject ${i + 1} (Letter grade)`}
                value={subjects[i] ?? ""}
                onChange={(e) => {
                  const next = [...subjects];
                  next[i] = e.target.value;
                  setSubjects(next);
                }}
                helperText="Choose A, B, C, D, E, O or F"
              >
                <MenuItem value="">— select —</MenuItem>
                {LETTERS.map((L) => (
                  <MenuItem key={L} value={L}>
                    {L}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Computed features (read‑only) */}
      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          borderRadius: 3,
          bgcolor: "action.hover",
          borderColor: "divider",
        }}
      >
        <Typography variant="subtitle1" gutterBottom>
          Computed features (sent to the model)
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Chip
            label={`Principals: ${calc.alevel_num_subjects}`}
            size="small"
          />
          <Chip
            label={`Total weight: ${calc.alevel_total_grade_weight}`}
            size="small"
          />
          <Chip
            label={`Average: ${calc.alevel_average_grade_weight}`}
            size="small"
          />
          <Chip
            label={`Std dev: ${calc.alevel_std_dev_grade_weight}`}
            size="small"
          />
          <Chip
            label={`Dominant weight: ${calc.alevel_dominant_grade_weight}`}
            size="small"
          />
          <Chip
            label={`Weak grades: ${calc.alevel_count_weak_grades}`}
            size="small"
          />
          <Chip
            label={`HS variance: ${calc.high_school_performance_variance}`}
            size="small"
          />
          <Chip
            label={`Stability idx: ${calc.high_school_performance_stability_index}`}
            size="small"
          />
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1 }}
        >
          Distinction = A; Weak = D/E/F. Points per letter depend on the
          selected framework. (Subsidiaries like GP/Sub‑ICT aren’t included in
          these principal‑weight features.)
        </Typography>
      </Paper>
    </Box>
  );
}
