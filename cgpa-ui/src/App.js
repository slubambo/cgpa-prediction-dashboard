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
  Chip,
  useMediaQuery,
  Collapse,
  Fade,
} from "@mui/material";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import SendIcon from "@mui/icons-material/Send";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { createAppTheme } from "./styles/theme";

import SectionCard from "./components/SectionCard";
import DemographicsForm from "./components/DemographicsForm";
import OLevelForm from "./components/OLevelForm";
import ALevelForm from "./components/ALevelForm";
import InstitutionalForm from "./components/InstitutionalForm";
import SummarySidebar from "./components/SummarySidebar";
import ResultPanel from "./components/ResultPanel";
import ResearchReferenceDialog from "./components/ResearchReferenceDialog";
import { DEMO_STUDENT_PROFILES } from "./constants/demoProfiles";

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

const FRIENDLY_VALUES = {
  gender: (v) => (v === 1 ? "Male" : v === 0 ? "Female" : "—"),
  marital_status: (v) => (v === 0 ? "Single" : v === 1 ? "Married" : v === 2 ? "Other" : "—"),
  general_paper: (v) => (Number(v) === 1 ? "Passed" : "Not passed"),
  is_national: (v) => (Number(v) === 1 ? "National" : "International"),
  level: (v) => {
    const labels = { 1: "Certificate/Diploma", 2: "Bachelor's", 3: "Master's", 4: "PhD", 5: "Short Courses", 6: "PG Diploma", 7: "Bridging Year", 8: "Unknown" };
    return labels[Number(v) + 1] || `Level ${Number(v) + 1}`;
  },
};

const formatFieldValue = (key, val) => {
  if (val === "" || val === null || typeof val === "undefined") return "—";
  if (FRIENDLY_VALUES[key]) return FRIENDLY_VALUES[key](val);
  return String(val);
};

const REVIEW_SECTIONS = [
  { title: "Demographics", fields: ["marital_status", "gender", "age_at_entry", "year_of_entry_code"] },
  { title: "O-Level", fields: ["uce_year_code", "olevel_subjects", "uce_distinctions", "uce_credits", "average_olevel_grade", "count_weak_grades_olevel"] },
  { title: "A-Level", fields: ["uace_year_code", "general_paper", "alevel_average_grade_weight", "alevel_count_weak_grades"] },
  { title: "Institutional", fields: ["campus_id_code", "level", "program_id_code", "is_national"] },
];

const castFormData = (source) => {
  const n = (v) => (v === "" || v === null ? NaN : Number(v));
  const f = (v) => (v === "" || v === null ? NaN : parseFloat(v));
  return {
    ...source,
    age_at_entry: n(source.age_at_entry),
    gender: n(source.gender),
    marital_status: n(source.marital_status),
    is_national: n(source.is_national),
    level: n(source.level),
    uce_year_code: n(source.uce_year_code),
    olevel_subjects: n(source.olevel_subjects),
    uce_distinctions: n(source.uce_distinctions),
    uce_credits: n(source.uce_credits),
    average_olevel_grade: f(source.average_olevel_grade),
    count_weak_grades_olevel: n(source.count_weak_grades_olevel),
    std_dev_olevel_grade: f(source.std_dev_olevel_grade),
    uace_year_code: n(source.uace_year_code),
    general_paper: n(source.general_paper),
    alevel_average_grade_weight: f(source.alevel_average_grade_weight),
    alevel_std_dev_grade_weight: f(source.alevel_std_dev_grade_weight),
    alevel_dominant_grade_weight: f(source.alevel_dominant_grade_weight),
    alevel_count_weak_grades: n(source.alevel_count_weak_grades),
    year_of_entry_code: n(source.year_of_entry_code),
    campus_id_code: n(source.campus_id_code),
    program_id_code: n(source.program_id_code),
    high_school_performance_variance: f(source.high_school_performance_variance),
    high_school_performance_stability_index: f(
      source.high_school_performance_stability_index
    ),
  };
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
  const [activeDemoProfileId, setActiveDemoProfileId] = useState(null);
  const [researchDialogOpen, setResearchDialogOpen] = useState(false);
  const [demoExpanded, setDemoExpanded] = useState(false);
  const [themeMode, setThemeMode] = useState(() => {
    try {
      return localStorage.getItem("cgpa-dashboard-theme-mode") === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });
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

  const handleFormChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTouched((t) => ({ ...t, [field]: true }));
    setError(null);
  }, []);

  const castPayload = useMemo(() => castFormData(formData), [formData]);

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
    setActiveDemoProfileId(null);
    setActiveStep(0);
  };

  const runPrediction = useCallback(async (payload) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const API =
        process.env.REACT_APP_API_BASE ||
        "https://cgpa-prediction-dashboard.onrender.com";
      const response = await axios.post(`${API}/api/predict`, payload);
      setResult(response.data);
      setActiveStep(steps.length - 1);
    } catch (err) {
      setError(
        err?.response?.data?.detail || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
      setActiveDemoProfileId(null);
    }
  }, []);

  const handleRunDemoProfile = useCallback(
    async (profile) => {
      if (!profile?.data) return;
      const nextData = { ...getInitialFormData(), ...profile.data };
      setActiveDemoProfileId(profile.id || null);
      setFormData(nextData);
      setTouched({});
      await runPrediction(castFormData(nextData));
    },
    [runPrediction]
  );

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
    await runPrediction(castPayload);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg" sx={{ mt: 3, mb: 6 }}>
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2, sm: 3 },
            mb: 2,
            background: (t) =>
              t.palette.mode === "dark"
                ? "linear-gradient(135deg, #1a1d24 0%, #1e2a3a 100%)"
                : "linear-gradient(135deg, #ffffff 0%, #e8f0fe 100%)",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={2}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <SchoolOutlinedIcon
                color="primary"
                sx={{ fontSize: { xs: 32, sm: 40 } }}
              />
              <Box>
                <Typography variant="h4" sx={{ mb: 0.25 }}>
                  CGPA Prediction Dashboard
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Admission-stage prediction &amp; explanation for academic advising
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                size="small"
                variant="text"
                onClick={() => setResearchDialogOpen(true)}
              >
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
                  size="small"
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

        {activeStep === 0 && (
          <Fade in timeout={400}>
            <Paper
              variant="outlined"
              sx={{
                mb: 2,
                overflow: "hidden",
                borderColor: demoExpanded ? "primary.main" : "divider",
                transition: "border-color 0.3s ease",
              }}
            >
              <Box
                onClick={() => setDemoExpanded((prev) => !prev)}
                sx={{
                  p: 2,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  "&:hover": { bgcolor: "action.hover" },
                  transition: "background-color 0.2s ease",
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <PlayCircleOutlineIcon color="primary" />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Quick Demo Profiles
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Try a sample profile to see the dashboard in action
                    </Typography>
                  </Box>
                </Stack>
                <IconButton
                  size="small"
                  aria-label={demoExpanded ? "Collapse demo profiles" : "Expand demo profiles"}
                  sx={{
                    transform: demoExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.3s ease",
                  }}
                >
                  <ExpandMoreIcon />
                </IconButton>
              </Box>
              <Collapse in={demoExpanded} timeout={350}>
                <Box sx={{ px: 2, pb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Strategic sample profiles for demonstration.
                    Selecting one runs prediction immediately and opens the Review step.
                  </Typography>
                  <Grid container spacing={1.5}>
                    {DEMO_STUDENT_PROFILES.map((profile) => (
                      <Grid item xs={12} sm={6} key={profile.id}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            borderRadius: 1.5,
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            gap: 1,
                            transition: "box-shadow 0.2s ease, border-color 0.2s ease",
                            "&:hover": {
                              borderColor: "primary.light",
                              boxShadow: (t) =>
                                t.palette.mode === "dark"
                                  ? "0 2px 12px rgba(27, 108, 168, 0.15)"
                                  : "0 2px 12px rgba(27, 108, 168, 0.10)",
                            },
                          }}
                        >
                          <Typography variant="subtitle2">{profile.title}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {profile.description}
                          </Typography>
                          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`Program: ${profile.data.program_id_code}`}
                              sx={{ fontSize: "0.7rem" }}
                            />
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`Level: ${profile.data.level}`}
                              sx={{ fontSize: "0.7rem" }}
                            />
                          </Stack>
                          <Box sx={{ mt: "auto" }}>
                            <Button
                              variant="outlined"
                              size="small"
                              fullWidth
                              disabled={loading}
                              startIcon={
                                loading && activeDemoProfileId === profile.id ? (
                                  <CircularProgress size={14} />
                                ) : (
                                  <PlayCircleOutlineIcon sx={{ fontSize: 16 }} />
                                )
                              }
                              onClick={() => handleRunDemoProfile(profile)}
                            >
                              {loading && activeDemoProfileId === profile.id
                                ? "Running..."
                                : "Run Profile"}
                            </Button>
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              </Collapse>
            </Paper>
          </Fade>
        )}

        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              Step {activeStep + 1} of {steps.length} — {steps[activeStep]}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              color={activeStep === 4 ? "success" : "primary"}
              label={activeStep === 4 ? "Review" : `${Math.round((activeStep / (steps.length - 1)) * 100)}%`}
            />
          </Stack>
          <Stepper
            activeStep={activeStep}
            alternativeLabel={!isPhone}
            orientation={isPhone ? "vertical" : "horizontal"}
            sx={{
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
        </Paper>

        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            {activeStep < 4 && error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {activeStep === 0 && (
              <Fade in timeout={300} key="step-0">
                <div>
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
                </div>
              </Fade>
            )}

            {activeStep === 1 && (
              <Fade in timeout={300} key="step-1">
                <div>
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
                </div>
              </Fade>
            )}

            {activeStep === 2 && (
              <Fade in timeout={300} key="step-2">
                <div>
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
                </div>
              </Fade>
            )}

            {activeStep === 3 && (
              <Fade in timeout={300} key="step-3">
                <div>
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
                </div>
              </Fade>
            )}

            {activeStep === 4 && (
              <Fade in timeout={300} key="step-4">
                <div>
                  <SectionCard
                    title="Review & Submit"
                    subtitle="Confirm all details are correct"
                    actions={
                      result ? (
                        <>
                          <Button
                            variant="outlined"
                            onClick={handleBack}
                            startIcon={<NavigateBeforeIcon />}
                            sx={{ mr: 1 }}
                          >
                            Institutional
                          </Button>
                          <Button
                            variant="contained"
                            color="primary"
                            onClick={handleReset}
                            startIcon={<RestartAltIcon />}
                          >
                            Start New Prediction
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outlined"
                            onClick={handleBack}
                            startIcon={<NavigateBeforeIcon />}
                            sx={{ mr: 1 }}
                          >
                            Institutional
                          </Button>
                          <Button
                            variant="contained"
                            color="primary"
                            onClick={handleSubmit}
                            disabled={loading}
                            startIcon={
                              loading ? (
                                <CircularProgress size={18} color="inherit" />
                              ) : (
                                <SendIcon />
                              )
                            }
                          >
                            {loading ? "Predicting..." : "Predict CGPA"}
                          </Button>
                        </>
                      )
                    }
                  >
                    {/* Pre-submission summary */}
                    {!result && (
                      <Box sx={{ mb: 2 }}>
                        {missingFields.length === 0 ? (
                          <Alert
                            severity="success"
                            icon={<CheckCircleOutlineIcon />}
                            sx={{ mb: 2 }}
                          >
                            All fields are complete. Review your details below and click{" "}
                            <strong>Predict CGPA</strong> when ready.
                          </Alert>
                        ) : (
                          <Alert
                            severity="warning"
                            icon={<WarningAmberIcon />}
                            sx={{ mb: 2 }}
                          >
                            {missingFields.length} field{missingFields.length > 1 ? "s" : ""} still
                            missing: {missingFieldLabels.slice(0, 5).join(", ")}
                            {missingFields.length > 5 ? " and more..." : "."}
                          </Alert>
                        )}

                        <Grid container spacing={2}>
                          {REVIEW_SECTIONS.map((section) => (
                            <Grid item xs={12} sm={6} key={section.title}>
                              <Paper
                                variant="outlined"
                                sx={{
                                  p: 2,
                                  borderRadius: 1.5,
                                  height: "100%",
                                  bgcolor: "action.hover",
                                }}
                              >
                                <Typography
                                  variant="overline"
                                  color="primary"
                                  sx={{ fontWeight: 700, letterSpacing: 0.8 }}
                                >
                                  {section.title}
                                </Typography>
                                {section.fields.map((field) => {
                                  const val = formData[field];
                                  const isEmpty = val === "" || val === null || typeof val === "undefined";
                                  return (
                                    <Box
                                      key={field}
                                      sx={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "baseline",
                                        py: 0.5,
                                        borderBottom: "1px solid",
                                        borderColor: "divider",
                                        "&:last-child": { borderBottom: "none" },
                                      }}
                                    >
                                      <Typography variant="caption" color="text.secondary">
                                        {FIELD_LABELS[field] || field}
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          fontWeight: 500,
                                          color: isEmpty ? "warning.main" : "text.primary",
                                        }}
                                      >
                                        {formatFieldValue(field, val)}
                                      </Typography>
                                    </Box>
                                  );
                                })}
                              </Paper>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    )}

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
                          onOpenResearchReference={() => setResearchDialogOpen(true)}
                        />
                      </Box>
                    )}

                    {error && (
                      <Alert severity="error" sx={{ mt: 2 }}>
                        {error}
                      </Alert>
                    )}
                  </SectionCard>
                </div>
              </Fade>
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
                      startIcon={<NavigateBeforeIcon />}
                      sx={{ width: { xs: "100%", sm: "auto" } }}
                    >
                      {activeStep > 0 ? steps[activeStep - 1] : "Back"}
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      endIcon={activeStep === 3 ? <SendIcon /> : <NavigateNextIcon />}
                      sx={{ width: { xs: "100%", sm: "auto" } }}
                    >
                      {activeStep === 3 ? "Review & Submit" : `Next: ${steps[activeStep + 1]}`}
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

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 3,
          px: 2,
          mt: "auto",
          textAlign: "center",
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          CGPA Prediction Dashboard — Masters Research Project
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
          Predictions are advisory and do not substitute formal academic assessment.
        </Typography>
      </Box>

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
