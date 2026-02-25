// src/components/InstitutionalForm.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Grid,
  TextField,
  MenuItem,
  Autocomplete,
  Typography,
  CircularProgress,
  Chip,
  Box,
  Paper,
} from "@mui/material";

// UI labels are 1-based for readability.
// We store 0-based in data.level (for the model), so convert UI->model by subtracting 1,
// and show model->UI by adding 1.
const UI_LEVEL_LABELS = {
  1: "Certificate / Diploma",
  2: "Bachelor’s",
  3: "Master’s",
  4: "PhD",
  5: "Short Courses",
  6: "Postgraduate Diploma",
  7: "University Bridging Year",
  8: "Unknown",
};

function InstitutionalForm({ data, onChange, touched = {} }) {
  const [campusOptions, setCampusOptions] = useState([]);
  const [programRows, setProgramRows] = useState([]); // { campus_id_code, level_code(0-based), program_core_id, program_id_code, program_name }
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ---- Small helpers
  const req = (name) => ({
    // keep storing 0-based in data.level for the model
    value:
      name === "level"
        ? typeof data.level === "number"
          ? data.level + 1 // display as 1-based
          : ""
        : data[name] ?? "",
    error:
      touched[name] &&
      (data[name] === "" ||
        data[name] === null ||
        typeof data[name] === "undefined"),
    helperText:
      touched[name] &&
      (data[name] === "" ||
        data[name] === null ||
        typeof data[name] === "undefined")
        ? "Required"
        : " ",
  });

  const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const header = lines[0].split(",").map((s) => s.trim());
    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((s) => s.trim());
      const obj = {};
      header.forEach((h, i) => (obj[h] = cols[i]));
      return obj;
    });
  };

  // ---- Load lookups from /public/lookups
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");

    (async () => {
      try {
        // campuses.csv
        const cRes = await fetch("/lookups/campuses.csv");
        if (!cRes.ok) throw new Error("campuses.csv not found");
        const cTxt = await cRes.text();
        const cRows = parseCSV(cTxt);
        const campuses = cRows
          .map((r) => ({
            label: (r.campus_name || "").trim(),
            value: Number(r.campus_id_code),
          }))
          .filter((o) => o.label && o.label !== "" && Number.isFinite(o.value))
          .sort((a, b) => {
            // Main Campus first, then Kampala, then alphabetical
            const aL = a.label.toLowerCase();
            const bL = b.label.toLowerCase();
            const aIsMain = aL.includes("main");
            const bIsMain = bL.includes("main");
            const aIsKla = aL.includes("kampala");
            const bIsKla = bL.includes("kampala");
            if (aIsMain && !bIsMain) return -1;
            if (!aIsMain && bIsMain) return 1;
            if (aIsKla && !bIsKla) return -1;
            if (!aIsKla && bIsKla) return 1;
            return a.label.localeCompare(b.label);
          });

        // programs_by_campus.csv (level_code is 0-based)
        const pRes = await fetch("/lookups/programs_by_campus.csv");
        if (!pRes.ok) throw new Error("programs_by_campus.csv not found");
        const pTxt = await pRes.text();
        const pRows = parseCSV(pTxt)
          .map((r) => ({
            campus_id_code: Number(r.campus_id_code),
            level_code: Number(r.level_code), // 0-based in CSV
            program_core_id: Number(r.program_core_id),
            program_id_code: Number(r.program_id_code),
            program_name: (r.program_name || "").trim(),
          }))
          .filter(
            (r) =>
              r.program_name !== "" &&
              Number.isFinite(r.program_id_code) &&
              Number.isFinite(r.campus_id_code) &&
              Number.isFinite(r.level_code) &&
              Number.isFinite(r.program_core_id)
          );

        if (!cancelled) {
          setCampusOptions(campuses);
          setProgramRows(pRows);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            "We couldn’t load the campus/program lists. Please check that both files exist: /public/lookups/campuses.csv and /public/lookups/programs_by_campus.csv."
          );
          setCampusOptions([]);
          setProgramRows([]);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---- State derivations
  const campusChosen =
    typeof data.campus_id_code !== "undefined" &&
    data.campus_id_code !== "" &&
    data.campus_id_code !== null;

  const levelChosen =
    typeof data.level !== "undefined" &&
    data.level !== "" &&
    data.level !== null &&
    Number.isFinite(Number(data.level));

  // Level options for chosen campus (build from CSV 0-based → map to UI 1-based)
  const levelOptions = useMemo(() => {
    if (!campusChosen) return [];
    const campusId = Number(data.campus_id_code);
    const codes0 = new Set(
      programRows
        .filter((r) => r.campus_id_code === campusId)
        .map((r) => r.level_code)
        .filter((v) => Number.isFinite(v))
    );
    // sort ascending; map to UI labels (1-based)
    const opts = Array.from(codes0)
      .sort((a, b) => a - b)
      .map((code0) => {
        const uiVal = code0 + 1;
        return {
          value: uiVal,
          label: UI_LEVEL_LABELS[uiVal] || `Level ${uiVal}`,
          code0,
        };
      });
    return opts;
  }, [programRows, data.campus_id_code, campusChosen]);

  // Program options filtered by campus + internal level (UI - 1)
  const programOptions = useMemo(() => {
    if (!campusChosen || !levelChosen) return [];
    const campusId = Number(data.campus_id_code);
    const needLevel0 = Number(data.level); // already 0-based internally

    const rows = programRows.filter(
      (r) => r.campus_id_code === campusId && r.level_code === needLevel0
    );

    // Dedupe display labels by program name, but keep one underlying program_id_code.
    const byName = new Map();
    for (const r of rows) {
      const key = r.program_name.toLowerCase();
      if (!key) continue;

      if (!byName.has(key)) {
        byName.set(key, {
          value: r.program_id_code,
          label: r.program_name,
          altValues: [r.program_id_code],
        });
      } else {
        const existing = byName.get(key);
        if (!existing.altValues.includes(r.program_id_code)) {
          existing.altValues.push(r.program_id_code);
        }
      }
    }

    return Array.from(byName.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [
    programRows,
    campusChosen,
    levelChosen,
    data.campus_id_code,
    data.level,
  ]);

  const selectedProgramOption = useMemo(() => {
    const selected = Number(data.program_id_code);
    if (!Number.isFinite(selected)) return null;
    // Match by primary value OR any alternate program_id_code for the same name
    return (
      programOptions.find(
        (option) =>
          Number(option.value) === selected ||
          (option.altValues && option.altValues.includes(selected))
      ) || null
    );
  }, [programOptions, data.program_id_code]);

  useEffect(() => {
    // Don't clear program while CSV data is still loading
    if (loading) return;
    if (!data.program_id_code) return;
    if (selectedProgramOption) return;
    // Only clear if we have options loaded and the selection genuinely doesn't match
    if (programOptions.length === 0 && campusChosen && levelChosen) return;
    onChange("program_id_code", "");
  }, [data.program_id_code, onChange, selectedProgramOption, loading, programOptions.length, campusChosen, levelChosen]);

  // Small counters for hints
  const levelCountForCampus = levelOptions.length;
  const programCountForSelection = programOptions.length;

  // ---- Rendering
  if (loading) {
    return (
      <Box sx={{ mt: 1 }}>
        <Typography variant="h6" gutterBottom>
          Institutional Placement
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={20} />
          <Typography variant="body2">Loading campus and program lists…</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1 }}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ position: "absolute", height: 0, overflow: "hidden" }}>
          Institutional Placement
        </legend>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          Choose your <strong>campus</strong>, then pick the{" "}
          <strong>academic level</strong>, and finally select the{" "}
          <strong>program</strong>.
          <br />
          <em>
            Note: The program must match the campus and level you select. If you
            change campus or level, you may need to re-select the program.
          </em>
        </Typography>

        {loadError ? (
          <Typography color="error" variant="body2" gutterBottom>
            {loadError}
          </Typography>
        ) : null}

        <Paper
          variant="outlined"
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 1,
            bgcolor: "background.paper",
            borderColor: "divider",
            marginTop: 2,
          }}
        >
          <Grid container spacing={2}>
            {/* Campus */}
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Campus"
                placeholder="Select campus"
                required
                inputProps={{ "aria-label": "Campus" }}
                {...req("campus_id_code")}
                onChange={(e) => {
                  const campusVal = Number(e.target.value);
                  onChange("campus_id_code", campusVal);
                  // reset level & program when campus changes
                  onChange("level", "");
                  onChange("program_id_code", "");
                }}
                helperText={
                  req("campus_id_code").error
                    ? req("campus_id_code").helperText
                    : `Available levels: ${levelCountForCampus || 0}`
                }
              >
                {campusOptions.map((o) => (
                  <MenuItem
                    key={o.value}
                    value={o.value}
                    style={{ whiteSpace: "normal", lineHeight: 1.2 }}
                  >
                    {o.label}
                  </MenuItem>
                ))}
                {campusOptions.length === 0 && (
                  <MenuItem disabled value="">
                    No campuses found
                  </MenuItem>
                )}
              </TextField>
            </Grid>

            {/* Level (UI is 1-based; stored as 0-based) */}
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Academic Level"
                placeholder="Select level"
                required
                inputProps={{ "aria-label": "Academic level" }}
                {...req("level")}
                onChange={(e) => {
                  const uiVal = Number(e.target.value); // 1-based from UI
                  const modelVal = uiVal - 1; // 0-based for model & CSV
                  onChange("level", modelVal);
                  // reset program when level changes
                  onChange("program_id_code", "");
                }}
                disabled={!campusChosen}
                helperText={
                  !campusChosen
                    ? "Select campus first"
                    : req("level").error
                    ? req("level").helperText
                    : `Programs available: ${programCountForSelection || 0}`
                }
              >
                {levelOptions.map((o) => (
                  <MenuItem
                    key={o.value}
                    value={o.value}
                    style={{ whiteSpace: "normal", lineHeight: 1.2 }}
                  >
                    {o.label}
                  </MenuItem>
                ))}
                {levelOptions.length === 0 && (
                  <MenuItem disabled value="">
                    {campusChosen
                      ? "No levels for selected campus"
                      : "Select campus first"}
                  </MenuItem>
                )}
              </TextField>
            </Grid>

            {/* Program */}
            <Grid item xs={12}>
              <Autocomplete
                options={programOptions}
                value={selectedProgramOption}
                onChange={(_, option) =>
                  onChange("program_id_code", option ? Number(option.value) : "")
                }
                isOptionEqualToValue={(option, value) =>
                  Number(option.value) === Number(value.value)
                }
                getOptionLabel={(option) => option?.label || ""}
                disabled={!campusChosen || !levelChosen}
                noOptionsText={
                  !campusChosen
                    ? "Select campus first"
                    : !levelChosen
                    ? "Select level first"
                    : "No programs for selected campus and level"
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Program"
                    required
                    placeholder="Search and select program"
                    error={req("program_id_code").error}
                    helperText={
                      !campusChosen
                        ? "Select campus first"
                        : !levelChosen
                        ? "Select level first"
                        : req("program_id_code").error
                        ? req("program_id_code").helperText
                        : `${programCountForSelection} unique program name${
                            programCountForSelection === 1 ? "" : "s"
                          } available`
                    }
                    inputProps={{
                      ...params.inputProps,
                      "aria-label": "Program search and select",
                    }}
                  />
                )}
              />
            </Grid>

            {/* Nationality (1=National, 0=International) */}
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                required
                label="Nationality"
                placeholder="Select nationality"
                {...req("is_national")}
                onChange={(e) =>
                  onChange("is_national", Number(e.target.value))
                }
                helperText={
                  req("is_national").error
                    ? req("is_national").helperText
                    : "Used for reporting only; does not change available programs."
                }
              >
                <MenuItem value={1}>National</MenuItem>
                <MenuItem value={0}>International</MenuItem>
              </TextField>
            </Grid>

            {/* Small context chips (purely informational) */}
            <Grid
              item
              xs={12}
              sm={6}
              sx={{
                display: "flex",
                gap: 1,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {campusChosen && (
                <Chip
                  size="small"
                  label={`Campus selected`}
                  color="default"
                  variant="outlined"
                />
              )}
              {levelChosen && (
                <Chip
                  size="small"
                  label={`Level: ${
                    UI_LEVEL_LABELS[(data.level ?? 0) + 1] ??
                    (data.level ?? 0) + 1
                  }`}
                  color="default"
                  variant="outlined"
                />
              )}
              {data.program_id_code ? (
                <Chip
                  size="small"
                  label={`Program chosen`}
                  color="default"
                  variant="outlined"
                />
              ) : null}
            </Grid>
          </Grid>
        </Paper>
      </fieldset>
    </Box>
  );
}

export default InstitutionalForm;
