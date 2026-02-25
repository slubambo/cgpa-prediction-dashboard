import { createTheme } from "@mui/material/styles";

export const createAppTheme = ({ mode = "light" } = {}) => {
  const isDark = mode === "dark";
  const fontScale = 1.08;
  const cardBorder = isDark ? "#2a2f3a" : "#d9dee8";

  return createTheme({
    palette: {
      mode,
      background: isDark
        ? { default: "#0f1115", paper: "#1a1d24" }
        : { default: "#f6f8fc", paper: "#ffffff" },
      primary: { main: "#1b6ca8" },
      secondary: { main: "#2f855a" },
      text: isDark
        ? { primary: "#e6e6e6", secondary: "#a8b0bf" }
        : { primary: "#172235", secondary: "#4f5d75" },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial`,
      h4: { fontWeight: 750, fontSize: `${2.0 * fontScale}rem` },
      h6: { fontWeight: 650, letterSpacing: 0.2, fontSize: `${1.2 * fontScale}rem` },
      body1: { fontSize: `${1.0 * fontScale}rem` },
      body2: { fontSize: `${0.9 * fontScale}rem` },
      caption: { fontSize: `${0.8 * fontScale}rem` },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            border: `1px solid ${cardBorder}`,
          },
        },
      },
      MuiTextField: {
        defaultProps: { size: "small", variant: "outlined" },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: { fontSize: `${0.9 * fontScale}rem` },
        },
      },
      MuiSelect: {
        styleOverrides: {
          select: {
            paddingRight: 48,
          },
          icon: {
            right: 40,
            pointerEvents: "auto",
          },
        },
      },
      MuiInputAdornment: {
        styleOverrides: {
          root: {
            "&.MuiInputAdornment-positionEnd": {
              marginLeft: 4,
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            "&.MuiInputBase-adornedEnd .MuiSelect-select": {
              paddingRight: 88,
            },
            "&.MuiInputBase-adornedEnd .MuiSelect-icon": {
              right: 64,
            },
          },
          input: {
            paddingRight: 8,
          },
        },
      },
    },
  });
};

const theme = createAppTheme({ mode: "light" });
export default theme;
