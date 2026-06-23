export interface BurnInConfig {
  /** Stunde (0–23), ab der Nacht-Dimm startet */
  nightStart: number;
  /** Stunde (0–23), ab der Nacht-Dimm endet */
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
  nightStart: 23,
  nightEnd: 7,
  nightBrightness: 0.30,
  screensaverTimeout: 15 * 60 * 1000,  // 15 Minuten
  pixelShiftInterval: 3 * 60 * 1000,   // 3 Minuten
  pixelShiftMax: 3,
};