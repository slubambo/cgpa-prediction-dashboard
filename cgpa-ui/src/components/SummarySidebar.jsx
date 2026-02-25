// src/components/SummarySidebar.jsx
import React, { useMemo } from "react";
import {
  Paper,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Chip,
  Stack,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

/** Friendly value formatting for common coded fields */
const formatValue = (key, value) => {
  if (value === null || typeof value === "undefined" || value === "")
    return "—";

  switch (key) {
    case "gender":
      return value === 1 ? "Male" : value === 0 ? "Female" : value;
    case "marital_status":
      return value === 0
        ? "Single"
        : value === 1
        ? "Married"
        : value === 2
        ? "Other"
        : value;
    case "general_paper":
      return Number(value) === 1 ? "Passed" : "Not passed";
    case "is_national":
      return Number(value) === 1 ? "National" : "International";
    case "level": {
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
      const uiVal = Number(value) + 1;
      return UI_LEVEL_LABELS[uiVal] || `Level ${uiVal}`;
    }
    default:
      return value;
  }
};

/** Small row with tighter spacing and soft alternating background */
const Row = ({ label, value, muted = false }) => (
  <ListItem
    dense
    sx={{
      py: 0.5,
      px: 1,
      borderRadius: 1,
      "&:nth-of-type(odd)": { backgroundColor: "action.hover" },
    }}
  >
    <ListItemText
      primary={
        <Typography
          variant="caption"
          color={muted ? "text.disabled" : "text.secondary"}
          sx={{ textTransform: "none" }}
        >
          {label}
        </Typography>
      }
      secondary={
        <Typography variant="body2" sx={{ mt: 0.25 }}>
          {value}
        </Typography>
      }
    />
  </ListItem>
);

/** Controlled section (expanded decided by parent) */
const Section = ({ title, expanded, onToggle, children, subtitle }) => (
  <Accordion
    expanded={expanded}
    onChange={onToggle}
    disableGutters
    sx={{ boxShadow: "none" }}
  >
    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="overline" sx={{ letterSpacing: 0.6 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Chip size="small" label={subtitle} variant="outlined" />
        ) : null}
      </Stack>
    </AccordionSummary>
    <AccordionDetails sx={{ pt: 0 }}>{children}</AccordionDetails>
  </Accordion>
);

const SummarySidebar = ({
  data,
  /** which section should be open: 'demographics' | 'olevel' | 'alevel' | 'institutional' */
  selectedSection = "demographics",
  /** notify parent when user manually opens a different section */
  onSectionChange,
}) => {
  // --- Field groups (split raw vs derived for clarity) ---
  const demogRaw = [
    "marital_status",
    "gender",
    "age_at_entry",
    "year_of_entry_code",
  ];

  const olevelRaw = [
    "uce_year_code",
    "olevel_subjects",
    "uce_distinctions",
    "uce_credits",
  ];
  const olevelFeat = [
    "average_olevel_grade",
    "count_weak_grades_olevel",
    "std_dev_olevel_grade",
  ];

  const alevelRaw = ["uace_year_code", "general_paper"];
  const alevelFeat = [
    "alevel_average_grade_weight",
    "alevel_std_dev_grade_weight",
    "alevel_dominant_grade_weight",
    "alevel_count_weak_grades",
    "high_school_performance_variance",
    "high_school_performance_stability_index",
  ];

  const instRaw = ["level", "campus_id_code", "program_id_code", "is_national"];

  // --- Friendly field labels ---
  const LABEL = {
    // Demographics
    marital_status: "Marital status",
    gender: "Gender",
    age_at_entry: "Age at entry",
    year_of_entry_code: "Year of entry",
    // O‑Level raw
    uce_year_code: "UCE year",
    olevel_subjects: "O‑Level subjects (count)",
    uce_distinctions: "Distinctions (D1–D2 / A)",
    uce_credits: "Credits (C3–C6 / B/C)",
    // O‑Level features
    average_olevel_grade: "Avg O‑Level grade",
    count_weak_grades_olevel: "Weak grades (≥7)",
    std_dev_olevel_grade: "Std dev (O‑Level)",
    // A‑Level raw
    uace_year_code: "UACE year",
    general_paper: "General Paper",
    // A‑Level features
    alevel_average_grade_weight: "Avg grade weight",
    alevel_std_dev_grade_weight: "Std dev (A‑Level)",
    alevel_dominant_grade_weight: "Dominant grade weight",
    alevel_count_weak_grades: "Weak grades (D/E/F)",
    high_school_performance_variance: "HS performance variance",
    high_school_performance_stability_index: "HS stability index",
    // Institutional
    level: "Academic level",
    campus_id_code: "Campus (code)",
    program_id_code: "Program (code)",
    is_national: "Nationality",
  };

  // --- Profile completeness ---
  const importantFields = [...demogRaw, ...olevelRaw, ...alevelRaw, ...instRaw];
  const { filledCount, totalCount } = useMemo(() => {
    let filled = 0;
    for (const k of importantFields) {
      const v = data?.[k];
      if (!(v === "" || v === null || typeof v === "undefined")) filled += 1;
    }
    return { filledCount: filled, totalCount: importantFields.length };
  }, [data]);
  const percent = Math.round((filledCount / totalCount) * 100);

  // --- Controlled expansion flags
  const EXPANDED = {
    demographics: selectedSection === "demographics",
    olevel: selectedSection === "olevel",
    alevel: selectedSection === "alevel",
    institutional: selectedSection === "institutional",
  };

  // helper to swap open section
  const handleToggle = (sectionKey) => (_, isExpanded) => {
    if (!onSectionChange) return;
    // only allow one open at a time – if user clicks the already-open one, keep it open
    onSectionChange(isExpanded ? sectionKey : sectionKey);
  };

  return (
    <Paper
      sx={{
        p: 2,
        position: { xs: "static", md: "sticky" },
        top: { md: 16 },
        maxHeight: { md: "calc(100vh - 32px)" },
        overflow: { md: "auto" },
        borderRadius: 2,
        background:
          "linear-gradient(180deg, rgba(145,158,171,0.10) 0%, rgba(145,158,171,0.05) 100%)",
      }}
    >
      {/* Header + Progress */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 0.5, fontWeight: 600 }}>
          Quick Review
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Profile completeness
          </Typography>
          <Chip
            size="small"
            label={`${filledCount}/${totalCount}`}
            variant="outlined"
          />
        </Stack>
        <LinearProgress
          variant="determinate"
          value={percent}
          sx={{
            height: 8,
            borderRadius: 999,
            "& .MuiLinearProgress-bar": { borderRadius: 999 },
          }}
        />
      </Box>

      <Divider sx={{ my: 1.5 }} />

      {/* Demographics */}
      <Section
        title="Demographics"
        expanded={EXPANDED.demographics}
        onToggle={handleToggle("demographics")}
      >
        <List dense disablePadding>
          {demogRaw.map((k) => (
            <Row
              key={k}
              label={LABEL[k] || k}
              value={formatValue(k, data?.[k])}
            />
          ))}
        </List>
      </Section>

      <Divider sx={{ my: 1 }} />

      {/* O‑Level */}
      <Section
        title="O‑Level"
        subtitle="Raw inputs"
        expanded={EXPANDED.olevel}
        onToggle={handleToggle("olevel")}
      >
        <List dense disablePadding>
          {olevelRaw.map((k) => (
            <Row
              key={k}
              label={LABEL[k] || k}
              value={formatValue(k, data?.[k])}
            />
          ))}
        </List>
        <Divider sx={{ my: 1 }} />
        <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
          Derived features
        </Typography>
        <List dense disablePadding>
          {olevelFeat.map((k) => (
            <Row
              key={k}
              label={LABEL[k] || k}
              value={formatValue(k, data?.[k])}
              muted
            />
          ))}
        </List>
      </Section>

      <Divider sx={{ my: 1 }} />

      {/* A‑Level */}
      <Section
        title="A‑Level"
        subtitle="Raw inputs"
        expanded={EXPANDED.alevel}
        onToggle={handleToggle("alevel")}
      >
        <List dense disablePadding>
          {alevelRaw.map((k) => (
            <Row
              key={k}
              label={LABEL[k] || k}
              value={formatValue(k, data?.[k])}
            />
          ))}
        </List>
        <Divider sx={{ my: 1 }} />
        <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
          Derived features
        </Typography>
        <List dense disablePadding>
          {alevelFeat.map((k) => (
            <Row
              key={k}
              label={LABEL[k] || k}
              value={formatValue(k, data?.[k])}
              muted
            />
          ))}
        </List>
      </Section>

      <Divider sx={{ my: 1 }} />

      {/* Institutional */}
      <Section
        title="Institutional"
        expanded={EXPANDED.institutional}
        onToggle={handleToggle("institutional")}
      >
        <List dense disablePadding>
          {instRaw.map((k) => (
            <Row
              key={k}
              label={LABEL[k] || k}
              value={formatValue(k, data?.[k])}
            />
          ))}
        </List>
      </Section>
    </Paper>
  );
};

export default SummarySidebar;
