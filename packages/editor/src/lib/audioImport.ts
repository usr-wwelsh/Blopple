import { Input, ALL_FORMATS, BlobSource, Output, BufferTarget, OggOutputFormat, Conversion, canEncodeAudio } from "mediabunny";

function bufferToDataUrl(buf: ArrayBuffer, mime: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([buf], { type: mime }));
  });
}

// Opus stays intelligible far lower than MP3 (no fixed bitrate table, and the codec itself is
// tuned for low bitrates), so the floor here is about game-BGM taste, not a codec limitation.
// Above MAX_BITRATE there's no point since it's background game audio.
const MIN_BITRATE = 16_000;
const MAX_BITRATE = 160_000;
// stereo only pays off once there's enough bitrate per channel to be worth it
const STEREO_BITRATE_THRESHOLD = 48_000;
// data URLs inflate raw bytes by 4/3 (base64) — budget against the embedded JSON size, not the encoded size
const BASE64_INFLATION = 4 / 3;

export const SIZE_TARGET_PRESETS: { label: string; targetJsonBytes: number }[] = [
  { label: "Small (~500KB in the map file)", targetJsonBytes: 500 * 1024 },
  { label: "Balanced (~1MB in the map file)", targetJsonBytes: 1024 * 1024 },
  { label: "High quality (~2MB in the map file)", targetJsonBytes: 2 * 1024 * 1024 },
];

async function getAudioDuration(input: Input): Promise<number> {
  const fromMetadata = await input.getDurationFromMetadata();
  if (fromMetadata !== null) return fromMetadata;
  return input.computeDuration();
}

/** Decodes an arbitrary audio file and re-encodes it to Ogg Opus using the browser's native
 * WebCodecs encoder — no WASM plugin needed, since (unlike MP3) every current Chromium and
 * Firefox ships a built-in Opus encoder. Opus also sounds far better than MP3 at the same
 * bitrate, which matters here since these are low-bitrate encodes for embedding.
 *
 * targetJsonBytes is a target for the resulting *embedded* (base64) size, since that's what
 * actually bloats the map file — the bitrate is derived from the track's duration to hit it,
 * rather than using a flat bitrate that only works for short clips. */
export async function encodeAudioFile(file: File, targetJsonBytes: number, onProgress?: (fraction: number) => void): Promise<string> {
  if (!(await canEncodeAudio("opus"))) throw new Error("This browser can't encode Opus audio.");

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const duration = await getAudioDuration(input);
  const targetRawBytes = targetJsonBytes / BASE64_INFLATION;
  const bitrate = Math.min(MAX_BITRATE, Math.max(MIN_BITRATE, Math.round((targetRawBytes * 8) / duration)));

  const output = new Output({ format: new OggOutputFormat(), target: new BufferTarget() });
  const conversion = await Conversion.init({
    input,
    output,
    video: { discard: true },
    audio: { codec: "opus", bitrate, numberOfChannels: bitrate <= STEREO_BITRATE_THRESHOLD ? 1 : 2 },
  });
  if (!conversion.isValid) throw new Error("This file doesn't look like a supported audio format.");
  if (onProgress) conversion.onProgress = onProgress;

  await conversion.execute();
  const buf = output.target.buffer;
  if (!buf) throw new Error("Encoding produced no output.");
  return bufferToDataUrl(buf, "audio/ogg");
}
