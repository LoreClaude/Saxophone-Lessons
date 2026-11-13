// Rhythm helpers shared by playback and evaluation.

/** Swing eighths: the off-beat eighth is delayed to 2/3 of the beat. */
export function swingBeat(beat: number) {
  const whole = Math.floor(beat);
  const frac = beat - whole;
  if (Math.abs(frac - 0.5) < 1e-6) return whole + 2 / 3;
  return beat;
}
