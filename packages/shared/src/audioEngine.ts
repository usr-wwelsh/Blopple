import type { DrumType, Instrument, SfxLayer } from "./musicSchema";

// Shared Web Audio synthesis core used by both the editor (song/sfx authoring + preview)
// and the game runtime (one-shot sfx playback). Callers own their own AudioContext lifecycle;
// everything here is pure scheduling against a context + destination passed in.

const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();

function getNoiseBuffer(actx: AudioContext): AudioBuffer {
  let buf = noiseBuffers.get(actx);
  if (buf) return buf;
  buf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffers.set(actx, buf);
  return buf;
}

export function noteToFrequency(note: number): number {
  return 261.6256 * Math.pow(2, note / 12);
}

function clampHz(hz: number): number {
  return Math.min(20000, Math.max(20, hz));
}

function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 4096;
  const k = amount * 100;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function applyEnvelope(
  gain: GainNode,
  when: number,
  attack: number,
  decay: number,
  sustain: number,
  release: number,
  duration: number,
  peak: number,
): number {
  const g = gain.gain;
  const sustainStart = when + Math.max(attack, 0.001);
  const sustainLevelTime = sustainStart + Math.max(decay, 0);
  const holdEnd = Math.max(sustainLevelTime, when + duration);
  g.cancelScheduledValues(when);
  g.setValueAtTime(0, when);
  g.linearRampToValueAtTime(peak, sustainStart);
  g.linearRampToValueAtTime(peak * sustain, sustainLevelTime);
  g.setValueAtTime(peak * sustain, holdEnd);
  g.linearRampToValueAtTime(0, holdEnd + Math.max(release, 0.001));
  return holdEnd + release;
}

function playDrum(actx: AudioContext, dest: AudioNode, drumType: DrumType, when: number, volume: number): void {
  switch (drumType) {
    case "kick": {
      const osc = actx.createOscillator();
      osc.type = "sine";
      const gain = actx.createGain();
      osc.connect(gain).connect(dest);
      osc.frequency.setValueAtTime(150, when);
      osc.frequency.exponentialRampToValueAtTime(40, when + 0.15);
      gain.gain.setValueAtTime(volume, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.3);
      osc.start(when);
      osc.stop(when + 0.32);
      break;
    }
    case "snare": {
      const src = actx.createBufferSource();
      src.buffer = getNoiseBuffer(actx);
      const filter = actx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1800;
      const gain = actx.createGain();
      src.connect(filter).connect(gain).connect(dest);
      gain.gain.setValueAtTime(volume, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.15);
      src.start(when);
      src.stop(when + 0.16);
      break;
    }
    case "hihat": {
      const src = actx.createBufferSource();
      src.buffer = getNoiseBuffer(actx);
      const filter = actx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 7000;
      const gain = actx.createGain();
      src.connect(filter).connect(gain).connect(dest);
      gain.gain.setValueAtTime(volume * 0.8, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
      src.start(when);
      src.stop(when + 0.06);
      break;
    }
    case "clap": {
      for (const offset of [0, 0.015, 0.03]) {
        const src = actx.createBufferSource();
        src.buffer = getNoiseBuffer(actx);
        const filter = actx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1200;
        const gain = actx.createGain();
        src.connect(filter).connect(gain).connect(dest);
        const t = when + offset;
        gain.gain.setValueAtTime(volume * 0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        src.start(t);
        src.stop(t + 0.13);
      }
      break;
    }
  }
}

/** Plays one instrument's note. `gainMultiplier` scales the instrument's own volume, used by
 *  playSfx to balance stacked layers without mutating the instrument's stored volume. */
export function playInstrument(
  actx: AudioContext,
  dest: AudioNode,
  instrument: Instrument,
  note: number,
  when: number,
  duration: number,
  gainMultiplier = 1,
): void {
  if (instrument.kind === "drum") {
    playDrum(actx, dest, instrument.drumType, when, instrument.volume * gainMultiplier);
    return;
  }

  const sweepTime = Math.max(instrument.attack + instrument.decay, 0.001);
  const targetFreq = noteToFrequency(note);

  const mix = actx.createGain();
  let head: AudioNode = mix;

  const osc = actx.createOscillator();
  osc.type = instrument.waveform;
  if (instrument.pitchDecay !== 0) {
    osc.frequency.setValueAtTime(targetFreq * Math.pow(2, instrument.pitchDecay / 12), when);
    osc.frequency.exponentialRampToValueAtTime(targetFreq, when + sweepTime);
  } else {
    osc.frequency.setValueAtTime(targetFreq, when);
  }
  const oscLevel = actx.createGain();
  oscLevel.gain.value = 1 - instrument.noiseMix;
  osc.connect(oscLevel).connect(mix);
  osc.start(when);

  let noise: AudioBufferSourceNode | null = null;
  if (instrument.noiseMix > 0) {
    noise = actx.createBufferSource();
    noise.buffer = getNoiseBuffer(actx);
    noise.loop = true;
    const noiseLevel = actx.createGain();
    noiseLevel.gain.value = instrument.noiseMix;
    noise.connect(noiseLevel).connect(mix);
    noise.start(when);
  }

  if (instrument.filterType !== "none") {
    const filter = actx.createBiquadFilter();
    filter.type = instrument.filterType;
    filter.Q.value = instrument.filterQ;
    const targetCutoff = clampHz(instrument.filterCutoff);
    if (instrument.filterEnvAmount !== 0) {
      filter.frequency.setValueAtTime(clampHz(instrument.filterCutoff * Math.pow(2, instrument.filterEnvAmount)), when);
      filter.frequency.exponentialRampToValueAtTime(targetCutoff, when + sweepTime);
    } else {
      filter.frequency.setValueAtTime(targetCutoff, when);
    }
    head.connect(filter);
    head = filter;
  }

  if (instrument.distortion > 0) {
    const shaper = actx.createWaveShaper();
    shaper.curve = makeDistortionCurve(instrument.distortion);
    shaper.oversample = "2x";
    head.connect(shaper);
    head = shaper;
  }

  const gain = actx.createGain();
  head.connect(gain).connect(dest);

  const stopAt = applyEnvelope(
    gain,
    when,
    instrument.attack,
    instrument.decay,
    instrument.sustain,
    instrument.release,
    duration,
    instrument.volume * gainMultiplier,
  );
  osc.stop(stopAt + 0.05);
  noise?.stop(stopAt + 0.05);
}

/** Schedules every layer of a stacked sfx, each at `when + layer.delay`. */
export function playSfxLayers(actx: AudioContext, dest: AudioNode, layers: SfxLayer[], when: number, duration: number): void {
  for (const layer of layers) {
    playInstrument(actx, dest, layer.instrument, layer.note, when + layer.delay, duration, layer.gain);
  }
}
