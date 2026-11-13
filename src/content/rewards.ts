// Rewards for levelling up: bonus melodies and a bonus colour theme.
import type { BackingStyle } from '../audio/backing';
import type { Tier } from '../practice/types';
import type { ThemeId } from '../styles/themes';
import { abc } from './helpers';

export interface BonusPiece {
  kind: 'melody';
  id: string;
  level: number;
  title: string;
  description: string;
  abc: string;
  bpm: number;
  tier: Tier;
  style?: BackingStyle;
  chords?: string;
  swing?: boolean;
  /** Notes the player needs (shown as a hint). */
  needs: string;
}

export interface ThemeReward {
  kind: 'theme';
  id: string;
  level: number;
  theme: ThemeId;
  title: string;
  description: string;
}

export type Reward = BonusPiece | ThemeReward;

export const BONUS_PIECES: BonusPiece[] = [
  {
    kind: 'melody',
    id: 'lullaby',
    level: 2,
    title: 'Колыбельная для Бибопа',
    description: 'Нежный вальс на четырёх нотах — под аккомпанемент.',
    abc: abc('B2 A | G3 | A2 B | A3 | B2 c | B2 A | G2 A | G3 |]', { meter: '3/4', key: 'G', bpm: 96, title: 'Колыбельная для Бибопа' }),
    bpm: 96,
    tier: 1,
    style: 'waltz',
    chords: '| G | G | D7 | D7 | C | G | D7 | G |',
    needs: 'Соль, Ля, Си, До',
  },
  {
    kind: 'melody',
    id: 'saints',
    level: 3,
    title: 'Когда святые маршируют',
    description: 'Знаменитый марш из Нового Орлеана (народная мелодия, упрощённая версия).',
    abc: abc('z C E F | G4 | z C E F | G4 | z C E F | G2 E2 | C2 E2 | D4 | z E E D | C3 C | E2 G2 | G F3 | z E F G | E2 C2 | D4 | C4 |]', { bpm: 100, title: 'Когда святые маршируют' }),
    bpm: 100,
    tier: 1,
    style: 'swing',
    swing: true,
    chords: '| C | C | C | C | C | C | C | G7 | C | C7 | F | F | C | C | G7 | C |',
    needs: 'До, Ре, Ми, Фа, Соль первой октавы',
  },
  {
    kind: 'melody',
    id: 'bells',
    level: 4,
    title: 'Бубенцы (Jingle Bells)',
    description: 'Припев рождественской песни Дж. Пьерпонта (1857).',
    abc: abc(
      'E E E2 | E E E2 | E G C3/2 D/2 | E4 | F F F3/2 F/2 | F E E E/2 E/2 | E D D E | D2 G2 | E E E2 | E E E2 | E G C3/2 D/2 | E4 | F F F F | F E E E/2 E/2 | G G F D | C4 |]',
      { bpm: 112, title: 'Бубенцы' },
    ),
    bpm: 112,
    tier: 1,
    style: 'pop',
    chords: '| C | C | C | C | F | C | D7 | G7 | C | C | C | C | F | C | G7 | C |',
    needs: 'До — Соль первой октавы',
  },
  {
    kind: 'melody',
    id: 'night-waltz',
    level: 5,
    title: 'Ночной вальс',
    description: 'Задумчивый вальс в ля миноре (авторская мелодия).',
    abc: abc('A2 c | d2 c | B2 ^G | A3 | c2 A | A2 F | E2 ^G | A3 |]', { meter: '3/4', bpm: 100, title: 'Ночной вальс' }),
    bpm: 100,
    tier: 2,
    style: 'waltz',
    chords: '| Am | Dm | E7 | Am | F | Dm | E7 | Am |',
    needs: 'Ми — Ре второй октавы, Соль-диез',
  },
  {
    kind: 'melody',
    id: 'rocknroll',
    level: 6,
    title: 'Рок-н-ролл Бибопа',
    description: 'Задорный рифф под рок-группу (авторская мелодия).',
    abc: abc('G2 B2 d2 B2 | c2 e2 d2 B2 | G2 B2 d2 B2 | A2 G2 G4 | c2 e2 g2 e2 | d2 B2 G4 | G2 B2 d2 B2 | A2 B2 G4 |]', { L: '1/8', key: 'G', bpm: 120, title: 'Рок-н-ролл Бибопа' }),
    bpm: 120,
    tier: 2,
    style: 'rock',
    chords: '| G | C | G | D7 | C | G | G | D7 G |',
    needs: 'Соль первой — Соль второй октавы',
  },
  {
    kind: 'melody',
    id: 'cat-swing',
    level: 8,
    title: 'Кошачий свинг',
    description: 'Свинговая тема на арпеджио (авторская мелодия).',
    abc: abc('cAFA c4 | dBGB d4 | cBAG F2A2 | G4 F4 | cAFA c4 | dBGB d4 | cBAG A2G2 | F8 |]', { L: '1/8', key: 'F', bpm: 126, title: 'Кошачий свинг' }),
    bpm: 126,
    tier: 3,
    style: 'swing',
    swing: true,
    chords: '| F | Gm7 | C7 | F | F | Gm7 | C7 | F |',
    needs: 'Фа мажор: Си-бемоль, До и Ре второй октавы',
  },
  {
    kind: 'melody',
    id: 'neon-blues',
    level: 10,
    title: 'Неоновый блюз',
    description: 'Вторая блюзовая тема — в Ре (авторская мелодия).',
    abc: abc('z2 DF ^FA2 z | cAFD z4 | z2 DF ^FA2 z | dcAF D4 | z2 G_B =Bd2 z | fd_BG z4 | z2 DF ^FA2 z | cAFD z4 | e4 ^c4 | d4 =B4 | AFDF A2z2 | ^c2e2 A4 |]', {
      L: '1/8',
      bpm: 108,
      title: 'Неоновый блюз',
    }),
    bpm: 108,
    tier: 3,
    style: 'blues',
    swing: true,
    chords: '| D7 | G7 | D7 | D7 | G7 | G7 | D7 | D7 | A7 | G7 | D7 | A7 |',
    needs: 'Ре — Ми второй октавы, Фа-диез, До-диез',
  },
  {
    kind: 'melody',
    id: 'morning-bossa',
    level: 12,
    title: 'Утренняя босса',
    description: 'Мягкая босса-нова с певучими длинными нотами (авторская мелодия).',
    abc: abc('E2 G2 | A3 G | F2 A2 | G4 | E2 G2 | c3 B | A2 F2 | G4 |]', { bpm: 116, title: 'Утренняя босса' }),
    bpm: 116,
    tier: 3,
    style: 'bossa',
    chords: '| Cmaj7 | Am7 | Dm7 | G7 | Cmaj7 | Am7 | Dm7 | G7 |',
    needs: 'Ми первой — До второй октавы',
  },
  {
    kind: 'melody',
    id: 'funk',
    level: 15,
    title: 'Фанк Бибопа',
    description: 'Ритмичный рифф на минорной пентатонике (авторская мелодия).',
    abc: abc('E2 z G A2 z B | d2 B A G E3 | A2 z c d2 z e | d B A G E4 | E2 z G A2 z B | d2 B A G E3 | A2 z c d2 z e | d B A B E4 |]', { L: '1/8', key: 'Em', bpm: 96, title: 'Фанк Бибопа' }),
    bpm: 96,
    tier: 4,
    style: 'funk',
    chords: '| Em7 | Em7 | Am7 | Em7 | Em7 | Em7 | Am7 | Em7 |',
    needs: 'Ми минорная пентатоника',
  },
  {
    kind: 'melody',
    id: 'midnight-bebop',
    level: 20,
    title: 'Полуночный бибоп',
    description: 'Быстрая линия на II–V–I — настоящий джазовый вызов (авторская мелодия).',
    abc: abc('DEFA cAFD | Bdfa gfdB | cBAG EGBd | c2 z2 z4 | FAce dcAF | GBdf edBG | EGBd cBGE | C2 z2 z4 |]', { L: '1/8', bpm: 132, title: 'Полуночный бибоп' }),
    bpm: 132,
    tier: 4,
    style: 'swing',
    swing: true,
    chords: '| Dm7 | G7 | Cmaj7 | Cmaj7 | Dm7 | G7 | Cmaj7 | Cmaj7 |',
    needs: 'Весь диапазон от Ре первой до Ля второй октавы',
  },
];

export const THEME_REWARDS: ThemeReward[] = [
  {
    kind: 'theme',
    id: 'theme-gold',
    level: 10,
    theme: 'gold',
    title: 'Тема «Золотой саксофон»',
    description: 'Чёрный бархат и сияющее золото — для тех, кто дошёл до 10 уровня.',
  },
];

export const REWARDS: Reward[] = [...BONUS_PIECES, ...THEME_REWARDS].sort((a, b) => a.level - b.level);

export const rewardsBetween = (fromExclusive: number, toInclusive: number) =>
  REWARDS.filter((r) => r.level > fromExclusive && r.level <= toInclusive);

export const nextReward = (level: number) => REWARDS.find((r) => r.level > level) ?? null;

export const findBonus = (id: string) => BONUS_PIECES.find((p) => p.id === id);
