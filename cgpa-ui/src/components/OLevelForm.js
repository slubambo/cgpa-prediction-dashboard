import React, { useMemo, useEffect } from "react";
import {
  Grid,
  TextField,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  LinearProgress,
  Box,
  Chip,
  Divider,
  Paper,
} from "@mui/material";

const thisYear = new Date().getFullYear();
const UCE_MIN_YEAR = 1980;
const uceYears = Array.from(
  { length: thisYear - UCE_MIN_YEAR + 1 },
  (_, i) => thisYear - i
);

const MIN_SUBJ = 6;
const MAX_SUBJ = 10;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const DEFAULT_NUMERIC_COUNTS = Object.freeze({
  D1: 0,
  D2: 0,
  C3: 0,
  C4: 0,
  C5: 0,
  C6: 0,
  P7: 0,
  P8: 0,
  F9: 0,
});
const DEFAULT_LETTER_COUNTS = Object.freeze({
  A: 0,
  B: 0,
  C: 0,
  D: 0,
  E: 0,
  F: 0,
});
const toFinite = (value) => {
  if (value === "" || value === null || typeof value === "undefined") {
    return NaN;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const expand = (pairs) => {
  const out = [];
  for (const { value, count } of pairs) {
    for (let i = 0; i < count; i++) out.push(value);
  }
  return out;
};

const mean = (arr) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const stddev = (arr, m) => {
  if (!arr.length) return 0;
  const v = arr.reduce((s, x) => s + Math.pow(x - m, 2), 0) / arr.length;
  return Math.sqrt(v);
};

const LETTER_TO_NUM = { A: 2, B: 4, C: 6, D: 7.5, E: 8.5, F: 9 };

const OLevelForm = ({ data, onChange, touched = {} }) => {
  // ---- read persisted UI state from parent ----
  const mode = data.olevel_mode || "numeric";
  const numericCounts = useMemo(
    () => data.olevel_numericCounts || DEFAULT_NUMERIC_COUNTS,
    [data.olevel_numericCounts]
  );
  const letterCounts = useMemo(
    () => data.olevel_letterCounts || DEFAULT_LETTER_COUNTS,
    [data.olevel_letterCounts]
  );

  const req = (name) => ({
    value: data[name] ?? "",
    error: touched[name] && (data[name] === "" || data[name] === null),
    helperText:
      touched[name] && (data[name] === "" || data[name] === null)
        ? "Required"
        : " ",
  });

  const subjects = clamp(Number(data.olevel_subjects || 0), MIN_SUBJ, MAX_SUBJ);

  const totalAllocated = useMemo(() => {
    const src = mode === "numeric" ? numericCounts : letterCounts;
    return Object.values(src).reduce((a, b) => a + Number(b || 0), 0);
  }, [mode, numericCounts, letterCounts]);

  const derived = useMemo(() => {
    let distinctions = 0,
      credits = 0,
      weak = 0,
      statsVector = [];
    if (mode === "numeric") {
      const n = numericCounts;
      distinctions = (n.D1 || 0) + (n.D2 || 0);
      credits = (n.C3 || 0) + (n.C4 || 0) + (n.C5 || 0) + (n.C6 || 0);
      weak = (n.C6 || 0) + (n.P7 || 0) + (n.P8 || 0) + (n.F9 || 0);
      statsVector = expand([
        { value: 1, count: n.D1 || 0 },
        { value: 2, count: n.D2 || 0 },
        { value: 3, count: n.C3 || 0 },
        { value: 4, count: n.C4 || 0 },
        { value: 5, count: n.C5 || 0 },
        { value: 6, count: n.C6 || 0 },
        { value: 7, count: n.P7 || 0 },
        { value: 8, count: n.P8 || 0 },
        { value: 9, count: n.F9 || 0 },
      ]);
    } else {
      const L = letterCounts;
      distinctions = L.A || 0;
      credits = (L.B || 0) + (L.C || 0);
      weak = (L.D || 0) + (L.E || 0) + (L.F || 0);
      statsVector = expand([
        { value: LETTER_TO_NUM.A, count: L.A || 0 },
        { value: LETTER_TO_NUM.B, count: L.B || 0 },
        { value: LETTER_TO_NUM.C, count: L.C || 0 },
        { value: LETTER_TO_NUM.D, count: L.D || 0 },
        { value: LETTER_TO_NUM.E, count: L.E || 0 },
        { value: LETTER_TO_NUM.F, count: L.F || 0 },
      ]);
    }
    const avg = Number(mean(statsVector).toFixed(2));
    const sd = Number(stddev(statsVector, mean(statsVector)).toFixed(3));
    return { distinctions, credits, weak, avg, sd };
  }, [mode, numericCounts, letterCounts]);

  // Push derived features up whenever inputs change
  useEffect(() => {
    onChange("olevel_subjects", subjects || "");
    onChange("uce_distinctions", derived.distinctions);
    onChange("uce_credits", derived.credits);
    onChange("count_weak_grades_olevel", derived.weak);
    onChange("average_olevel_grade", derived.avg);
    onChange("std_dev_olevel_grade", derived.sd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, mode, numericCounts, letterCounts, derived]);

  const numericFields = [
    ["D1", "D1 (Grade 1)"],
    ["D2", "D2 (Grade 2)"],
    ["C3", "C3 (Credit 3)"],
    ["C4", "C4 (Credit 4)"],
    ["C5", "C5 (Credit 5)"],
    ["C6", "C6 (Credit 6)"],
    ["P7", "P7 (Pass 7)"],
    ["P8", "P8 (Pass 8)"],
    ["F9", "F9 (Fail 9)"],
  ];

  const letterFields = [
    ["A", "A (≈ D1–D2)"],
    ["B", "B (≈ C3–C4)"],
    ["C", "C (≈ C5–C6)"],
    ["D", "D (≈ P7)"],
    ["E", "E (≈ P8)"],
    ["F", "F (Fail 9)"],
  ];

  const numberInputProps = {
    inputMode: "numeric",
    step: 1,
    min: 0,
    pattern: "[0-9]*",
  };

  // UCE year options are constrained so invalid years cannot be selected.
  const uceYear = toFinite(data.uce_year_code);
  const entryYear = toFinite(data.year_of_entry_code);
  const uaceYear = toFinite(data.uace_year_code);
  const uceYearHas = !Number.isNaN(uceYear);
  const entryYearHas = !Number.isNaN(entryYear);
  const uaceYearHas = !Number.isNaN(uaceYear);

  const maxUceYear = Math.min(
    entryYearHas ? entryYear - 3 : thisYear,
    uaceYearHas ? uaceYear - 2 : thisYear,
    thisYear
  );
  const constrainedUceYears = uceYears.filter((yr) => yr <= maxUceYear);

  const uceReq = req("uce_year_code");
  const uceHelper = uceReq.error
    ? uceReq.helperText
    : constrainedUceYears.length === 0
    ? "No valid UCE year available for current year selections."
    : entryYearHas && uaceYearHas
    ? "Years shown satisfy both Entry and UACE year ordering."
    : entryYearHas
    ? "Only years at least 3 years before university entry are shown."
    : "Select Year of Entry first to narrow valid UCE years.";

  useEffect(() => {
    if (!uceYearHas) return;
    if (constrainedUceYears.includes(uceYear)) return;
    onChange("uce_year_code", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uceYear, uceYearHas, constrainedUceYears]);

  return (
    <>
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
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="UCE Year"
              required
              value={data.uce_year_code || ""}
              onChange={(e) =>
                onChange("uce_year_code", Number(e.target.value))
              }
              error={uceReq.error}
              helperText={uceHelper}
            >
              <MenuItem value="" disabled>
                {constrainedUceYears.length === 0
                  ? "No valid UCE years yet"
                  : "Select year"}
              </MenuItem>
              {constrainedUceYears.map((yr) => (
                <MenuItem key={yr} value={yr}>
                  {yr}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Number of subjects"
              type="number"
              value={subjects || ""}
              onChange={(e) => {
                const v = clamp(
                  Number(e.target.value || 0),
                  MIN_SUBJ,
                  MAX_SUBJ
                );
                onChange("olevel_subjects", v);
              }}
              inputProps={{ ...numberInputProps, max: MAX_SUBJ }}
              helperText={`Enter between ${MIN_SUBJ} and ${MAX_SUBJ} subjects`}
              required
            />
          </Grid>
        </Grid>
      </Paper>

      <Grid item xs={12}>
        <ToggleButtonGroup
          color="primary"
          value={mode}
          exclusive
          onChange={(_, val) => {
            if (val) onChange("olevel_mode", val);
          }}
          aria-label="grading mode"
        >
          <ToggleButton value="letters" aria-label="new grading">
            Alphabetic (New grading)
          </ToggleButton>
          <ToggleButton value="numeric" aria-label="old grading">
            Numeric (Old grading)
          </ToggleButton>
        </ToggleButtonGroup>
        <Box mt={1} display="flex" alignItems="center" gap={1}>
          <Box flex={1}>
            <LinearProgress
              variant="determinate"
              value={subjects ? (totalAllocated / subjects) * 100 : 0}
              color={totalAllocated === subjects && subjects > 0 ? "success" : "primary"}
              sx={{
                height: 8,
                borderRadius: 999,
                bgcolor: "action.hover",
                "& .MuiLinearProgress-bar": { borderRadius: 999 },
              }}
            />
          </Box>
          <Chip
            size="small"
            label={`${totalAllocated}/${subjects} allocated`}
            variant="outlined"
            color={
              totalAllocated === subjects && subjects > 0
                ? "success"
                : totalAllocated > subjects
                ? "error"
                : "default"
            }
            sx={{ fontWeight: 600 }}
          />
        </Box>
      </Grid>

      <Paper
        variant="outlined"
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 1,
          bgcolor: "background.paper",
          borderColor: "divider",
          mt: 2,
        }}
      >
        <Grid container spacing={2}>
          {(mode === "numeric" ? numericFields : letterFields).map(
            ([key, label]) => {
              const src = mode === "numeric" ? numericCounts : letterCounts;
              const maxForField = subjects - (totalAllocated - (src[key] || 0));

              return (
                <Grid item xs={12} sm={6} md={4} key={key}>
                  <TextField
                    fullWidth
                    type="number"
                    label={label}
                    value={src[key] ?? 0}
                    onChange={(e) => {
                      const base = {
                        ...(mode === "numeric" ? numericCounts : letterCounts),
                      };
                      const currentTotal = Object.entries(base).reduce(
                        (s, [k, v]) => (k === key ? s : s + (v || 0)),
                        0
                      );
                      const max = clamp(subjects - currentTotal, 0, subjects);
                      const value = clamp(Number(e.target.value || 0), 0, max);
                      base[key] = value;

                      if (mode === "numeric") {
                        onChange("olevel_numericCounts", base);
                      } else {
                        onChange("olevel_letterCounts", base);
                      }
                    }}
                    inputProps={{
                      ...numberInputProps,
                      max: clamp(maxForField, 0, subjects),
                    }}
                    helperText={`Max: ${clamp(maxForField, 0, subjects)}`}
                    disabled={subjects === 0 || maxForField === 0}
                  />
                </Grid>
              );
            }
          )}
        </Grid>
      </Paper>

      <Grid item xs={12}>
        <Divider />
      </Grid>

      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          borderRadius: 1,
          bgcolor: "action.hover",
          borderColor: "divider",
          mt: 2,
        }}
      >
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Distinctions (auto)"
              value={derived.distinctions}
              fullWidth
              InputProps={{ readOnly: true }}
              helperText={mode === "numeric" ? "D1 + D2" : "A"}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Credits (auto)"
              value={derived.credits}
              fullWidth
              InputProps={{ readOnly: true }}
              helperText={mode === "numeric" ? "C3 + C4 + C5 + C6" : "B + C"}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Weak grades (auto)"
              value={derived.weak}
              fullWidth
              InputProps={{ readOnly: true }}
              helperText={
                mode === "numeric" ? "C6 + P7 + P8 + F9" : "D + E + F"
              }
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Average grade (auto)"
              value={derived.avg}
              fullWidth
              InputProps={{ readOnly: true }}
              helperText={
                mode === "numeric"
                  ? "Exact mean of 1–9 values"
                  : "Approximate using A≈2 … F=9"
              }
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Std. deviation (auto)"
              value={derived.sd}
              fullWidth
              InputProps={{ readOnly: true }}
              helperText="Spread of your grades"
            />
          </Grid>
        </Grid>
      </Paper>
    </>
  );
};

export default OLevelForm;
