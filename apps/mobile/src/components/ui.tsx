import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from "react-native";
import { colors } from "../lib/theme";

export function Card({
  children,
  elevated = false,
}: PropsWithChildren<{ elevated?: boolean }>) {
  return (
    <View style={[styles.card, elevated && styles.cardElevated]}>
      {children}
    </View>
  );
}

export function Label({ children }: PropsWithChildren) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Button({
  children,
  variant = "primary",
  busy,
  disabled,
  ...props
}: PropsWithChildren<
  PressableProps & {
    variant?: "primary" | "secondary" | "danger";
    busy?: boolean;
  }
>) {
  return (
    <Pressable
      {...props}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        (pressed || disabled || busy) && styles.buttonDim,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={variant === "primary" ? colors.canvas : colors.text}
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === "primary" && styles.primaryText,
          ]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

export function StatusDot({ active }: { active: boolean }) {
  return (
    <View style={[styles.dot, active ? styles.dotActive : styles.dotIdle]} />
  );
}

export function Badge({
  children,
  tone = "muted",
}: PropsWithChildren<{
  tone?: "accent" | "muted" | "success" | "warning";
}>) {
  return (
    <View style={[styles.badge, styles[`badge_${tone}`]]}>
      <Text style={[styles.badgeText, styles[`badgeText_${tone}`]]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 14,
    boxShadow: "0 12px 24px rgba(0, 0, 0, 0.18)",
  },
  cardElevated: {
    backgroundColor: colors.panelRaised,
    borderColor: colors.borderBright,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    boxShadow: "0 6px 12px rgba(124, 248, 214, 0.18)",
  },
  secondary: {
    backgroundColor: colors.panelRaised,
    borderColor: colors.border,
  },
  danger: { backgroundColor: "#3B1720", borderColor: "#6B2732" },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  primaryText: { color: colors.canvas },
  buttonDim: { opacity: 0.55 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  dotActive: {
    backgroundColor: colors.success,
    borderColor: colors.accentSoft,
  },
  dotIdle: { backgroundColor: colors.muted, borderColor: colors.panelRaised },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  badge_accent: {
    backgroundColor: colors.accentDark,
    borderColor: colors.accentSoft,
  },
  badge_muted: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
  },
  badge_success: { backgroundColor: "#123422", borderColor: "#235D3B" },
  badge_warning: { backgroundColor: "#382A12", borderColor: "#6B5022" },
  badgeText_accent: { color: colors.accent },
  badgeText_muted: { color: colors.muted },
  badgeText_success: { color: colors.success },
  badgeText_warning: { color: colors.warning },
});
