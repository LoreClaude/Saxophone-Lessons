// Alto saxophone fingerings for written notes B♭3 … F♯6.
// The same fingerings are used on all saxophones (soprano, tenor, baritone).

export type SaxKey =
  | 'oct'
  | 'frontF'
  | 'palmD'
  | 'palmEb'
  | 'palmF'
  | 'B'
  | 'bis'
  | 'A'
  | 'G'
  | 'Gs'
  | 'lowCs'
  | 'lowB'
  | 'lowBb'
  | 'sideE'
  | 'sideC'
  | 'sideBb'
  | 'highFs'
  | 'F'
  | 'E'
  | 'D'
  | 'lowEb'
  | 'lowC';

export interface KeyInfo {
  id: SaxKey;
  label: string; // short label on the diagram
  name: string; // human name
  finger: string; // which finger presses it
  hand: 'L' | 'R';
}

export const KEYS: Record<SaxKey, KeyInfo> = {
  oct: { id: 'oct', label: '8', name: 'Октавный клапан', finger: 'большой палец левой руки', hand: 'L' },
  frontF: { id: 'frontF', label: 'Ф', name: 'Передний клапан фа', finger: 'указательный левой руки (основание)', hand: 'L' },
  palmD: { id: 'palmD', label: 'Ре', name: 'Ладонный клапан ре', finger: 'ладонь левой руки', hand: 'L' },
  palmEb: { id: 'palmEb', label: 'Ми♭', name: 'Ладонный клапан ми-бемоль', finger: 'ладонь левой руки', hand: 'L' },
  palmF: { id: 'palmF', label: 'Фа', name: 'Ладонный клапан фа', finger: 'ладонь левой руки', hand: 'L' },
  B: { id: 'B', label: '1', name: 'Клапан си (1)', finger: 'указательный левой руки', hand: 'L' },
  bis: { id: 'bis', label: 'бис', name: 'Клапан бис (си-бемоль)', finger: 'указательный левой руки', hand: 'L' },
  A: { id: 'A', label: '2', name: 'Клапан ля (2)', finger: 'средний левой руки', hand: 'L' },
  G: { id: 'G', label: '3', name: 'Клапан соль (3)', finger: 'безымянный левой руки', hand: 'L' },
  Gs: { id: 'Gs', label: 'Соль♯', name: 'Клапан соль-диез', finger: 'мизинец левой руки', hand: 'L' },
  lowCs: { id: 'lowCs', label: 'До♯', name: 'Нижний до-диез', finger: 'мизинец левой руки', hand: 'L' },
  lowB: { id: 'lowB', label: 'Си', name: 'Нижний си', finger: 'мизинец левой руки', hand: 'L' },
  lowBb: { id: 'lowBb', label: 'Си♭', name: 'Нижний си-бемоль', finger: 'мизинец левой руки', hand: 'L' },
  sideE: { id: 'sideE', label: 'Ми', name: 'Боковой клапан высокого ми', finger: 'ребро указательного правой руки', hand: 'R' },
  sideC: { id: 'sideC', label: 'До', name: 'Боковой клапан до', finger: 'ребро указательного правой руки', hand: 'R' },
  sideBb: { id: 'sideBb', label: 'Си♭', name: 'Боковой клапан си-бемоль', finger: 'ребро указательного правой руки', hand: 'R' },
  highFs: { id: 'highFs', label: 'Фа♯', name: 'Клапан высокого фа-диез', finger: 'безымянный правой руки', hand: 'R' },
  F: { id: 'F', label: '4', name: 'Клапан фа (4)', finger: 'указательный правой руки', hand: 'R' },
  E: { id: 'E', label: '5', name: 'Клапан ми (5)', finger: 'средний правой руки', hand: 'R' },
  D: { id: 'D', label: '6', name: 'Клапан ре (6)', finger: 'безымянный правой руки', hand: 'R' },
  lowEb: { id: 'lowEb', label: 'Ми♭', name: 'Нижний ми-бемоль', finger: 'мизинец правой руки', hand: 'R' },
  lowC: { id: 'lowC', label: 'До', name: 'Нижний до', finger: 'мизинец правой руки', hand: 'R' },
};

export interface Fingering {
  keys: SaxKey[];
  /** Name of the variant, e.g. «основная», «бис», «1 + 1», «боковая». */
  variant: string;
  note?: string;
}

const LH: SaxKey[] = ['B', 'A', 'G'];
const RH: SaxKey[] = ['F', 'E', 'D'];

const F = (variant: string, keys: SaxKey[], note?: string): Fingering => ({ variant, keys, note });

/** Fingerings by written MIDI note. First entry is the main fingering. */
export const FINGERINGS: Record<number, Fingering[]> = {
  58: [F('основная', [...LH, 'lowBb', ...RH, 'lowC'])],
  59: [F('основная', [...LH, 'lowB', ...RH, 'lowC'])],
  60: [F('основная', [...LH, ...RH, 'lowC'])],
  61: [F('основная', [...LH, 'lowCs', ...RH])],
  62: [F('основная', [...LH, ...RH])],
  63: [F('основная', [...LH, ...RH, 'lowEb'])],
  64: [F('основная', [...LH, 'F', 'E'])],
  65: [F('основная', [...LH, 'F'])],
  66: [F('основная', [...LH, 'E'])],
  67: [F('основная', [...LH])],
  68: [F('основная', [...LH, 'Gs'])],
  69: [F('основная', ['B', 'A'])],
  70: [
    F('бис', ['B', 'bis'], 'Указательный палец закрывает сразу клапан си и маленький клапан бис.'),
    F('1 + 1', ['B', 'F'], 'Удобна в тональностях с бемолями и в хроматических пассажах.'),
    F('боковая', ['B', 'sideBb'], 'Удобна в хроматических пассажах и трелях.'),
  ],
  71: [F('основная', ['B'])],
  72: [F('основная', ['A']), F('боковая', ['B', 'sideC'], 'Удобна при переходах си — до — си.')],
  73: [F('основная', [], 'Все клапаны открыты — следите, чтобы звук не «плавал».')],
  74: [F('основная', ['oct', ...LH, ...RH])],
  75: [F('основная', ['oct', ...LH, ...RH, 'lowEb'])],
  76: [F('основная', ['oct', ...LH, 'F', 'E'])],
  77: [F('основная', ['oct', ...LH, 'F'])],
  78: [F('основная', ['oct', ...LH, 'E'])],
  79: [F('основная', ['oct', ...LH])],
  80: [F('основная', ['oct', ...LH, 'Gs'])],
  81: [F('основная', ['oct', 'B', 'A'])],
  82: [
    F('бис', ['oct', 'B', 'bis']),
    F('1 + 1', ['oct', 'B', 'F']),
    F('боковая', ['oct', 'B', 'sideBb']),
  ],
  83: [F('основная', ['oct', 'B'])],
  84: [F('основная', ['oct', 'A']), F('боковая', ['oct', 'B', 'sideC'])],
  85: [F('основная', ['oct'])],
  86: [F('основная', ['oct', 'palmD'])],
  87: [F('основная', ['oct', 'palmD', 'palmEb'])],
  88: [F('основная', ['oct', 'palmD', 'palmEb', 'sideE'])],
  89: [F('основная', ['oct', 'palmD', 'palmEb', 'palmF', 'sideE'])],
  90: [F('основная', ['oct', 'palmD', 'palmEb', 'palmF', 'sideE', 'highFs'])],
};

export function fingeringsFor(written: number): Fingering[] {
  return FINGERINGS[Math.round(written)] ?? [];
}

export function mainFingering(written: number): Fingering | undefined {
  return fingeringsFor(written)[0];
}

/** Extra (non main-stack) keys used by a fingering – shown as small badges. */
export function extraKeys(f: Fingering): SaxKey[] {
  const main: SaxKey[] = ['oct', 'B', 'A', 'G', 'F', 'E', 'D'];
  return f.keys.filter((k) => !main.includes(k));
}

/** Text description, e.g. «Октавный клапан + 1 2 3 | 4 5 6 + мизинец правой: До». */
export function describeFingering(f: Fingering): string {
  const parts: string[] = [];
  if (f.keys.includes('oct')) parts.push('октавный клапан');
  const l = (['B', 'A', 'G'] as SaxKey[]).filter((k) => f.keys.includes(k)).map((k) => KEYS[k].label);
  const r = (['F', 'E', 'D'] as SaxKey[]).filter((k) => f.keys.includes(k)).map((k) => KEYS[k].label);
  if (l.length) parts.push(`левая: ${l.join(' ')}`);
  if (r.length) parts.push(`правая: ${r.join(' ')}`);
  for (const k of extraKeys(f)) parts.push(KEYS[k].name.toLowerCase());
  if (!parts.length) return 'все клапаны открыты';
  return parts.join(' + ');
}
