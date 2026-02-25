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
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";

const DEMOG_RAW_FIELDS = [
  "marital_status",
  "gender",
  "age_at_entry",
  "year_of_entry_code",
];
const OLEVEL_RAW_FIELDS = [
  "uce_year_code",
  "olevel_subjects",
  "uce_distinctions",
  "uce_credits",
];
const OLEVEL_DERIVED_FIELDS = [
  "average_olevel_grade",
  "count_weak_grades_olevel",
  "std_dev_olevel_grade",
];
const ALEVEL_RAW_FIELDS = ["uace_year_code", "general_paper"];
const ALEVEL_DERIVED_FIELDS = [
  "alevel_average_grade_weight",
  "alevel_std_dev_grade_weight",
  "alevel_dominant_grade_weight",
  "alevel_count_weak_grades",
  "high_school_performance_variance",
  "high_school_performance_stability_index",
];
const INSTITUTIONAL_RAW_FIELDS = [
  "level",
  "campus_id_code",
  "program_id_code",
  "is_national",
];
const IMPORTANT_FIELDS = [
  ...DEMOG_RAW_FIELDS,
  ...OLEVEL_RAW_FIELDS,
  ...ALEVEL_RAW_FIELDS,
  ...INSTITUTIONAL_RAW_FIELDS,
];

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
const Section = ({ title, expanded, onToggle, children, subtitle, icon }) => (
  <Accordion
    expanded={expanded}
    onChange={onToggle}
    disableGutters
    sx={{
      boxShadow: "none",
      "&::before": { display: "none" },
      bgcolor: expanded ? "action.hover" : "transparent",
      borderRadius: "8px !important",
      transition: "background-color 0.2s ease",
      mb: 0.5,
    }}
  >
    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
      <Stack direction="row" spacing={1} alignItems="center">
        {icon}
        <Typography variant="overline" sx={{ letterSpacing: 0.6, fontWeight: expanded ? 700 : 500 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Chip size="small" label={subtitle} variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />
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
  const { filledCount, totalCount } = useMemo(() => {
    let filled = 0;
    for (const k of IMPORTANT_FIELDS) {
      const v = data?.[k];
      if (!(v === "" || v === null || typeof v === "undefined")) filled += 1;
    }
    return { filledCount: filled, totalCount: IMPORTANT_FIELDS.length };
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
        background: (t) =>
          t.palette.mode === "dark"
            ? "linear-gradient(180deg, rgba(30,42,58,0.4) 0%, rgba(26,29,36,0.6) 100%)"
            : "linear-gradient(180deg, rgba(145,158,171,0.10) 0%, rgba(145,158,171,0.05) 100%)",
      }}
    >
      {/* Header + Progress */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 0.5, fontWeight: 650 }}>
          Quick Review
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
          <Typography variant="caption" color="text.secondary">
            Profile completeness
          </Typography>
          <Chip
            size="small"
            label={`${filledCount}/${totalCount}`}
            variant="outlined"
            color={percent === 100 ? "success" : percent > 50 ? "primary" : "default"}
            sx={{ height: 20, fontSize: "0.7rem" }}
          />
        </Stack>
        <LinearProgress
          variant="determinate"
          value={percent}
          color={percent === 100 ? "success" : "primary"}
          sx={{
            height: 6,
            borderRadius: 999,
            bgcolor: "action.hover",
            "& .MuiLinearProgress-bar": { borderRadius: 999 },
          }}
        />
        {percent === 100 && (
          <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: "block" }}>
            All fields complete — ready to submit!
          </Typography>
        )}
      </Box>

      <Divider sx={{ my: 1 }} />

      {/* Demographics */}
      <Section
        title="Demographics"
        icon={<PersonOutlineIcon sx={{ fontSize: 18 }} color="primary" />}
        expanded={EXPANDED.demographics}
        onToggle={handleToggle("demographics")}
      >
        <List dense disablePadding>
          {DEMOG_RAW_FIELDS.map((k) => (
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
        icon={<MenuBookOutlinedIcon sx={{ fontSize: 18 }} color="primary" />}
        expanded={EXPANDED.olevel}
        onToggle={handleToggle("olevel")}
      >
        <List dense disablePadding>
          {OLEVEL_RAW_FIELDS.map((k) => (
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
          {OLEVEL_DERIVED_FIELDS.map((k) => (
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
        icon={<SchoolOutlinedIcon sx={{ fontSize: 18 }} color="primary" />}
        expanded={EXPANDED.alevel}
        onToggle={handleToggle("alevel")}
      >
        <List dense disablePadding>
          {ALEVEL_RAW_FIELDS.map((k) => (
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
          {ALEVEL_DERIVED_FIELDS.map((k) => (
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
        icon={<AccountBalanceOutlinedIcon sx={{ fontSize: 18 }} color="primary" />}
        expanded={EXPANDED.institutional}
        onToggle={handleToggle("institutional")}
      >
        <List dense disablePadding>
          {INSTITUTIONAL_RAW_FIELDS.map((k) => (
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
