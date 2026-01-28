import { Platform } from "react-native";

export const Colors = {
  accent: "#38AE5F",
  accentLight: "rgba(56, 174, 95, 0.12)",
  accentPressed: "#2D9A4F",
  
  success: "#38AE5F",
  successLight: "rgba(56, 174, 95, 0.12)",
  error: "#EF4444",
  errorLight: "rgba(239, 68, 68, 0.12)",
  warning: "#F59E0B",
  warningLight: "rgba(245, 158, 11, 0.12)",
  
  light: {
    text: "#1A1A1A",
    textSecondary: "#666666",
    textTertiary: "#999999",
    buttonText: "#FFFFFF",
    tabIconDefault: "#999999",
    tabIconSelected: "#38AE5F",
    link: "#38AE5F",
    backgroundRoot: "#FFFFFF",
    backgroundDefault: "#F5F5F5",
    backgroundSecondary: "#EEEEEE",
    backgroundTertiary: "#E5E5E5",
    backgroundElevated: "#FFFFFF",
    border: "#E0E0E0",
    borderLight: "rgba(0, 0, 0, 0.06)",
    separator: "rgba(0, 0, 0, 0.08)",
    glassBackground: "rgba(255, 255, 255, 0.72)",
    glassBorder: "rgba(255, 255, 255, 0.5)",
    glassOverlay: "rgba(245, 245, 245, 0.85)",
    overlay: "rgba(0, 0, 0, 0.4)",
    cardBackground: "#FFFFFF",
  },
  dark: {
    text: "#FFFFFF",
    textSecondary: "#A0A0A0",
    textTertiary: "#666666",
    buttonText: "#FFFFFF",
    tabIconDefault: "#666666",
    tabIconSelected: "#38AE5F",
    link: "#38AE5F",
    backgroundRoot: "#000000",
    backgroundDefault: "#1C1C1E",
    backgroundSecondary: "#2C2C2E",
    backgroundTertiary: "#3A3A3C",
    backgroundElevated: "#1C1C1E",
    border: "#3A3A3C",
    borderLight: "rgba(255, 255, 255, 0.06)",
    separator: "rgba(255, 255, 255, 0.1)",
    glassBackground: "rgba(28, 28, 30, 0.72)",
    glassBorder: "rgba(255, 255, 255, 0.1)",
    glassOverlay: "rgba(28, 28, 30, 0.9)",
    overlay: "rgba(0, 0, 0, 0.6)",
    cardBackground: "#1C1C1E",
  },
};

export const Spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  "4xl": 48,
  "5xl": 56,
  "6xl": 64,
  
  screenPadding: 16,
  cardPadding: 16,
  sectionGap: 24,
  itemGap: 12,
  
  inputHeight: 48,
  buttonHeight: 50,
  buttonHeightSmall: 36,
  listRowHeight: 56,
  iconSize: 24,
  iconSizeSmall: 20,
  iconSizeLarge: 28,
  avatarSmall: 40,
  avatarMedium: 56,
  avatarLarge: 80,
  
  tabBarHeight: 49,
  headerHeight: 44,
  largeTitleHeight: 52,
};

export const BorderRadius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  full: 9999,
  
  card: 16,
  button: 12,
  buttonPill: 25,
  input: 12,
  iconContainer: 10,
  avatar: 9999,
  modal: 20,
};

export const Typography = {
  largeTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "700" as const,
    letterSpacing: 0.37,
  },
  title1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700" as const,
    letterSpacing: 0.36,
  },
  title2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700" as const,
    letterSpacing: 0.35,
  },
  title3: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "600" as const,
    letterSpacing: 0.38,
  },
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600" as const,
    letterSpacing: -0.41,
  },
  body: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "400" as const,
    letterSpacing: -0.41,
  },
  callout: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "400" as const,
    letterSpacing: -0.32,
  },
  subhead: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "400" as const,
    letterSpacing: -0.24,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
    letterSpacing: -0.08,
  },
  caption1: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
    letterSpacing: 0,
  },
  caption2: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "400" as const,
    letterSpacing: 0.07,
  },
  
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h1: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400" as const,
  },
};

export const Shadows = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  xl: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 5,
  },
};

export const GlassEffect = {
  intensity: {
    light: 60,
    medium: 80,
    heavy: 100,
  },
  opacity: {
    light: 0.6,
    medium: 0.72,
    heavy: 0.85,
  },
};

export const Animation = {
  spring: {
    fast: {
      damping: 20,
      stiffness: 300,
      mass: 0.5,
    },
    default: {
      damping: 15,
      stiffness: 150,
      mass: 0.8,
    },
    bouncy: {
      damping: 10,
      stiffness: 180,
      mass: 0.5,
    },
  },
  duration: {
    fast: 150,
    default: 250,
    slow: 350,
  },
  pressScale: 0.97,
};

export const Fonts = Platform.select({
  ios: {
    sans: "System",
    serif: "Georgia",
    mono: "Menlo",
  },
  android: {
    sans: "Roboto",
    serif: "serif",
    mono: "monospace",
  },
  default: {
    sans: "System",
    serif: "serif",
    mono: "monospace",
  },
  web: {
    sans: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "'SF Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});
