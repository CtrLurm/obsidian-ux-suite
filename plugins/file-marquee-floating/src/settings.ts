export interface FileMarqueeSettings {
  enabled: boolean;
  longPressMs: number;
  showToolbar: boolean;
  enableTearOff: boolean;
}

export const DEFAULT_SETTINGS: FileMarqueeSettings = {
  enabled: true,
  longPressMs: 320,
  showToolbar: true,
  enableTearOff: true,
};

export function clampLongPress(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SETTINGS.longPressMs;
  }
  return Math.min(900, Math.max(160, Math.round(value)));
}
