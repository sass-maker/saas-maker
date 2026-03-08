export type Theme = 'light' | 'dark';

export interface ThemeColors {
  bg: string;
  bgCard: string;
  bgCardHover: string;
  border: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;
  accentSecondary: string;
  error: string;
  chartGrid: string;
}

const darkColors: ThemeColors = {
  bg: '#09090b',
  bgCard: '#18181b',
  bgCardHover: 'rgba(39,39,42,0.5)',
  border: '#27272a',
  text: '#fafafa',
  textMuted: '#a1a1aa',
  textDim: '#71717a',
  accent: '#3b82f6',
  accentSecondary: '#8b5cf6',
  error: '#f87171',
  chartGrid: '#27272a',
};

const lightColors: ThemeColors = {
  bg: '#ffffff',
  bgCard: '#f4f4f5',
  bgCardHover: 'rgba(228,228,231,0.5)',
  border: '#e4e4e7',
  text: '#09090b',
  textMuted: '#52525b',
  textDim: '#a1a1aa',
  accent: '#3b82f6',
  accentSecondary: '#8b5cf6',
  error: '#ef4444',
  chartGrid: '#e4e4e7',
};

export function getColors(theme: Theme): ThemeColors {
  return theme === 'dark' ? darkColors : lightColors;
}

export const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export function tooltipStyle(theme: Theme): React.CSSProperties {
  const colors = getColors(theme);
  return {
    backgroundColor: colors.bgCard,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    color: colors.text,
  };
}
