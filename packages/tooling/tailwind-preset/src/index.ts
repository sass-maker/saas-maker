/**
 * Tailwind v3 JS preset using Foundry tokens.
 * v4 consumers should `@import "@saas-maker/tailwind-preset/theme.css"` instead.
 */

import {
  charts,
  colors,
  fontFamily,
  fontSize,
  radius,
  shadows,
  spacing,
} from './tokens.js';

// Conform to Tailwind's `Config` shape without taking a hard dep.
export interface TailwindPresetConfig {
  theme: {
    extend: {
      colors: Record<string, string>;
      spacing: Record<string, string>;
      fontFamily: Record<string, string[]>;
      fontSize: Record<string, [string, { lineHeight: string }]>;
      borderRadius: Record<string, string>;
      boxShadow: Record<string, string>;
    };
  };
}

export const foundryPreset: TailwindPresetConfig = {
  theme: {
    extend: {
      colors: {
        background: colors.background,
        foreground: colors.foreground,
        card: colors.card,
        'card-foreground': colors.cardForeground,
        popover: colors.popover,
        'popover-foreground': colors.popoverForeground,
        primary: colors.primary,
        'primary-foreground': colors.primaryForeground,
        secondary: colors.secondary,
        'secondary-foreground': colors.secondaryForeground,
        muted: colors.muted,
        'muted-foreground': colors.mutedForeground,
        accent: colors.accent,
        'accent-foreground': colors.accentForeground,
        destructive: colors.destructive,
        border: colors.border,
        input: colors.input,
        ring: colors.ring,
        ...charts,
      },
      spacing: { ...(spacing as unknown as Record<string, string>) },
      fontFamily: { ...(fontFamily as unknown as Record<string, string[]>) },
      fontSize: { ...(fontSize as unknown as Record<string, [string, { lineHeight: string }]>) },
      borderRadius: { ...(radius as unknown as Record<string, string>) },
      boxShadow: { ...(shadows as unknown as Record<string, string>) },
    },
  },
};

export default foundryPreset;
export * from './tokens.js';
