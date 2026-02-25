// src/components/SectionCard.jsx
import React from "react";
import { Paper, Typography, Box, Divider } from "@mui/material";

const SectionCard = ({ title, subtitle, children, actions }) => (
  <Paper
    sx={{
      p: { xs: 2, sm: 3 },
      mb: 3,
      borderLeft: (t) => `4px solid ${t.palette.primary.main}`,
      transition: "box-shadow 0.2s ease",
      "&:hover": {
        boxShadow: (t) =>
          t.palette.mode === "dark"
            ? "0 4px 20px rgba(0,0,0,0.3)"
            : "0 4px 20px rgba(0,0,0,0.06)",
      },
    }}
  >
    <Box sx={{ mb: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 650 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
    <Divider sx={{ mb: 2, opacity: 0.5 }} />
    <Box>{children}</Box>
    {actions && (
      <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
        {actions}
      </Box>
    )}
  </Paper>
);

export default SectionCard;
