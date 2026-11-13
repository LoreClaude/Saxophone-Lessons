// Evaluators: turn microphone analysis into scores, per-note judgments and
// offline tips. All functions are pure and unit-tested.
import type { Frame } from '../audio/dsp';
import { segmentNotes, median, type DetectedNote } from '../audio/segment';
import type { Score, ScoreNote } from '../music/abc';
import { concertToWritten, noteNameRu, ALTO_TRANSPOSE } from '../music/notes';
import { parseChord, chordPcs, scalePcs, type ScaleType } from '../music/theory';
import { swingBeat } from '../music/rhythm';
import {
  starsFor,
  type Criterion,
  type EvalResult,
  type Judgment,
  type NoteResult,
  type Tolerances,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 100 when v <= perfect, 0 when v >= zero, linear in between. */
export function mapDown(v: number, perfect: number, zero: number) {
  if (!Number.isFinite(v)) return 0;
  if (v <= perfect) return 100;
  if (v >= zero) return 0;
  return Math.round((100 * (zero - v)) / (zero - perfect));
}

/** 100 when v >= full, 0 when v <= zero. */
export function mapUp(v: number, zero: number, full: number) {
  if (!Number.isFinite(v)) return 0;
  if (v >= full) return 100;
  if (v <= zero) return 0;
  return Math.round((100 * (v - zero)) / (full - zero));
}

/** 100 inside [lo, hi], decreasing linearly to 0 at `soft` beyond the range. */
export function mapRange(v: number, lo: number, hi: number, soft: number) {
  if (!Number.isFinite(v)) return 0;
  if (v >= lo && v <= hi) return 100;
  const d = v < lo ? lo - v : v - hi;
  return Math.max(0, Math.round(100 * (1 - d / soft)));
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const std = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) * (x - m))));
};

export function finalize(
  criteria: Criterion[],
  tol: Tolerances,
  extra: Partial<EvalResult> & { durationSec: number; tips?: string[]; metrics?: EvalResult['metrics'] },
  passOverride?: number,
): EvalResult {
  const used = criteria.filter((c) => c.weight > 0);
  const wsum = used.reduce((a, c) => a + c.weight, 0) || 1;
  const score = Math.round(used.reduce((a, c) => a + c.score * c.weight, 0) / wsum);
  const pass = passOverride ?? tol.passScore;
  const passed = score >= pass;
  const summary =
    score >= 95
      ? 'Блестяще! Почти идеально.'
      : score >= 85
        ? 'Отлично!'
        : passed
          ? 'Зачёт! Можно двигаться дальше.'
          : score >= pass - 15
            ? 'Почти получилось — ещё одна попытка!'
            : 'Нужно ещё потренироваться.';
  return {
    score,
    passed,
    stars: starsFor(score, pass),
    criteria,
    summary,
    tips: extra.tips ?? [],
    metrics: { score, passScore: pass, ...(extra.metrics ?? {}) },
    notes: extra.notes,
    points: extra.points,
    maxCombo: extra.maxCombo,
    durationSec: extra.durationSec,
  };
}

/** Frames converted to written pitch (alto). */
export function writtenMidi(f: Frame) {
  return f.midi - ALTO_TRANSPOSE;
}

function judge(cents: number, timing: number | undefined, tol: Tolerances): Judgment {
  const ac = Math.abs(cents);
  const at = timing === undefined ? 0 : Math.abs(timing);
  if (ac <= tol.centsPerfect && at <= tol.timingPerfect) return 'perfect';
  if (ac <= tol.centsGood && at <= tol.timingGood) return 'good';
  return 'ok';
}

export const JUDGMENT_POINTS: Record<Judgment, number> = { perfect: 100, good: 70, ok: 40, wrong: 0, miss: 0 };

export function comboMultiplier(combo: number) {
  return combo >= 50 ? 4 : combo >= 25 ? 3 : combo >= 10 ? 2 : 1;
}

/** Arcade points and max combo from a list of judgments. */
export function arcade(judgments: Judgment[]) {
  let combo = 0;
  let maxCombo = 0;
  let points = 0;
  for (const j of judgments) {
    if (j === 'perfect' || j === 'good') combo++;
    else if (j !== 'ok') combo = 0; // 'ok' keeps the combo alive without growing it
    maxCombo = Math.max(maxCombo, combo);
    points += JUDGMENT_POINTS[j] * comboMultiplier(combo);
  }
  return { points, maxCombo };
}

function intonationTip(meanCents: number, tol: Tolerances): string | null {
  if (meanCents > tol.centsGood * 0.6)
    return 'Звук в среднем завышен. Ослабьте давление нижней губы, опустите челюсть чуть ниже и не «зажимайте» мундштук.';
  if (meanCents < -tol.centsGood * 0.6)
    return 'Звук в среднем занижен. Добавьте опоры дыхания, чуть плотнее обхватите мундштук губами; проверьте, не выдвинут ли мундштук слишком далеко.';
  return null;
}

// ---------------------------------------------------------------------------
// Sequence (play from notation in tempo)
// ---------------------------------------------------------------------------

export interface SequenceEvalOptions {
  t0: number;
  bpm: number;
  latency: number;
  checkArticulation?: boolean;
  checkDynamics?: boolean;
  swing?: boolean;
}

interface Expected {
  note: ScoreNote;
  t: number;
  dur: number;
}

export function expectedTimes(score: Score, bpm: number, t0: number, swing = false): Expected[] {
  const spb = 60 / bpm;
  return score.notes.map((note) => {
    const sb = swing ? swingBeat(note.beat) : note.beat;
    const eb = swing ? swingBeat(note.beat + note.beats) : note.beat + note.beats;
    return { note, t: t0 + sb * spb, dur: (eb - sb) * spb };
  });
}

/** DP alignment of expected notes with detected notes. Returns match index per expected (-1 = missed). */
export function alignNotes(exp: Expected[], det: { t: number; midi: number; dur: number }[], maxDev: number, beatSec: number) {
  const n = exp.length;
  const m = det.length;
  const INF = 1e12;
  const MISS = 1.0;
  const extra = (d: { dur: number }) => 0.35 + Math.min(0.5, (d.dur / beatSec) * 0.25);
  const cost = (e: Expected, d: { t: number; midi: number }) => {
    const dt = Math.abs(d.t - e.t);
    if (dt > maxDev) return INF;
    const dp = Math.abs(d.midi - e.note.midi);
    const pc = dp === 0 ? 0 : dp === 12 || dp === 19 || dp === 24 ? 0.7 : dp <= 2 ? 0.6 : 0.85;
    return pc + 0.4 * (dt / maxDev);
  };
  const W = m + 1;
  const dp = new Float64Array((n + 1) * W).fill(INF);
  const bt = new Uint8Array((n + 1) * W);
  dp[0] = 0;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      const cur = dp[i * W + j];
      if (cur >= INF) continue;
      if (i < n && cur + MISS < dp[(i + 1) * W + j]) {
        dp[(i + 1) * W + j] = cur + MISS;
        bt[(i + 1) * W + j] = 2;
      }
      if (j < m) {
        const c = cur + extra(det[j]);
        if (c < dp[i * W + j + 1]) {
          dp[i * W + j + 1] = c;
          bt[i * W + j + 1] = 3;
        }
      }
      if (i < n && j < m) {
        const mc = cost(exp[i], det[j]);
        if (mc < INF && cur + mc < dp[(i + 1) * W + j + 1]) {
          dp[(i + 1) * W + j + 1] = cur + mc;
          bt[(i + 1) * W + j + 1] = 1;
        }
      }
    }
  }
  const match = new Array<number>(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const b = bt[i * W + j];
    if (b === 1) {
      match[i - 1] = j - 1;
      i--;
      j--;
    } else if (b === 2) i--;
    else if (b === 3) j--;
    else break;
  }
  return match;
}

const DYN_LEVEL: Record<string, number> = { ppp: 0, pp: 1, p: 2, mp: 3, mf: 4, f: 5, ff: 6, fff: 7, sfz: 6 };

export function evaluateSequence(score: Score, frames: Frame[], o: SequenceEvalOptions, tol: Tolerances): EvalResult {
  const spb = 60 / o.bpm;
  const exp = expectedTimes(score, o.bpm, o.t0, o.swing);
  const endT = exp.length ? exp[exp.length - 1].t + exp[exp.length - 1].dur : o.t0;
  const windowStart = o.t0 - Math.max(0.6, spb);
  const windowEnd = endT + Math.max(0.8, spb * 1.5);
  const relevant = frames.filter((f) => f.t - o.latency >= windowStart && f.t - o.latency <= windowEnd);
  const detected = segmentNotes(relevant).map((d) => ({
    ...d,
    t: d.start - o.latency,
    wmidi: concertToWritten(d.midi),
    dur: d.end - d.start,
  }));
  const maxDev = Math.max(0.3, Math.min(0.7, spb * 0.6));
  const match = alignNotes(
    exp,
    detected.map((d) => ({ t: d.t, midi: d.wmidi, dur: d.dur })),
    maxDev,
    spb,
  );

  const results: NoteResult[] = [];
  const used = new Set<number>();
  const correctCents: number[] = [];
  const correctTiming: number[] = [];
  const signedTiming: number[] = [];
  const durScores: number[] = [];
  const stabilities: number[] = [];
  let artOk = 0;
  let artTotal = 0;
  let squeaks = 0;

  exp.forEach((e, i) => {
    const j = match[i];
    if (j < 0) {
      // repeated note not re-articulated?
      const prev = i > 0 ? match[i - 1] : -1;
      const merged =
        prev >= 0 &&
        exp[i - 1].note.midi === e.note.midi &&
        detected[prev].wmidi === e.note.midi &&
        detected[prev].end - o.latency > e.t + 0.05;
      results.push({ i, expected: e.note.midi, judgment: 'miss', flag: merged ? 'merged' : undefined });
      if (merged && o.checkArticulation) artTotal++;
      return;
    }
    used.add(j);
    const d = detected[j];
    const timing = d.t - e.t;
    if (d.wmidi !== e.note.midi) {
      const diff = d.wmidi - e.note.midi;
      const squeak = diff >= 12 && d.dur < 0.35;
      if (squeak) squeaks++;
      results.push({ i, expected: e.note.midi, played: d.wmidi, timing, judgment: 'wrong', flag: squeak ? 'squeak' : undefined });
      return;
    }
    const j2 = judge(d.cents, timing, tol);
    results.push({ i, expected: e.note.midi, played: d.wmidi, cents: d.cents, timing, judgment: j2 });
    correctCents.push(d.cents);
    correctTiming.push(Math.abs(timing));
    signedTiming.push(timing);
    if (d.dur > 0.25) stabilities.push(d.stdCents);
    // duration
    const ratio = d.dur / Math.max(0.05, e.dur);
    if (e.note.staccato) durScores.push(ratio <= 0.65 ? 100 : mapDown(ratio, 0.65, 1.0));
    else if (e.note.beats >= 0.75) {
      const nextSlurred = score.notes[i + 1]?.slurred;
      durScores.push(mapUp(ratio, 0.35, nextSlurred ? 0.85 : 0.75));
    }
    // articulation
    if (o.checkArticulation && i > 0) {
      artTotal++;
      const expectSlur = e.note.slurred;
      const prevGap = i > 0 ? e.t - (exp[i - 1].t + exp[i - 1].dur) : 1;
      const want = expectSlur ? 'slurred' : 'tongued';
      if (d.attack === want || (prevGap > 0.05 && d.attack === 'tongued')) artOk++;
    }
  });

  // extra notes that look like squeaks (way above the expected line)
  detected.forEach((d, j) => {
    if (used.has(j)) return;
    const near = exp.reduce((best, e) => (Math.abs(e.t - d.t) < Math.abs(best.t - d.t) ? e : best), exp[0]);
    if (near && d.wmidi - near.note.midi >= 12 && d.dur < 0.35) squeaks++;
  });

  const total = exp.length || 1;
  const correct = results.filter((r) => r.judgment === 'perfect' || r.judgment === 'good' || r.judgment === 'ok').length;
  const pitchScore = Math.round((100 * correct) / total);
  const meanAbsCents = mean(correctCents.map(Math.abs));
  const meanCents = mean(correctCents);
  const meanAbsTiming = mean(correctTiming);
  const meanSignedTiming = mean(signedTiming);
  const extras = detected.length - used.size;

  const criteria: Criterion[] = [
    {
      id: 'pitch',
      label: 'Ноты',
      score: pitchScore,
      weight: 0.36,
      detail: `Верно сыграно ${correct} из ${exp.length} нот${extras > 0 ? `, лишних звуков: ${extras}` : ''}.`,
    },
    {
      id: 'rhythm',
      label: 'Ритм',
      score: correct ? mapDown(meanAbsTiming, tol.timingPerfect, tol.timingGood * 3) : 0,
      weight: 0.2,
      detail: correct
        ? `Среднее отклонение от доли — ${Math.round(meanAbsTiming * 1000)} мс${
            Math.abs(meanSignedTiming) > tol.timingPerfect ? (meanSignedTiming > 0 ? ' (опаздываете)' : ' (спешите)') : ''
          }.`
        : 'Нет верно сыгранных нот для оценки ритма.',
    },
    {
      id: 'intonation',
      label: 'Интонация',
      score: correct ? mapDown(meanAbsCents, tol.centsPerfect, tol.centsGood * 2.5) : 0,
      weight: 0.15,
      detail: correct ? `Среднее отклонение — ${Math.round(meanAbsCents)} центов (${meanCents >= 0 ? 'выше' : 'ниже'}).` : '—',
    },
  ];
  if (durScores.length)
    criteria.push({
      id: 'duration',
      label: 'Длительности',
      score: Math.round(mean(durScores)),
      weight: 0.09,
      detail: 'Насколько точно вы выдерживаете длинные ноты и укорачиваете стаккато.',
    });
  if (stabilities.length)
    criteria.push({
      id: 'stability',
      label: 'Ровность звука',
      score: mapDown(mean(stabilities), 6, 30),
      weight: 0.06,
      detail: `Колебание высоты внутри нот — ${Math.round(mean(stabilities))} центов.`,
    });
  const clarity = mean(relevant.filter((f) => f.voiced).map((f) => f.clarity));
  criteria.push({
    id: 'tone',
    label: 'Звук',
    score: Math.max(0, Math.min(100, mapUp(clarity, 0.75, 0.9) - squeaks * 15)),
    weight: 0.08,
    detail: squeaks ? `«Киксов» (писков): ${squeaks}.` : 'Звук чистый, без писков.',
  });
  if (o.checkArticulation && artTotal)
    criteria.push({
      id: 'articulation',
      label: 'Артикуляция',
      score: Math.round((100 * artOk) / artTotal),
      weight: 0.08,
      detail: `Атака и лиги сыграны как в нотах: ${artOk} из ${artTotal}.`,
    });

  // dynamics (relative levels between marked sections and hairpins)
  if (o.checkDynamics) {
    const dyn = dynamicsScore(exp, match, detected);
    if (dyn) criteria.push({ id: 'dynamics', label: 'Динамика', score: dyn.score, weight: 0.1, detail: dyn.detail });
  }

  const tips: string[] = [];
  if (pitchScore < 80) {
    const wrong = results.filter((r) => r.judgment === 'wrong');
    const missed = results.filter((r) => r.judgment === 'miss');
    if (wrong.length) {
      const names = [...new Set(wrong.map((r) => noteNameRu(r.expected)))].slice(0, 3).join(', ');
      tips.push(`Ошибки в нотах: ${names}. Проверьте аппликатуры — включите подсказки и сыграйте медленно в режиме «ожидания».`);
    }
    if (missed.length > wrong.length) tips.push('Часть нот не прозвучала. Играйте увереннее и немного громче; если не успеваете — уменьшите темп.');
  }
  if (correct && Math.abs(meanSignedTiming) > tol.timingGood * 0.7)
    tips.push(meanSignedTiming > 0 ? 'Вы систематически опаздываете. Вдыхайте заранее, на предыдущую долю.' : 'Вы спешите. Слушайте метроном и не «загоняйте» темп.');
  const it = correct ? intonationTip(meanCents, tol) : null;
  if (it) tips.push(it);
  if (squeaks) tips.push('Были «киксы». Не сжимайте мундштук, проверьте, что трость не повреждена и стоит ровно, а нижняя губа слегка прикрывает зубы.');
  const merged = results.filter((r) => r.flag === 'merged').length;
  if (merged) tips.push('Повторяющиеся ноты слились в одну. Отделяйте каждую ноту лёгким движением языка: «ту-ту».');

  const judgments = results.map((r) => r.judgment);
  const { points, maxCombo } = arcade(judgments);
  return finalize(criteria, tol, {
    notes: results,
    points,
    maxCombo,
    durationSec: windowEnd - windowStart,
    tips,
    metrics: {
      notes: exp.length,
      correct,
      wrong: results.filter((r) => r.judgment === 'wrong').length,
      missed: results.filter((r) => r.judgment === 'miss').length,
      extraNotes: extras,
      meanCents: round1(meanCents),
      meanAbsCents: round1(meanAbsCents),
      meanTimingMs: Math.round(meanSignedTiming * 1000) || 0,
      meanAbsTimingMs: Math.round(meanAbsTiming * 1000) || 0,
      squeaks,
      bpm: o.bpm,
      perfect: judgments.filter((j) => j === 'perfect').length,
    },
  });
}

function dynamicsScore(exp: Expected[], match: number[], det: (DetectedNote & { wmidi: number })[]) {
  // sections by dynamic marks
  const sections: { level: number; dbs: number[] }[] = [];
  let curLevel = -1;
  exp.forEach((e, i) => {
    if (e.note.dynamic && DYN_LEVEL[e.note.dynamic] !== undefined) {
      curLevel = DYN_LEVEL[e.note.dynamic];
      sections.push({ level: curLevel, dbs: [] });
    }
    const j = match[i];
    if (j >= 0 && sections.length && det[j].wmidi === e.note.midi) sections[sections.length - 1].dbs.push(det[j].db);
  });
  const parts: number[] = [];
  for (let k = 1; k < sections.length; k++) {
    const a = sections[k - 1];
    const b = sections[k];
    if (!a.dbs.length || !b.dbs.length || a.level === b.level) continue;
    const want = Math.sign(b.level - a.level);
    const diff = mean(b.dbs) - mean(a.dbs);
    const need = Math.min(9, 3 * Math.abs(b.level - a.level));
    parts.push(diff * want >= need ? 100 : diff * want <= 0 ? 0 : Math.round((100 * diff * want) / need));
  }
  // hairpins
  let start = -1;
  exp.forEach((e, i) => {
    if (e.note.cresc === 'start' || e.note.dim === 'start') start = i;
    if ((e.note.cresc === 'end' || e.note.dim === 'end') && start >= 0) {
      const ja = match[start];
      const jb = match[i];
      if (ja >= 0 && jb >= 0) {
        const want = e.note.cresc === 'end' ? 1 : -1;
        const diff = (det[jb].db - det[ja].db) * want;
        parts.push(diff >= 6 ? 100 : diff <= 0 ? 0 : Math.round((100 * diff) / 6));
      }
      start = -1;
    }
  });
  if (!parts.length) return null;
  return { score: Math.round(mean(parts)), detail: 'Разница громкости между p и f и выполнение «вилок» крещендо/диминуэндо.' };
}

const round1 = (v: number) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);

// ---------------------------------------------------------------------------
// Wait mode / note drills
// ---------------------------------------------------------------------------

export interface WaitNoteRecord {
  expected: number;
  reaction: number;
  wrongAttempts: number;
  cents: number;
  std: number;
  squeak?: boolean;
  skipped?: boolean;
}

export function evaluateWait(records: WaitNoteRecord[], tol: Tolerances, tier: number, durationSec: number): EvalResult {
  const n = records.length || 1;
  const firstTry = records.filter((r) => !r.skipped && r.wrongAttempts === 0).length;
  const played = records.filter((r) => !r.skipped);
  const cents = played.map((r) => r.cents);
  const reaction = median(played.map((r) => r.reaction));
  const squeaks = records.filter((r) => r.squeak).length;
  const fast = tier >= 3 ? 0.8 : 1.2;
  const slow = tier >= 3 ? 4 : 6;
  const criteria: Criterion[] = [
    {
      id: 'pitch',
      label: 'Ноты с первого раза',
      score: Math.round((100 * firstTry) / n),
      weight: 0.4,
      detail: `Сразу верно: ${firstTry} из ${records.length}.`,
    },
    {
      id: 'reaction',
      label: 'Скорость',
      score: played.length ? mapDown(reaction, fast, slow) : 0,
      weight: 0.25,
      detail: played.length ? `Обычно вы находите ноту за ${reaction.toFixed(1)} с.` : '—',
    },
    {
      id: 'intonation',
      label: 'Интонация',
      score: played.length ? mapDown(mean(cents.map(Math.abs)), tol.centsPerfect, tol.centsGood * 2.5) : 0,
      weight: 0.25,
      detail: played.length ? `Среднее отклонение — ${Math.round(mean(cents.map(Math.abs)))} центов.` : '—',
    },
    {
      id: 'tone',
      label: 'Звук',
      score: Math.max(0, 100 - squeaks * 20),
      weight: 0.1,
      detail: squeaks ? `«Киксов»: ${squeaks}.` : 'Без писков.',
    },
  ];
  const tips: string[] = [];
  if (firstTry < n * 0.7) tips.push('Прежде чем дуть, поставьте пальцы и мысленно проверьте аппликатуру по подсказке.');
  if (reaction > slow * 0.6) tips.push('Ищете ноту долго. Повторите аппликатуры в таблице и попробуйте сначала «сыграть» пальцами без звука.');
  const it = played.length ? intonationTip(mean(cents), tol) : null;
  if (it) tips.push(it);
  const judgments: Judgment[] = records.map((r) =>
    r.skipped ? 'miss' : r.wrongAttempts > 0 ? 'ok' : judge(r.cents, undefined, tol),
  );
  const { points, maxCombo } = arcade(judgments);
  return finalize(criteria, tol, {
    durationSec,
    tips,
    points,
    maxCombo,
    notes: records.map((r, i) => ({ i, expected: r.expected, cents: r.cents, judgment: judgments[i] })),
    metrics: {
      notes: records.length,
      firstTry,
      skipped: records.filter((r) => r.skipped).length,
      medianReactionSec: round1(reaction),
      meanCents: round1(mean(cents)),
      squeaks,
    },
  });
}

// ---------------------------------------------------------------------------
// Long tones
// ---------------------------------------------------------------------------

/** Longest run of frames satisfying `pred`, tolerating gaps up to `gap` seconds. */
function longestRun(frames: Frame[], pred: (f: Frame) => boolean, gap = 0.08) {
  let best: Frame[] = [];
  let cur: Frame[] = [];
  let lastOk = -Infinity;
  for (const f of frames) {
    if (pred(f)) {
      if (f.t - lastOk > gap && cur.length) {
        if (cur.length > best.length) best = cur;
        cur = [];
      }
      cur.push(f);
      lastOk = f.t;
    }
  }
  if (cur.length > best.length) best = cur;
  return best;
}

export function evaluateLongTone(frames: Frame[], target: number, seconds: number, tol: Tolerances): EvalResult {
  const onTarget = (f: Frame) => f.voiced && Math.abs(writtenMidi(f) - target) < 0.5;
  const run = longestRun(frames, onTarget);
  const dur = run.length ? run[run.length - 1].t - run[0].t : 0;
  const sustain = run.filter((f) => f.t > run[0].t + 0.3 && f.t < run[run.length - 1].t - 0.2);
  const use = sustain.length > 10 ? sustain : run;
  const cents = use.map((f) => (writtenMidi(f) - target) * 100);
  const inTune = cents.filter((c) => Math.abs(c) <= tol.centsGood).length / Math.max(1, cents.length);
  const pitchStd = std(cents);
  const dbStd = std(use.map((f) => f.db));
  const clarity = mean(use.map((f) => f.clarity));
  const voicedAll = frames.filter((f) => f.voiced);
  const squeak = voicedAll.some((f) => writtenMidi(f) - target >= 11.5);
  const criteria: Criterion[] = [
    {
      id: 'duration',
      label: 'Длительность',
      score: mapUp(dur, 0, seconds * 0.95),
      weight: 0.3,
      detail: `Нота держалась ${dur.toFixed(1)} с из ${seconds} с.`,
    },
    {
      id: 'intonation',
      label: 'Интонация',
      score: cents.length ? Math.round(inTune * 100 * 0.6 + mapDown(Math.abs(mean(cents)), tol.centsPerfect, tol.centsGood * 2.5) * 0.4) : 0,
      weight: 0.25,
      detail: cents.length ? `В зоне точности ${Math.round(inTune * 100)}% времени, среднее отклонение ${Math.round(mean(cents))} центов.` : '—',
    },
    {
      id: 'stability',
      label: 'Ровность высоты',
      score: cents.length ? mapDown(pitchStd, 4, 25) : 0,
      weight: 0.2,
      detail: `Колебание высоты — ${Math.round(pitchStd)} центов.`,
    },
    {
      id: 'loudness',
      label: 'Ровность громкости',
      score: use.length ? mapDown(dbStd, 1.2, 6) : 0,
      weight: 0.15,
      detail: `Колебание громкости — ${dbStd.toFixed(1)} дБ.`,
    },
    {
      id: 'tone',
      label: 'Звук',
      score: Math.max(0, mapUp(clarity, 0.75, 0.9) - (squeak ? 25 : 0)),
      weight: 0.1,
      detail: squeak ? 'Был «кикс» — звук сорвался вверх.' : clarity > 0.85 ? 'Звук плотный и чистый.' : 'Звук немного «воздушный».',
    },
  ];
  const tips: string[] = [];
  if (dur < seconds * 0.8) tips.push('Возьмите полный вдох животом и расходуйте воздух экономно — ровной тонкой струёй.');
  if (pitchStd > 12) tips.push('Высота «плавает». Держите амбушюр неподвижным и подавайте воздух ровно, без толчков.');
  if (dbStd > 3) tips.push('Громкость колеблется. Представьте, что ведёте ровную линию: одинаковое давление воздуха от начала до конца.');
  const itp = cents.length ? intonationTip(mean(cents), tol) : null;
  if (itp) tips.push(itp);
  if (clarity < 0.82) tips.push('В звуке много воздуха. Плотнее обхватите мундштук уголками губ и направьте струю воздуха в инструмент, а не мимо.');
  return finalize(criteria, tol, {
    durationSec: seconds,
    tips,
    metrics: {
      target: noteNameRu(target),
      heldSec: round1(dur),
      meanCents: round1(mean(cents)),
      pitchStdCents: round1(pitchStd),
      loudnessStdDb: round1(dbStd),
      clarity: round1(clarity * 100),
      squeak,
    },
  });
}

/** Averages several results (e.g. a long tone on several notes). */
export function mergeResults(results: EvalResult[], tol: Tolerances): EvalResult {
  if (results.length === 1) return results[0];
  const byId = new Map<string, Criterion[]>();
  for (const r of results) for (const c of r.criteria) byId.set(c.id, [...(byId.get(c.id) ?? []), c]);
  const criteria: Criterion[] = [...byId.values()].map((cs) => ({
    ...cs[0],
    score: Math.round(mean(cs.map((c) => c.score))),
    detail: cs.map((c) => c.detail).join(' / '),
  }));
  const tips = [...new Set(results.flatMap((r) => r.tips))].slice(0, 4);
  const metrics: EvalResult['metrics'] = {};
  results.forEach((r, i) => Object.entries(r.metrics).forEach(([k, v]) => (metrics[`${k}_${i + 1}`] = v)));
  return finalize(criteria, tol, { durationSec: results.reduce((a, r) => a + r.durationSec, 0), tips, metrics });
}

// ---------------------------------------------------------------------------
// Breath (exhale on "ссс")
// ---------------------------------------------------------------------------

export function evaluateBreath(frames: Frame[], seconds: number, noiseFloorDb: number, tol: Tolerances): EvalResult {
  const thr = Math.max(noiseFloorDb + 8, -62);
  const isHiss = (f: Frame) => f.db > thr && (!f.voiced || f.flatness > 0.2);
  const run = longestRun(frames, isHiss, 0.15);
  const dur = run.length ? run[run.length - 1].t - run[0].t : 0;
  const mid = run.filter((f) => f.t > run[0].t + 0.5 && f.t < run[run.length - 1].t - 0.5);
  const dbStd = std((mid.length > 10 ? mid : run).map((f) => f.db));
  const criteria: Criterion[] = [
    { id: 'breath', label: 'Длина выдоха', score: mapUp(dur, 0, seconds * 0.95), weight: 0.7, detail: `Выдох длился ${dur.toFixed(1)} с из ${seconds} с.` },
    { id: 'loudness', label: 'Ровность выдоха', score: run.length ? mapDown(dbStd, 1.5, 7) : 0, weight: 0.3, detail: `Колебание силы выдоха — ${dbStd.toFixed(1)} дБ.` },
  ];
  const tips: string[] = [];
  if (dur < seconds * 0.8) tips.push('Вдыхайте глубже — животом, а не плечами. Выдыхайте узкой струёй, как будто через соломинку.');
  if (dbStd > 4) tips.push('Выдох неровный. Держите мышцы живота в тонусе и выдыхайте с постоянным давлением.');
  return finalize(criteria, tol, { durationSec: seconds, tips, metrics: { exhaleSec: round1(dur), loudnessStdDb: round1(dbStd) } });
}

// ---------------------------------------------------------------------------
// Mouthpiece / neck pitch
// ---------------------------------------------------------------------------

export const MOUTHPIECE_TARGET = { mouthpiece: 81, neck: 68 } as const; // concert A5 / A♭4

export function evaluateMouthpiece(frames: Frame[], part: 'mouthpiece' | 'neck', seconds: number, tol: Tolerances): EvalResult {
  const target = MOUTHPIECE_TARGET[part];
  const voiced = frames.filter((f) => f.voiced);
  const near = (f: Frame) => f.voiced && Math.abs(f.midi - target) <= 1.5;
  const run = longestRun(frames, near, 0.1);
  const dur = run.length ? run[run.length - 1].t - run[0].t : 0;
  const cents = run.map((f) => (f.midi - target) * 100);
  const inZone = cents.filter((c) => Math.abs(c) <= 60).length / Math.max(1, cents.length);
  const m = mean(cents);
  const criteria: Criterion[] = [
    {
      id: 'zone',
      label: 'Высота звука',
      score: run.length ? Math.round(inZone * 100 * 0.5 + mapDown(Math.abs(m), 30, 150) * 0.5) : 0,
      weight: 0.5,
      detail: run.length ? `Среднее отклонение от цели — ${Math.round(m)} центов.` : 'Звук около целевой высоты не найден.',
    },
    { id: 'duration', label: 'Длительность', score: mapUp(dur, 0, seconds * 0.9), weight: 0.25, detail: `Звук держался ${dur.toFixed(1)} с.` },
    { id: 'stability', label: 'Ровность', score: run.length ? mapDown(std(cents), 8, 45) : 0, weight: 0.25, detail: `Колебание — ${Math.round(std(cents))} центов.` },
  ];
  const tips: string[] = [];
  const allMean = voiced.length ? median(voiced.map((f) => f.midi)) : NaN;
  if (!run.length && voiced.length) {
    if (allMean < target) tips.push('Звук заметно ниже цели: амбушюр слишком расслаблен или мало воздуха. Подтяните уголки губ и дуйте увереннее.');
    else tips.push('Звук выше цели: вы слишком сильно зажимаете мундштук. Расслабьте челюсть.');
  } else if (m < -40) tips.push('Звук чуть ниже цели — добавьте опору дыхания и немного плотнее обхватите мундштук.');
  else if (m > 40) tips.push('Звук чуть выше цели — ослабьте давление нижней губы.');
  return finalize(criteria, tol, { durationSec: seconds, tips, metrics: { part, targetHz: part === 'mouthpiece' ? 880 : 415, meanCents: round1(m), heldSec: round1(dur) } });
}

// ---------------------------------------------------------------------------
// Dynamics on a long tone
// ---------------------------------------------------------------------------

function linfit(xs: number[], ys: number[]) {
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  let tot = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den ? num / den : 0;
  let res = 0;
  for (let i = 0; i < xs.length; i++) {
    res += (ys[i] - (my + slope * (xs[i] - mx))) ** 2;
    tot += (ys[i] - my) ** 2;
  }
  return { slope, r2: tot ? 1 - res / tot : 0 };
}

export function evaluateDynamics(frames: Frame[], note: number, shape: 'cresc' | 'dim' | 'messa', seconds: number, tol: Tolerances): EvalResult {
  const run = longestRun(frames, (f) => f.voiced && Math.abs(writtenMidi(f) - note) < 0.5, 0.1);
  const dur = run.length ? run[run.length - 1].t - run[0].t : 0;
  const core = run.filter((f) => f.t > run[0].t + 0.15 && f.t < run[run.length - 1].t - 0.15);
  const use = core.length > 10 ? core : run;
  const t0 = use[0]?.t ?? 0;
  const xs = use.map((f) => f.t - t0);
  const ys = use.map((f) => f.db);
  let shapeScore = 0;
  let smooth = 0;
  let detail = '';
  if (use.length > 10) {
    if (shape === 'messa') {
      const peakIdx = ys.indexOf(Math.max(...ys));
      const rel = peakIdx / ys.length;
      const rise = Math.max(...ys) - mean(ys.slice(0, 5));
      const fall = Math.max(...ys) - mean(ys.slice(-5));
      shapeScore = Math.round(0.4 * mapRange(rel, 0.3, 0.7, 0.3) + 0.3 * mapUp(rise, 0, 8) + 0.3 * mapUp(fall, 0, 8));
      const a = linfit(xs.slice(0, peakIdx + 1), ys.slice(0, peakIdx + 1));
      const b = linfit(xs.slice(peakIdx), ys.slice(peakIdx));
      smooth = mapUp((a.r2 + b.r2) / 2, 0.2, 0.7);
      detail = `Нарастание ${rise.toFixed(1)} дБ, спад ${fall.toFixed(1)} дБ.`;
    } else {
      const fit = linfit(xs, ys);
      const change = (mean(ys.slice(-6)) - mean(ys.slice(0, 6))) * (shape === 'cresc' ? 1 : -1);
      shapeScore = mapUp(change, 0, 9);
      smooth = mapUp(fit.r2, 0.2, 0.75);
      detail = `${shape === 'cresc' ? 'Нарастание' : 'Затихание'} — ${change.toFixed(1)} дБ.`;
    }
  }
  const cents = use.map((f) => (writtenMidi(f) - note) * 100);
  const drift = cents.length > 12 ? Math.abs(mean(cents.slice(-6)) - mean(cents.slice(0, 6))) : 99;
  const criteria: Criterion[] = [
    { id: 'dynamics', label: 'Изменение громкости', score: shapeScore, weight: 0.45, detail: detail || 'Нота не найдена.' },
    { id: 'loudness', label: 'Плавность', score: smooth, weight: 0.2, detail: 'Насколько равномерно меняется громкость.' },
    { id: 'stability', label: 'Высота не «уезжает»', score: mapDown(drift, 8, 40), weight: 0.25, detail: `Высота сместилась на ${Math.round(drift)} центов.` },
    { id: 'duration', label: 'Длительность', score: mapUp(dur, 0, seconds * 0.9), weight: 0.1, detail: `Нота длилась ${dur.toFixed(1)} с.` },
  ];
  const tips: string[] = [];
  if (shapeScore < 60) tips.push('Сделайте разницу громкости заметнее: начинайте совсем тихо (p) и доходите до уверенного f.');
  if (drift > 20) tips.push('При изменении громкости высота «уезжает». На тихом звуке не зажимайте губы, на громком — не ослабляйте амбушюр.');
  return finalize(criteria, tol, { durationSec: seconds, tips, metrics: { shape, pitchDriftCents: Math.round(drift), heldSec: round1(dur) } });
}

// ---------------------------------------------------------------------------
// Vibrato
// ---------------------------------------------------------------------------

export function vibratoStats(frames: Frame[], note: number) {
  const run = longestRun(frames, (f) => f.voiced && Math.abs(writtenMidi(f) - note) < 0.7, 0.08);
  const core = run.filter((f) => f.t > (run[0]?.t ?? 0) + 0.3);
  if (core.length < 30) return null;
  const cents = core.map((f) => (writtenMidi(f) - note) * 100);
  // detrend with a moving average of ~0.4 s
  const dt = core.length > 1 ? (core[core.length - 1].t - core[0].t) / (core.length - 1) : 0.01;
  const win = Math.max(3, Math.round(0.4 / dt));
  const det = cents.map((c, i) => {
    const s = Math.max(0, i - (win >> 1));
    const e = Math.min(cents.length, i + (win >> 1) + 1);
    let m = 0;
    for (let k = s; k < e; k++) m += cents[k];
    return c - m / (e - s);
  });
  // zero crossings (upward)
  const ups: number[] = [];
  for (let i = 1; i < det.length; i++) if (det[i - 1] < 0 && det[i] >= 0) ups.push(core[i].t);
  const periods = ups.slice(1).map((t, i) => t - ups[i]);
  const rate = periods.length ? 1 / mean(periods) : 0;
  const regularity = periods.length > 2 ? Math.max(0, 1 - std(periods) / mean(periods)) : 0;
  // peak-to-peak depth per cycle
  const depths: number[] = [];
  for (let k = 1; k < ups.length; k++) {
    const seg = det.filter((_, i) => core[i].t >= ups[k - 1] && core[i].t < ups[k]);
    if (seg.length) depths.push(Math.max(...seg) - Math.min(...seg));
  }
  return { rate, depth: depths.length ? median(depths) : 0, regularity, centre: mean(cents), seconds: core[core.length - 1].t - core[0].t };
}

export function evaluateVibrato(
  frames: Frame[],
  note: number,
  seconds: number,
  rate: [number, number],
  depth: [number, number],
  tol: Tolerances,
): EvalResult {
  const s = vibratoStats(frames, note);
  const criteria: Criterion[] = s
    ? [
        { id: 'vibratoRate', label: 'Скорость вибрато', score: mapRange(s.rate, rate[0], rate[1], 2.5), weight: 0.3, detail: `${s.rate.toFixed(1)} колебаний в секунду (цель ${rate[0]}–${rate[1]}).` },
        { id: 'vibratoDepth', label: 'Глубина вибрато', score: mapRange(s.depth, depth[0], depth[1], 30), weight: 0.3, detail: `Размах ${Math.round(s.depth)} центов (цель ${depth[0]}–${depth[1]}).` },
        { id: 'vibratoEven', label: 'Равномерность', score: mapUp(s.regularity, 0.4, 0.85), weight: 0.25, detail: `Равномерность ${Math.round(s.regularity * 100)}%.` },
        { id: 'intonation', label: 'Центр высоты', score: mapDown(Math.abs(s.centre), tol.centsPerfect, tol.centsGood * 2.5), weight: 0.15, detail: `Центр колебаний смещён на ${Math.round(s.centre)} центов.` },
      ]
    : [{ id: 'vibratoRate', label: 'Вибрато', score: 0, weight: 1, detail: 'Не удалось найти длинную ноту с вибрато.' }];
  const tips: string[] = [];
  if (s) {
    if (s.rate < rate[0]) tips.push('Вибрато слишком медленное. Двигайте челюстью чаще: начните с метронома — 4 колебания на удар при 72.');
    if (s.rate > rate[1]) tips.push('Вибрато слишком быстрое и «дрожащее». Замедлите движение челюсти, сделайте его шире и спокойнее.');
    if (s.depth < depth[0]) tips.push('Вибрато едва заметно. Сделайте движение челюсти (как на слог «я-я-я») чуть больше.');
    if (s.depth > depth[1]) tips.push('Вибрато слишком широкое — звук «качается». Уменьшите амплитуду движения челюсти.');
    if (s.regularity < 0.6) tips.push('Колебания неравномерные. Тренируйте вибрато под метроном, считая волны.');
  }
  return finalize(criteria, tol, {
    durationSec: seconds,
    tips,
    metrics: s ? { rateHz: round1(s.rate), depthCents: Math.round(s.depth), regularity: Math.round(s.regularity * 100), centreCents: Math.round(s.centre) } : { found: false },
  });
}

// ---------------------------------------------------------------------------
// Echo (call and response)
// ---------------------------------------------------------------------------

export interface EchoPhraseInput {
  expected: ScoreNote[];
  bpm: number;
  detected: DetectedNote[];
}

/** Edit-distance alignment of pitch sequences (no timing). */
export function alignSequence(a: number[], b: number[]) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j * 0.5 : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const sub = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 0.5, dp[i - 1][j - 1] + sub);
    }
  const pairs: [number, number][] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const sub = a[i - 1] === b[j - 1] ? 0 : 1;
    if (dp[i][j] === dp[i - 1][j - 1] + sub) {
      pairs.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i][j] === dp[i - 1][j] + 1) i--;
    else j--;
  }
  return pairs;
}

export function evaluateEcho(phrases: EchoPhraseInput[], tol: Tolerances): EvalResult {
  const pitchScores: number[] = [];
  const rhythmScores: number[] = [];
  const noteResults: NoteResult[] = [];
  let idx = 0;
  for (const p of phrases) {
    const exp = p.expected.map((x) => x.midi);
    const det = p.detected.map((d) => concertToWritten(d.midi));
    const pairs = alignSequence(exp, det);
    const correct = pairs.filter(([i, j]) => exp[i] === det[j]);
    pitchScores.push((100 * correct.length) / Math.max(1, exp.length));
    // rhythm: compare inter-onset intervals of consecutive correct pairs
    const spb = 60 / p.bpm;
    const ratios: number[] = [];
    for (let k = 1; k < correct.length; k++) {
      const [i0, j0] = correct[k - 1];
      const [i1, j1] = correct[k];
      const e = (p.expected[i1].beat - p.expected[i0].beat) * spb;
      const d = p.detected[j1].start - p.detected[j0].start;
      if (e > 0 && d > 0) ratios.push(Math.abs(Math.log2(d / e)));
    }
    rhythmScores.push(ratios.length ? mapDown(mean(ratios), 0.12, 0.8) : correct.length ? 70 : 0);
    exp.forEach((m, i) => {
      const pr = pairs.find(([a]) => a === i);
      const played = pr ? det[pr[1]] : undefined;
      noteResults.push({ i: idx++, expected: m, played, judgment: played === undefined ? 'miss' : played === m ? 'good' : 'wrong' });
    });
  }
  const criteria: Criterion[] = [
    { id: 'ear', label: 'Слух (ноты)', score: Math.round(mean(pitchScores)), weight: 0.7, detail: `Верно повторено ${Math.round(mean(pitchScores))}% нот.` },
    { id: 'rhythm', label: 'Ритм фразы', score: Math.round(mean(rhythmScores)), weight: 0.3, detail: 'Насколько похож ритм вашей фразы на образец.' },
  ];
  const tips: string[] = [];
  if (mean(pitchScores) < 70) tips.push('Перед тем как играть, пропойте фразу про себя. Найдите первую ноту — остальные строятся от неё.');
  if (mean(rhythmScores) < 70) tips.push('Повторяйте не только ноты, но и ритм: длинные ноты держите длинными, короткие — короткими.');
  const { points, maxCombo } = arcade(noteResults.map((r) => r.judgment));
  return finalize(criteria, tol, {
    durationSec: 0,
    tips,
    notes: noteResults,
    points,
    maxCombo,
    metrics: { phrases: phrases.length, earPercent: Math.round(mean(pitchScores)), rhythmPercent: Math.round(mean(rhythmScores)) },
  });
}

// ---------------------------------------------------------------------------
// Improvisation
// ---------------------------------------------------------------------------

export interface ImprovEvalOptions {
  t0: number;
  bpm: number;
  beatsPerBar: number;
  bars: number;
  /** Chord chart (written key) per bar; loops. */
  chords: string[][];
  scale: { root: number; type: ScaleType };
  swing?: boolean;
  latency: number;
}

export function evaluateImprov(frames: Frame[], o: ImprovEvalOptions, tol: Tolerances): EvalResult {
  const spb = 60 / o.bpm;
  const totalBeats = o.bars * o.beatsPerBar;
  const end = o.t0 + totalBeats * spb;
  const relevant = frames.filter((f) => f.t - o.latency >= o.t0 - 0.2 && f.t - o.latency <= end + 0.5);
  const notes = segmentNotes(relevant).map((d) => ({ ...d, w: concertToWritten(d.midi), t: d.start - o.latency, dur: d.end - d.start }));
  const scaleSet = scalePcs(o.scale.root % 12, o.scale.type);
  let durAll = 0;
  let durIn = 0;
  let strong = 0;
  let strongChord = 0;
  let onGrid = 0;
  const cents: number[] = [];
  for (const nt of notes) {
    const pc = ((nt.w % 12) + 12) % 12;
    durAll += nt.dur;
    const beat = (nt.t - o.t0) / spb;
    const bar = Math.max(0, Math.floor(beat / o.beatsPerBar));
    const barChords = o.chords.length ? o.chords[bar % o.chords.length] : [];
    const inBar = beat - bar * o.beatsPerBar;
    const chordSym = barChords.length ? barChords[Math.min(barChords.length - 1, Math.floor(inBar / (o.beatsPerBar / barChords.length)))] : null;
    const chordSet = chordSym ? chordPcs(parseChord(chordSym)) : new Set<number>();
    if (scaleSet.has(pc) || chordSet.has(pc)) durIn += nt.dur;
    const frac = inBar - Math.floor(inBar);
    if ((Math.floor(inBar) === 0 || Math.floor(inBar) === 2) && (frac < 0.15 || frac > 0.85)) {
      strong++;
      if (chordSet.has(pc)) strongChord++;
    }
    // grid: eighths (straight or swing)
    const grid = o.swing ? [0, 2 / 3, 1] : [0, 0.5, 1];
    const g = Math.min(...grid.map((x) => Math.abs(frac - x)));
    if (g * spb < Math.max(0.06, tol.timingGood * 0.8)) onGrid++;
    if (nt.dur > 0.2) cents.push(nt.cents);
  }
  const playing = Math.min(1, durAll / Math.max(1, totalBeats * spb));
  const distinct = new Set(notes.map((n) => ((n.w % 12) + 12) % 12)).size;
  const range = notes.length ? Math.max(...notes.map((n) => n.w)) - Math.min(...notes.map((n) => n.w)) : 0;
  const intervals = notes.slice(1).map((n, i) => Math.abs(n.w - notes[i].w));
  const leaps = intervals.filter((x) => x >= 3).length / Math.max(1, intervals.length);
  const adherence = durAll ? durIn / durAll : 0;
  const criteria: Criterion[] = [
    { id: 'scale', label: 'Ноты гаммы и аккорда', score: notes.length ? mapUp(adherence, 0.55, 0.9) : 0, weight: 0.3, detail: `${Math.round(adherence * 100)}% звучания — ноты гаммы или аккорда.` },
    { id: 'rhythm', label: 'Ритмичность', score: notes.length ? mapUp(onGrid / notes.length, 0.3, 0.75) : 0, weight: 0.2, detail: `${Math.round((100 * onGrid) / Math.max(1, notes.length))}% нот попадают в сетку восьмых.` },
    { id: 'space', label: 'Фразировка и паузы', score: notes.length ? mapRange(playing, 0.35, 0.8, 0.3) : 0, weight: 0.15, detail: `Вы играли ${Math.round(playing * 100)}% времени (паузы между фразами — это хорошо).` },
    {
      id: 'variety',
      label: 'Разнообразие',
      score: notes.length ? Math.round(0.4 * mapUp(distinct, 2, 5) + 0.3 * mapUp(range, 2, 9) + 0.3 * mapRange(leaps, 0.15, 0.5, 0.2)) : 0,
      weight: 0.15,
      detail: `Разных нот: ${distinct}, диапазон: ${range} полутонов, скачков: ${Math.round(leaps * 100)}%.`,
    },
    { id: 'chordTones', label: 'Аккордовые звуки на сильных долях', score: strong ? mapUp(strongChord / strong, 0.2, 0.7) : 50, weight: 0.1, detail: strong ? `${strongChord} из ${strong} нот на сильных долях — звуки аккорда.` : 'На сильных долях нот почти не было.' },
    { id: 'intonation', label: 'Интонация', score: cents.length ? mapDown(mean(cents.map(Math.abs)), tol.centsPerfect, tol.centsGood * 2.5) : 0, weight: 0.1, detail: cents.length ? `Среднее отклонение ${Math.round(mean(cents.map(Math.abs)))} центов.` : '—' },
  ];
  const tips: string[] = [];
  if (!notes.length) tips.push('Мы не услышали игры. Проверьте микрофон и начните играть после отсчёта.');
  if (adherence < 0.75 && notes.length) tips.push('Много «чужих» нот. Начните с 3–4 нот гаммы и играйте только их — свобода приходит позже.');
  if (playing > 0.85) tips.push('Вы играете почти без пауз. Делайте фразы короче и «дышите»: вопрос — пауза — ответ.');
  if (playing < 0.3 && notes.length) tips.push('Играйте смелее: попробуйте заполнить хотя бы половину времени короткими мотивами.');
  if (distinct < 3 && notes.length) tips.push('Добавьте разнообразия: используйте больше нот гаммы и разные ритмы.');
  return finalize(
    criteria,
    tol,
    {
      durationSec: totalBeats * spb,
      tips,
      metrics: {
        notesPlayed: notes.length,
        scaleAdherence: Math.round(adherence * 100),
        playingPercent: Math.round(playing * 100),
        distinctNotes: distinct,
        rangeSemitones: range,
        leapsPercent: Math.round(leaps * 100),
        onGridPercent: Math.round((100 * onGrid) / Math.max(1, notes.length)),
        strongBeatChordTones: `${strongChord}/${strong}`,
      },
    },
    Math.min(tol.passScore, 70),
  );
}
