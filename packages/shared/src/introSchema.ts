export const INTRO_OUTRO_SCHEMA_VERSION = 1;

export type BackgroundMode = "stretch" | "tile";

/** Shared shape for the title (intro) and level-complete (outro) screens: a looped music
 * track, a Doom-style vertical text crawl, and a full-screen background. */
export interface IntroOutroConfig {
  schemaVersion: typeof INTRO_OUTRO_SCHEMA_VERSION;
  /** Ref (see parseMusicRef) looped for the duration of this screen. */
  musicId: string | null;
  /** Lines shown scrolling bottom-to-top, in order. */
  text: string[];
  /** Hex color the crawl text is drawn in. */
  textColor: string;
  /** Ref (see parseTextureRef) painted behind the crawl; null = plain black. */
  backgroundId: string | null;
  backgroundMode: BackgroundMode;
}

export function emptyIntroOutroConfig(text: string[] = []): IntroOutroConfig {
  return {
    schemaVersion: INTRO_OUTRO_SCHEMA_VERSION,
    musicId: null,
    text,
    textColor: "#e8e8e8",
    backgroundId: null,
    backgroundMode: "tile",
  };
}
