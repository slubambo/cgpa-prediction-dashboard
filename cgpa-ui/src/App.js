// src/App.js
import React, { useState, useMemo, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Container,
  Typography,
  Grid,
  Button,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Box,
  CssBaseline,
  ThemeProvider,
  Paper,
  Stack,
  IconButton,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import { createAppTheme } from "./styles/theme";

import SectionCard from "./components/SectionCard";
import DemographicsForm from "./components/DemographicsForm";
import OLevelForm from "./components/OLevelForm";
import ALevelForm from "./components/ALevelForm";
import InstitutionalForm from "./components/InstitutionalForm";
import SummarySidebar from "./components/SummarySidebar";
import ResultPanel from "./components/ResultPanel";
import ResearchReferenceDialog from "./components/ResearchReferenceDialog";

const steps = ["Demographics", "O-Level", "A-Level", "Institutional", "Review"];

// Map step index <-> sidebar section key (must match SummarySidebar’s internal keys)
const stepToSection = ["demographics", "olevel", "alevel", "institutional"];
const sectionToStep = {
  demographics: 0,
  olevel: 1,
  alevel: 2,
  institutional: 3,
};

const FIELD_LABELS = {
  age_at_entry: "Age at Entry",
  marital_status: "Marital Status",
  is_national: "Nationality",
  gender: "Gender",
  level: "Academic Level",
  year_of_entry_code: "Year of Entry",
  uce_year_code: "UCE Year",
  olevel_subjects: "O-Level Subject Count",
  uce_distinctions: "UCE Distinctions",
  uce_credits: "UCE Credits",
  average_olevel_grade: "Average O-Level Grade",
  count_weak_grades_olevel: "Weak O-Level Grades",
  std_dev_olevel_grade: "O-Level Grade Std Dev",
  uace_year_code: "UACE Year",
  general_paper: "General Paper",
  alevel_average_grade_weight: "A-Level Average Grade Weight",
  alevel_std_dev_grade_weight: "A-Level Grade Std Dev",
  alevel_dominant_grade_weight: "A-Level Dominant Grade Weight",
  alevel_count_weak_grades: "A-Level Weak Grade Count",
  campus_id_code: "Campus",
  program_id_code: "Program",
  high_school_performance_variance: "High School Performance Variance",
  high_school_performance_stability_index: "High School Stability Index",
};

const STEP_REQUIRED_FIELDS = {
  0: ["marital_status", "gender", "age_at_entry", "year_of_entry_code"],
  1: ["uce_year_code", "olevel_subjects"],
  2: ["uace_year_code", "general_paper"],
  3: ["campus_id_code", "level", "program_id_code", "is_national"],
};

const parseCsvWithExpectedColumns = (text, expectedCols) => {
  const rows = text.trim().split(/\r?\n/);
  if (rows.length < 2) return [];
  return rows.slice(1).map((line) => {
    const cols = line.split(",");
    if (cols.length <= expectedCols) return cols;
    const fixed = cols.slice(0, expectedCols - 1);
    fixed.push(cols.slice(expectedCols - 1).join(","));
    return fixed;
  });
};

// keep a single source of truth for a blank form
const getInitialFormData = () => ({
  age_at_entry: "",
  marital_status: "",
  is_national: "",
  gender: "",
  level: "",
  year_of_entry_code: "",
  uce_year_code: "",
  olevel_subjects: "",
  uce_distinctions: "",
  uce_credits: "",
  average_olevel_grade: "",
  count_weak_grades_olevel: "",
  std_dev_olevel_grade: "",
  uace_year_code: "",
  general_paper: "",
  alevel_average_grade_weight: "",
  alevel_std_dev_grade_weight: "",
  alevel_dominant_grade_weight: "",
  alevel_count_weak_grades: "",
  campus_id_code: "",
  program_id_code: "",
  high_school_performance_variance: "",
  high_school_performance_stability_index: "",
});

function App() {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState(getInitialFormData);
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [researchDialogOpen, setResearchDialogOpen] = useState(false);
  const [themeMode, setThemeMode] = useState(() => {
    try {
      return localStorage.getItem("cgpa-dashboard-theme-mode") === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });
  const [campusById, setCampusById] = useState({});
  const [programById, setProgramById] = useState({});

  const theme = useMemo(() => createAppTheme({ mode: themeMode }), [themeMode]);
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));

  // Smoothly scroll to top on step change (keeps users oriented)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeStep]);

  useEffect(() => {
    try {
      localStorage.setItem("cgpa-dashboard-theme-mode", themeMode);
    } catch {
      // Keep non-blocking if local storage is unavailable.
    }
  }, [themeMode]);

  useEffect(() => {
    let cancelled = false;

    const loadLookups = async () => {
      try {
        const [campusResp, programResp] = await Promise.all([
          fetch("/lookups/campuses.csv"),
          fetch("/lookups/programs_by_campus.csv"),
        ]);
        if (!campusResp.ok || !programResp.ok) return;

        const [campusTxt, programTxt] = await Promise.all([
          campusResp.text(),
          programResp.text(),
        ]);

        const campusRows = parseCsvWithExpectedColumns(campusTxt, 2);
        const programRows = parseCsvWithExpectedColumns(programTxt, 5);

        const campusMap = {};
        campusRows.forEach((r) => {
          const id = Number(r[0]);
          const name = (r[1] || "").trim();
          if (Number.isFinite(id) && name) campusMap[id] = name;
        });

        const programMap = {};
        programRows.forEach((r) => {
          const id = Number(r[3]);
          const name = (r[4] || "").trim();
          if (Number.isFinite(id) && name && !programMap[id]) {
            programMap[id] = name;
          }
        });

        if (!cancelled) {
          setCampusById(campusMap);
          setProgramById(programMap);
        }
      } catch (lookupErr) {
        // Keep silently resilient; lookups are UX enhancement only.
      }
    };

    loadLookups();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFormChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTouched((t) => ({ ...t, [field]: true }));
    setError(null);
  }, []);

  const castPayload = useMemo(() => {
    const n = (v) => (v === "" || v === null ? NaN : Number(v));
    const f = (v) => (v === "" || v === null ? NaN : parseFloat(v));
    return {
      ...formData,
      age_at_entry: n(formData.age_at_entry),
      gender: n(formData.gender),
      marital_status: n(formData.marital_status),
      is_national: n(formData.is_national),
      level: n(formData.level),
      uce_year_code: n(formData.uce_year_code),
      olevel_subjects: n(formData.olevel_subjects),
      uce_distinctions: n(formData.uce_distinctions),
      uce_credits: n(formData.uce_credits),
      average_olevel_grade: f(formData.average_olevel_grade),
      count_weak_grades_olevel: n(formData.count_weak_grades_olevel),
      std_dev_olevel_grade: f(formData.std_dev_olevel_grade),
      uace_year_code: n(formData.uace_year_code),
      general_paper: n(formData.general_paper),
      alevel_average_grade_weight: f(formData.alevel_average_grade_weight),
      alevel_std_dev_grade_weight: f(formData.alevel_std_dev_grade_weight),
      alevel_dominant_grade_weight: f(formData.alevel_dominant_grade_weight),
      alevel_count_weak_grades: n(formData.alevel_count_weak_grades),
      year_of_entry_code: n(formData.year_of_entry_code),
      campus_id_code: n(formData.campus_id_code),
      program_id_code: n(formData.program_id_code),
      high_school_performance_variance: f(
        formData.high_school_performance_variance
      ),
      high_school_performance_stability_index: f(
        formData.high_school_performance_stability_index
      ),
    };
  }, [formData]);

  const missingFields = useMemo(
    () =>
      Object.entries(castPayload)
        .filter(([_, val]) => val === "" || val === null || Number.isNaN(val))
        .map(([key]) => key),
    [castPayload]
  );

  const missingFieldLabels = useMemo(
    () => missingFields.map((key) => FIELD_LABELS[key] || key),
    [missingFields]
  );

  const selectedCampusName = useMemo(() => {
    const key = Number(formData.campus_id_code);
    return Number.isFinite(key) ? campusById[key] || null : null;
  }, [campusById, formData.campus_id_code]);

  const selectedProgramName = useMemo(() => {
    const key = Number(formData.program_id_code);
    return Number.isFinite(key) ? programById[key] || null : null;
  }, [programById, formData.program_id_code]);

  const validateStep = useCallback(
    (step) => {
      const requiredFields = STEP_REQUIRED_FIELDS[step] || [];
      const missingRequired = requiredFields.filter((field) => {
        const value = castPayload[field];
        return value === "" || value === null || Number.isNaN(value);
      });

      const touchFields = new Set(missingRequired);
      const issues = [];

      if (step === 1) {
        const subjectCount = Number(formData.olevel_subjects);
        const gradingMode = formData.olevel_mode || "numeric";
        const counts =
          gradingMode === "letters"
            ? formData.olevel_letterCounts
            : formData.olevel_numericCounts;
        const totalAllocated =
          counts && typeof counts === "object"
            ? Object.values(counts).reduce(
                (sum, value) => sum + (Number(value) || 0),
                0
              )
            : 0;

        if (
          Number.isFinite(subjectCount) &&
          subjectCount > 0 &&
          totalAllocated !== subjectCount
        ) {
          issues.push(
            `Complete O-Level grade allocation: ${totalAllocated}/${subjectCount} subjects allocated.`
          );
          touchFields.add("olevel_subjects");
        }
      }

      if (step === 2) {
        const principalCount = Number(formData._alevel_principalCount || 0);
        if (principalCount > 0) {
          const selectedSubjects = Array.isArray(formData._alevel_subjects)
            ? formData._alevel_subjects.slice(0, principalCount)
            : [];
          const filledSubjects = selectedSubjects.filter(Boolean).length;
          if (filledSubjects < principalCount) {
            issues.push(
              `Complete A-Level principal grades: ${filledSubjects}/${principalCount} selected.`
            );
            touchFields.add("uace_year_code");
          }
        }
      }

      return {
        isValid: missingRequired.length === 0 && issues.length === 0,
        missingRequired,
        issues,
        touchFields: Array.from(touchFields),
      };
    },
    [castPayload, formData]
  );

  const buildValidationMessage = useCallback((missingKeys, issues = []) => {
    const parts = [];
    if (missingKeys.length > 0) {
      const labels = missingKeys.map((key) => FIELD_LABELS[key] || key);
      parts.push(`Please complete: ${labels.join(", ")}.`);
    }
    if (issues.length > 0) {
      parts.push(...issues);
    }
    return parts.join(" ");
  }, []);

  const handleNext = () => {
    const validation = validateStep(activeStep);
    if (!validation.isValid) {
      if (validation.touchFields.length > 0) {
        setTouched((prev) => ({
          ...prev,
          ...Object.fromEntries(
            validation.touchFields.map((field) => [field, true])
          ),
        }));
      }
      setError(
        buildValidationMessage(validation.missingRequired, validation.issues)
      );
      return;
    }
    setError(null);
    setActiveStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const handleBack = () => setActiveStep((s) => Math.max(s - 1, 0));

  const handleReset = () => {
    setFormData(getInitialFormData());
    setTouched({});
    setResult(null);
    setError(null);
    setActiveStep(0);
  };

  const handleSubmit = async () => {
    const stepValidations = [0, 1, 2, 3].map((step) => ({
      step,
      ...validateStep(step),
    }));
    const invalidStep = stepValidations.find((entry) => !entry.isValid);

    if (missingFields.length > 0 || invalidStep) {
      const touchFromSteps = stepValidations.flatMap((entry) => entry.touchFields);
      const touchFields = Array.from(new Set([...missingFields, ...touchFromSteps]));
      if (touchFields.length > 0) {
        setTouched((prev) => ({
          ...prev,
          ...Object.fromEntries(touchFields.map((field) => [field, true])),
        }));
      }

      const allIssues = Array.from(
        new Set(stepValidations.flatMap((entry) => entry.issues))
      );
      const msg = buildValidationMessage(missingFields, allIssues);
      setError(msg || `Please complete all required fields: ${missingFieldLabels.join(", ")}`);

      if (invalidStep && typeof invalidStep.step === "number") {
        setActiveStep(invalidStep.step);
      }
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // const API = process.env.REACT_APP_API_BASE || "http://localhost:8000";
      const API = process.env.REACT_APP_API_BASE || "https://cgpa-prediction-dashboard.onrender.com";
      const response = await axios.post(`${API}/api/predict`, castPayload);
      setResult(response.data);
      setActiveStep(steps.length - 1);
    } catch (err) {
      setError(
        err?.response?.data?.detail || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg" sx={{ mt: 3, mb: 6 }}>
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={2}
          >
            <Box>
              <Typography variant="h4" sx={{ mb: 0.5 }}>
                CGPA Prediction Dashboard
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Admission-stage prediction and explanation for academic advising.
              </Typography>
            </Box>

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
            >
              <Button size="small" onClick={() => setResearchDialogOpen(true)}>
                Research Notes
              </Button>
              <Tooltip
                title={
                  themeMode === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }
              >
                <IconButton
                  aria-label="Toggle light and dark mode"
                  onClick={() =>
                    setThemeMode((prev) => (prev === "dark" ? "light" : "dark"))
                  }
                >
                  {themeMode === "dark" ? (
                    <LightModeOutlinedIcon />
                  ) : (
                    <DarkModeOutlinedIcon />
                  )}
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Paper>

        <Stepper
          activeStep={activeStep}
          alternativeLabel={!isPhone}
          orientation={isPhone ? "vertical" : "horizontal"}
          sx={{
            mb: 3,
            "& .MuiStepLabel-label": {
              fontSize: { xs: "0.82rem", sm: "0.95rem" },
            },
          }}
        >
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            {activeStep < 4 && error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {activeStep === 0 && (
              <SectionCard
                title="Demographic Details"
                subtitle="Basic student information"
              >
                <DemographicsForm
                  data={formData}
                  onChange={handleFormChange}
                  touched={touched}
                />
              </SectionCard>
            )}

            {activeStep === 1 && (
              <SectionCard
                title="O-Level Academic Details"
                subtitle="UCE performance summary"
              >
                <OLevelForm
                  data={formData}
                  onChange={handleFormChange}
                  touched={touched}
                />
              </SectionCard>
            )}

            {activeStep === 2 && (
              <SectionCard
                title="A-Level (UACE) Information"
                subtitle="UACE performance summary"
              >
                <ALevelForm
                  data={formData}
                  onChange={handleFormChange}
                  touched={touched}
                />
              </SectionCard>
            )}

            {activeStep === 3 && (
              <SectionCard
                title="Institutional Placement"
                subtitle="Details about your campus and program"
              >
                <InstitutionalForm
                  data={formData}
                  onChange={handleFormChange}
                  touched={touched}
                />
              </SectionCard>
            )}

            {activeStep === 4 && (
              <SectionCard
                title="Review & Submit"
                subtitle="Confirm all details are correct"
                actions={
                  result ? (
                    <>
                      <Button
                        variant="outlined"
                        onClick={handleBack}
                        sx={{ mr: 1 }}
                      >
                        Back
                      </Button>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleReset}
                      >
                        Start New Prediction
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outlined"
                        onClick={handleBack}
                        sx={{ mr: 1 }}
                      >
                        Back
                      </Button>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSubmit}
                        disabled={loading}
                      >
                        {loading ? (
                          <CircularProgress size={20} />
                        ) : (
                          "Predict CGPA"
                        )}
                      </Button>
                    </>
                  )
                }
              >
                {result && (
                  <Alert
                    severity="success"
                    sx={{
                      mt: 2,
                      "& .MuiAlert-message": { width: "100%" },
                    }}
                  >
                    <strong>Predicted CGPA:</strong>{" "}
                    {Number(result.predicted_cgpa).toFixed(2)}
                    <br />
                    <strong>Performance Band:</strong>{" "}
                    {result.performance_band}
                  </Alert>
                )}

                {result && (
                  <Box sx={{ mt: 2 }}>
                    <ResultPanel
                      result={result}
                      payload={castPayload}
                      lookupLabels={{
                        campusName: selectedCampusName,
                        programName: selectedProgramName,
                      }}
                      onOpenResearchReference={() => setResearchDialogOpen(true)}
                    />
                  </Box>
                )}

                {error && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                  </Alert>
                )}
                {!result && !error && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Click <strong>Predict CGPA</strong> to run the model.
                  </Alert>
                )}
              </SectionCard>
            )}

            {/* Navigation actions below the form for steps 0–3 */}
            {activeStep < 4 && (
              <Box sx={{ mt: 2 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack
                    direction={{ xs: "column-reverse", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "stretch", sm: "center" }}
                    spacing={1}
                  >
                    <Button
                      disabled={activeStep === 0}
                      onClick={handleBack}
                      sx={{ width: { xs: "100%", sm: "auto" } }}
                    >
                      Back
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      sx={{ width: { xs: "100%", sm: "auto" } }}
                    >
                      Next
                    </Button>
                  </Stack>
                </Paper>
              </Box>
            )}
          </Grid>

          {/* Right sidebar (now synced with the current step) */}
          <Grid item xs={12} md={4}>
            <SummarySidebar
              data={formData}
              selectedSection={stepToSection[activeStep] || null}
              onSectionChange={(sectionKey) => {
                const idx = sectionToStep[sectionKey];
                if (typeof idx === "number") {
                  setActiveStep(idx);
                }
              }}
            />
          </Grid>
        </Grid>
      </Container>
      <ResearchReferenceDialog
        open={researchDialogOpen}
        onClose={() => setResearchDialogOpen(false)}
        researchContext={result?.research_context}
        globalImportance={
          Array.isArray(result?.global_importance) ? result.global_importance : []
        }
      />
    </ThemeProvider>
  );
}

export default App;
