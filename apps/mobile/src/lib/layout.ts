type CockpitLayoutMode = "compact" | "intermediate" | "regular";

export interface CockpitLayout {
  mode: CockpitLayoutMode;
  width: number;
  height: number;
  contentMaxWidth: number;
  sidebarWidth: number;
  previewHeight: number;
}

export function deriveCockpitLayout(
  width: number,
  height: number,
): CockpitLayout {
  const safeWidth = Math.max(320, width);
  const safeHeight = Math.max(320, height);
  const mode: CockpitLayoutMode =
    safeWidth < 700
      ? "compact"
      : safeWidth < 1_000
        ? "intermediate"
        : "regular";
  return {
    mode,
    width: safeWidth,
    height: safeHeight,
    contentMaxWidth:
      mode === "regular" ? 1_360 : mode === "intermediate" ? 900 : 720,
    sidebarWidth: mode === "regular" ? 248 : 0,
    previewHeight:
      mode === "regular"
        ? Math.max(560, Math.min(920, safeHeight - 180))
        : Math.max(460, Math.min(700, safeHeight - 120)),
  };
}
