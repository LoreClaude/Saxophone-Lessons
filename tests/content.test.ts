import { describe, expect, it } from 'vitest';
import { COURSE } from '../src/content/course';
import { parseScore } from '../src/music/abc';
import { parseChord, parseChordChart, SCALES } from '../src/music/theory';
import { SAX_HIGH, SAX_LOW } from '../src/music/notes';
import { fingeringsFor } from '../src/music/fingering';
import type { Exercise } from '../src/practice/types';
import type { Demo, QuizQuestion, TheoryBlock } from '../src/content/types';

const inRange = (m: number) => m >= SAX_LOW && m <= SAX_HIGH;

function checkAbc(abc: string, where: string) {
  const s = parseScore(abc);
  expect(s.notes.length, `${where}: no notes`).toBeGreaterThan(0);
  for (const nt of s.notes) expect(inRange(nt.midi), `${where}: note ${nt.midi} out of alto range`).toBe(true);
  return s;
}

function checkChart(chart: string, where: string) {
  const bars = parseChordChart(chart);
  expect(bars.length, `${where}: empty chord chart`).toBeGreaterThan(0);
  bars.flat().forEach((c) => expect(() => parseChord(c), `${where}: bad chord ${c}`).not.toThrow());
}

function checkDemo(d: Demo, where: string) {
  if (d.kind === 'abc') {
    checkAbc(d.abc, where);
    if (d.chords) checkChart(d.chords, where);
  }
  if (d.kind === 'backing') checkChart(d.chords, where);
  if (d.kind === 'note') expect(inRange(d.note), `${where}: demo note`).toBe(true);
}

function checkExercise(e: Exercise, where: string) {
  const w = `${where}/${e.id}`;
  expect(e.title.length).toBeGreaterThan(2);
  expect(e.goal.length).toBeGreaterThan(5);
  switch (e.kind) {
    case 'sequence': {
      checkAbc(e.abc, w);
      if (e.style && e.style !== 'none') expect(e.chords, `${w}: style without chords`).toBeTruthy();
      if (e.chords) checkChart(e.chords, w);
      break;
    }
    case 'echo':
      e.phrases.forEach((p, i) => checkAbc(p, `${w}#${i}`));
      break;
    case 'notes':
      expect(e.pool.length).toBeGreaterThan(0);
      e.pool.forEach((m) => {
        expect(inRange(m), `${w}: pool note ${m}`).toBe(true);
        expect(fingeringsFor(m).length).toBeGreaterThan(0);
      });
      break;
    case 'longtone':
      e.notes.forEach((m) => expect(inRange(m), `${w}: ${m}`).toBe(true));
      break;
    case 'dynamics':
    case 'vibrato':
      expect(inRange(e.note), w).toBe(true);
      break;
    case 'improv':
      checkChart(e.chords, w);
      expect(SCALES[e.scale.type], w).toBeTruthy();
      expect(e.bars).toBeGreaterThanOrEqual(4);
      break;
    default:
      break;
  }
}

function checkQuiz(q: QuizQuestion, where: string) {
  if (q.type === 'mcq') {
    expect(q.answer, where).toBeGreaterThanOrEqual(0);
    expect(q.answer, where).toBeLessThan(q.options.length);
  }
  if (q.type === 'noteName' || q.type === 'fingeringName') q.notes.forEach((m) => expect(inRange(m), where).toBe(true));
}

function checkBlock(b: TheoryBlock, where: string) {
  if (b.type === 'abc') checkAbc(b.abc, where);
  if (b.type === 'fingering') b.notes.forEach((m) => expect(fingeringsFor(m).length, where).toBeGreaterThan(0));
  if (b.type === 'listen') checkDemo(b.demo, where);
  if (b.type === 'compare') b.items.forEach((it) => checkDemo(it.demo, where));
}

describe('course content', () => {
  it('has twelve modules with unique ids', () => {
    expect(COURSE.length).toBe(12);
    const ids = COURSE.flatMap((m) => m.lessons.map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(50);
  });

  for (const m of COURSE) {
    describe(m.title, () => {
      for (const l of m.lessons) {
        it(`lesson ${l.id} «${l.title}» is valid`, () => {
          const exIds = l.exercises.map((e) => e.id);
          expect(new Set(exIds).size, 'duplicate exercise ids').toBe(exIds.length);
          expect(l.exercises.filter((e) => !e.optional).length, 'lesson needs a required exercise').toBeGreaterThan(0);
          l.blocks.forEach((b, i) => checkBlock(b, `${l.id}/block${i}`));
          l.exercises.forEach((e) => checkExercise(e, l.id));
          l.quiz?.forEach((q, i) => checkQuiz(q, `${l.id}/quiz${i}`));
        });
      }
      it(`exam of ${m.id} is valid`, () => {
        const ids = m.exam.exercises.map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
        m.exam.exercises.forEach((e) => checkExercise(e, `${m.id}/exam`));
        m.exam.quiz?.forEach((q, i) => checkQuiz(q, `${m.id}/examquiz${i}`));
      });
    });
  }
});

import { BONUS_PIECES, THEME_REWARDS, REWARDS, rewardsBetween } from '../src/content/rewards';
import { THEMES } from '../src/styles/themes';

describe('level rewards', () => {
  it('have unique ids and valid levels', () => {
    const ids = REWARDS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    REWARDS.forEach((r) => expect(r.level).toBeGreaterThanOrEqual(2));
  });
  for (const p of BONUS_PIECES) {
    it(`bonus melody «${p.title}» is playable`, () => {
      const s = checkAbc(p.abc, `bonus/${p.id}`);
      if (p.style && p.style !== 'none') {
        expect(p.chords, 'style without chords').toBeTruthy();
        checkChart(p.chords!, `bonus/${p.id}`);
        const bars = parseChordChart(p.chords!).length;
        expect(bars * s.beatsPerBar, `bonus/${p.id}: chord chart shorter than the tune`).toBeGreaterThanOrEqual(s.totalBeats);
      }
    });
  }
  it('reward themes exist and unlock at their level', () => {
    for (const t of THEME_REWARDS) expect(THEMES[t.theme].unlockLevel).toBe(t.level);
  });
  it('lists rewards gained between two levels', () => {
    expect(rewardsBetween(1, 2).map((r) => r.id)).toEqual(['lullaby']);
    expect(rewardsBetween(9, 10).length).toBe(2);
  });
});
