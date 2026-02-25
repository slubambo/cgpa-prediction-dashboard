import React, { useMemo } from "react";
import {
  Grid,
  TextField,
  MenuItem,
  Typography,
  Paper,
  Autocomplete,
  Box,
} from "@mui/material";

const DATASET_MIN_YEAR = 2000;
const YEAR_FUTURE_BUFFER = 1;
const MIN_AGE = 14;
const MAX_AGE = 70;

const isEmpty = (value) =>
  value === "" || value === null || typeof value === "undefined";

const DemographicsForm = ({ data, onChange, touched = {} }) => {
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear + YEAR_FUTURE_BUFFER;

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = maxYear; y >= DATASET_MIN_YEAR; y -= 1) years.push(y);
    return years;
  }, [maxYear]);

  const ageOptions = useMemo(
    () =>
      Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => MIN_AGE + i),
    []
  );

  const req = (name) => ({
    error: touched[name] && isEmpty(data[name]),
    helperText: touched[name] && isEmpty(data[name]) ? "Required" : " ",
  });

  const setAge = (nextAge) => {
    if (nextAge === null || nextAge === "") {
      onChange("age_at_entry", "");
      return;
    }
    const parsed = Number(nextAge);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(MIN_AGE, Math.min(MAX_AGE, Math.round(parsed)));
    onChange("age_at_entry", clamped);
  };

  const setEntryYear = (nextYear) => {
    if (nextYear === null || nextYear === "") {
      onChange("year_of_entry_code", "");
      return;
    }
    const parsed = Number(nextYear);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(DATASET_MIN_YEAR, Math.min(maxYear, parsed));
    onChange("year_of_entry_code", clamped);
  };

  const ageValue = Number.isFinite(Number(data.age_at_entry))
    ? Number(data.age_at_entry)
    : null;
  const entryYearValue = Number.isFinite(Number(data.year_of_entry_code))
    ? Number(data.year_of_entry_code)
    : null;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 3 },
        mb: 3,
        borderRadius: 1,
        bgcolor: "background.paper",
        borderColor: "divider",
      }}
    >
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
        Basic student details for prediction. These do not restrict program options.
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          mb: 2.5,
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: "action.hover",
          borderColor: "transparent",
          borderLeft: (t) => `3px solid ${t.palette.primary.main}`,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          <strong>Age at Entry</strong> means the age when the student starts university
          in the selected <strong>Year of Entry</strong>.
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            select
            fullWidth
            required
            label="Marital Status"
            inputProps={{ "aria-label": "Marital Status" }}
            value={
              isEmpty(data.marital_status) ? "" : Number(data.marital_status)
            }
            onChange={(e) => onChange("marital_status", Number(e.target.value))}
            error={req("marital_status").error}
            helperText={req("marital_status").helperText}
          >
            <MenuItem value={0}>Single</MenuItem>
            <MenuItem value={1}>Married</MenuItem>
            <MenuItem value={2}>Other</MenuItem>
          </TextField>
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            select
            fullWidth
            required
            label="Gender"
            inputProps={{ "aria-label": "Gender" }}
            value={isEmpty(data.gender) ? "" : Number(data.gender)}
            onChange={(e) => onChange("gender", Number(e.target.value))}
            error={req("gender").error}
            helperText={req("gender").helperText}
          >
            <MenuItem value={1}>Male</MenuItem>
            <MenuItem value={0}>Female</MenuItem>
          </TextField>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Autocomplete
            options={ageOptions}
            value={ageValue}
            onChange={(_, value) => setAge(value)}
            getOptionLabel={(option) => String(option)}
            autoHighlight
            fullWidth
            renderInput={(params) => (
              <TextField
                {...params}
                required
                label="Age at Entry"
                inputProps={{
                  ...params.inputProps,
                  inputMode: "numeric",
                  "aria-label": "Age at entry (when joining university)",
                }}
                error={req("age_at_entry").error}
                helperText={
                  req("age_at_entry").error
                    ? req("age_at_entry").helperText
                    : `Select or type age (${MIN_AGE}-${MAX_AGE}) at university entry.`
                }
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Autocomplete
            options={yearOptions}
            value={entryYearValue}
            onChange={(_, value) => setEntryYear(value)}
            getOptionLabel={(option) => String(option)}
            autoHighlight
            fullWidth
            renderInput={(params) => (
              <TextField
                {...params}
                required
                label="Year of Entry"
                inputProps={{
                  ...params.inputProps,
                  inputMode: "numeric",
                  "aria-label": "Year of university entry",
                }}
                error={req("year_of_entry_code").error}
                helperText={
                  req("year_of_entry_code").error
                    ? req("year_of_entry_code").helperText
                    : `Select or type the university entry year (${DATASET_MIN_YEAR}-${maxYear}).`
                }
              />
            )}
          />
        </Grid>
      </Grid>
    </Paper>
  );
};

export default DemographicsForm;
