// Helpers to write course content compactly.
import { buildAbc, type BuildNote } from '../music/abc';
import { n } from '../music/notes';
import { scaleNotes, type ScaleType } from '../music/theory';
import type {
  BreathExercise,
  DynamicsExercise,
  EchoExercise,
  ImprovExercise,
  LongToneExercise,
  MouthpieceExercise,
  NotesExercise,
  SequenceExercise,
  Tier,
  VibratoExercise,
} from '../practice/types';

export { n };

/** Full ABC tune from a body. */
export function abc(body: string, o: { key?: string; meter?: string; bpm?: number; L?: string; title?: string } = {}) {
  return [
    'X:1',
    o.title ? `T:${o.title}` : null,
    `M:${o.meter ?? '4/4'}`,
    `L:${o.L ?? '1/4'}`,
    `Q:1/4=${o.bpm ?? 80}`,
    `K:${o.key ?? 'C'}`,
    body.trim(),
  ]
    .filter(Boolean)
    .join('\n');
}

type SeqOpts = Partial<Omit<SequenceExercise, 'id' | 'title' | 'kind' | 'abc' | 'goal'>> & { goal?: string };

export function seq(id: string, title: string, abcText: string, o: SeqOpts = {}): SequenceExercise {
  return {
    id,
    title,
    kind: 'sequence',
    abc: abcText,
    goal: o.goal ?? 'Сыграйте ноты в темпе вместе с метрономом.',
    modes: o.modes ?? ['tempo', 'wait'],
    metronome: o.metronome ?? true,
    showNames: o.showNames ?? true,
    ...o,
  };
}

export function notesDrill(id: string, title: string, pool: number[], o: Partial<NotesExercise> = {}): NotesExercise {
  return { id, title, kind: 'notes', pool, count: o.count ?? 8, show: o.show ?? 'mixed', goal: o.goal ?? 'Найдите и сыграйте показанную ноту.', ...o };
}

export function longtone(id: string, title: string, notes: number[], seconds: number, o: Partial<LongToneExercise> = {}): LongToneExercise {
  return {
    id,
    title,
    kind: 'longtone',
    notes,
    seconds,
    goal: o.goal ?? `Тяните каждую ноту ${seconds} секунд — ровно по высоте и громкости.`,
    ...o,
  };
}

export function breath(id: string, title: string, seconds: number, o: Partial<BreathExercise> = {}): BreathExercise {
  return { id, title, kind: 'breath', seconds, goal: o.goal ?? `Вдохните животом и выдыхайте на «ссс» ${seconds} секунд — ровно и без рывков.`, ...o };
}

export function mouthpiece(id: string, title: string, part: 'mouthpiece' | 'neck', seconds: number, o: Partial<MouthpieceExercise> = {}): MouthpieceExercise {
  return {
    id,
    title,
    kind: 'mouthpiece',
    part,
    seconds,
    goal:
      o.goal ??
      (part === 'mouthpiece'
        ? `Сыграйте на одном мундштуке ровный звук ${seconds} секунды. Цель — «ля» (880 Гц).`
        : `Сыграйте на мундштуке с эской ровный звук ${seconds} секунды. Цель — «соль-диез» (415 Гц).`),
    ...o,
  };
}

export function dynamics(id: string, title: string, note: number, shape: DynamicsExercise['shape'], seconds: number, o: Partial<DynamicsExercise> = {}): DynamicsExercise {
  const g = shape === 'cresc' ? 'от тихого (p) к громкому (f)' : shape === 'dim' ? 'от громкого (f) к тихому (p)' : 'тихо → громко → тихо';
  return { id, title, kind: 'dynamics', note, shape, seconds, goal: o.goal ?? `Тяните ноту ${seconds} секунд, плавно меняя громкость ${g}.`, ...o };
}

export function vibrato(id: string, title: string, note: number, seconds: number, o: Partial<VibratoExercise> = {}): VibratoExercise {
  return {
    id,
    title,
    kind: 'vibrato',
    note,
    seconds,
    rate: o.rate ?? [4.5, 6.5],
    depth: o.depth ?? [18, 60],
    goal: o.goal ?? `Тяните ноту ${seconds} секунд с ровным вибрато (примерно 5 волн в секунду).`,
    ...o,
  };
}

export function echo(id: string, title: string, phrases: string[], bpm: number, o: Partial<EchoExercise> = {}): EchoExercise {
  return { id, title, kind: 'echo', phrases, bpm, goal: o.goal ?? 'Послушайте фразу и повторите её по слуху.', ...o };
}

export function improv(id: string, title: string, o: Omit<ImprovExercise, 'id' | 'title' | 'kind' | 'goal'> & { goal?: string }): ImprovExercise {
  return { id, title, kind: 'improv', goal: o.goal ?? 'Импровизируйте под аккомпанемент, используя ноты гаммы.', ...o };
}

/** Scale exercise as ABC (up and down), written pitch. */
export function scaleAbc(root: number, type: ScaleType, o: { key?: string; octaves?: number; beats?: number; bpm?: number; down?: boolean; slur?: boolean } = {}) {
  const up = scaleNotes(root, type, o.octaves ?? 1);
  const notes = o.down === false ? up : [...up, ...up.slice(0, -1).reverse()];
  const beats = o.beats ?? 1;
  const list: BuildNote[] = notes.map((m, i) => ({ midi: m, beats, slurStart: o.slur && i === 0, slurEnd: o.slur && i === notes.length - 1 }));
  // round the last note up to fill the bar nicely
  list[list.length - 1].beats = Math.max(beats, 2);
  return buildAbc(list, { key: o.key ?? 'C', bpm: o.bpm ?? 80 });
}

export function tier(t: Tier) {
  return t;
}
