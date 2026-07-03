export const COLORS = {
  accent: '#38AE5F',
  accentLight: 'rgba(56, 174, 95, 0.12)',
  bgRoot: '#000000',
  bgDefault: '#1C1C1E',
  bgSecondary: '#2C2C2E',
  bgTertiary: '#3A3A3C',
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textTertiary: '#666666',
  border: '#3A3A3C',
  info: '#60A5FA',
  warning: '#FBBF24',
  error: '#EF4444',
};

export const SPRING_TRANSITION = {
  type: 'spring',
  stiffness: 300,
  damping: 25
};

export const SPRING_HERO = {
  type: 'spring',
  stiffness: 200,
  damping: 20
};

export const SCENE_DURATIONS = {
  scene1: 1500, // Intro
  scene2: 3500, // Job Detail -> Complete Job
  scene3: 3500, // Add Invoice -> Send
  scene4: 2500, // Invoice Sent -> Record Payment
  scene5: 3500, // Record Payment Sheet -> Record
  scene6: 4000, // Paid Confirmation + Outro
};
