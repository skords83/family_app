export interface BurnInConfig {
  /** Minuten seit Mitternacht (0–1439), ab denen Nacht-Dimm startet */
  nightStart: number;
  /** Minuten seit Mitternacht (0–1439), ab denen Nacht-Dimm endet */
  nightEnd: number;
  /** Helligkeit im Nacht-Modus (0.0 – 1.0) */
  nightBrightness: number;
  /** Millisekunden bis Screensaver erscheint */
  screensaverTimeout: number;
  /** Millisekunden zwischen Pixel-Shifts */
  pixelShiftInterval: number;
  /** Maximaler Versatz in Pixel */
  pixelShiftMax: number;
}

export const DEFAULT_CONFIG: BurnInConfig = {
  nightStart: 22 * 60 + 30, // 22:30
  nightEnd: 6 * 60,         // 06:00
  nightBrightness: 0.30,
  screensaverTimeout: 8 * 60 * 1000,   // 8 Minuten
  pixelShiftInterval: 3 * 60 * 1000,   // 3 Minuten
  pixelShiftMax: 3,
};