import type { Module } from '../types';
import { abc, n, scaleAbc, seq } from '../helpers';

export const BLUES_G = '| G7 | C7 | G7 | G7 | C7 | C7 | G7 | G7 | D7 | C7 | G7 | D7 |';

/** Original 12-bar blues head in written G (concert B♭). */
export const BLUES_HEAD = abc(
  "z2 G _B c ^c d2 | _B G z2 z4 | z2 G _B c ^c d2 | f d _B G z4 | z2 c _e f ^f g2 | _e c z2 z4 | z2 G _B c ^c d2 | _B G z2 z4 | z2 A d ^f2 d2 | z2 G c e2 c2 | _B G _B c d4 | A2 ^F2 D4 |]",
  { L: '1/8', key: 'C', bpm: 108, title: 'Блюз для Бибопа' },
);

const SWING_LINE = abc('GABc dcBA | GBdB c2 A2 | ABcd edcB | A2 F2 G4 |]', { L: '1/8', key: 'G', bpm: 120 });

export const m11: Module = {
  id: 'm11',
  title: 'Свинг и блюз',
  icon: '🎷',
  description: 'Свинговые восьмые, джазовая артикуляция, 12-тактовый блюз, блюзовая гамма и первая блюзовая тема.',
  lessons: [
    {
      id: 'm11-l1',
      title: 'Свинговые восьмые',
      subtitle: '«Ду-ба, ду-ба»',
      minutes: 15,
      tier: 4,
      blocks: [
        {
          type: 'text',
          md: `В джазе восьмые обычно играют **неровно**: первая — длиннее, вторая — короче, примерно как **2/3 и 1/3** доли (триольный «шаг»). Это и есть **свинг**.

Записывают при этом обычные восьмые — свинговать музыкант должен сам. Произносите про себя «**ду**-ба **ду**-ба» с ударением на «ба» — это ещё и характерная джазовая акцентировка.`,
        },
        { type: 'illustration', id: 'swing' },
        {
          type: 'compare',
          caption: 'Сравните ровные и свинговые восьмые:',
          items: [
            { label: 'Ровно', demo: { kind: 'abc', abc: SWING_LINE } },
            { label: 'Свинг', demo: { kind: 'abc', abc: SWING_LINE, swing: true, style: 'swing', chords: '| G | Em7 | Am7 D7 | G |' } },
          ],
        },
      ],
      exercises: [
        seq('swing', 'Свингуем восьмые', SWING_LINE, {
          swing: true,
          style: 'swing',
          chords: '| G | Em7 | Am7 D7 | G |',
          goal: 'Играйте восьмые «длинная — короткая» вместе с ритм-секцией. Оценка учитывает свинговый ритм.',
        }),
      ],
      quiz: [{ type: 'mcq', q: 'Как звучат свинговые восьмые?', options: ['Ровно', 'Первая длиннее, вторая короче', 'Первая короче', 'Как шестнадцатые'], answer: 1 }],
    },
    {
      id: 'm11-l2',
      title: 'Джазовая артикуляция',
      subtitle: 'Язык на «и», лига на долю',
      minutes: 12,
      tier: 4,
      blocks: [
        {
          type: 'text',
          md: `Классическая джазовая артикуляция восьмых: **языком атакуем слабую восьмую (на «и»)** и **лигой** соединяем её со следующей сильной. Получается «ду-**ба** ду-**ба**» — пружинящий, «качающий» звук.

Плюс **акценты на слабых долях** и **призрачные ноты** (ghost notes) — едва слышные ноты внутри фразы. Слушайте записи великих альтистов — Чарли Паркера, Кэннонболла Эддерли — это лучший учебник.`,
        },
        { type: 'listen', label: 'Фраза с джазовой артикуляцией', demo: { kind: 'abc', abc: abc('G(AB)(cd)(ed)c | B2 G2 z4 |]', { L: '1/8', key: 'G', bpm: 116 }), swing: true, style: 'swing', chords: '| G | G |' } },
      ],
      exercises: [
        seq('jazzart', 'Ду-ба', abc('G(AB)(cd)(ed)c | B2 G2 z4 | A(Bc)(de)(fe)d | c2 A2 z4 | G(AB)(cd)(ed)c | B4 G4 |]', { L: '1/8', key: 'G', bpm: 112 }), {
          swing: true,
          style: 'swing',
          chords: '| G | Am7 | D7 | G | G | G |',
        }),
      ],
      quiz: [{ type: 'mcq', q: 'Какую восьмую в джазе обычно атакуют языком?', options: ['Сильную (на цифру)', 'Слабую (на «и»)', 'Каждую одинаково', 'Никакую'], answer: 1 }],
    },
    {
      id: 'm11-l3',
      title: 'Блюзовая форма',
      subtitle: '12 тактов, три аккорда',
      minutes: 14,
      tier: 4,
      blocks: [
        {
          type: 'text',
          md: `**Блюз** — 12 тактов на трёх аккордах: **I, IV и V** (в нашей тональности для альта — **G7, C7, D7**; для пианиста это B♭7, E♭7, F7). Схема повторяется по кругу — каждый круг называется **квадрат** или **хорус**.

Научитесь **слышать**, где вы в квадрате: такт 5 — смена на IV, такт 9 — V, такты 11–12 — «разворот» обратно к началу.`,
        },
        { type: 'illustration', id: 'blues', caption: 'Схема блюза в строе альт-саксофона.' },
        { type: 'listen', label: 'Блюзовый аккомпанемент', demo: { kind: 'backing', style: 'blues', chords: BLUES_G, bpm: 100, bars: 12 } },
      ],
      exercises: [
        seq('roots', 'Корни аккордов блюза', abc('G8 | c8 | G8 | G8 | c8 | c8 | G8 | G8 | d8 | c8 | G8 | d8 |]', { L: '1/8', bpm: 100 }), {
          style: 'blues',
          chords: BLUES_G,
          swing: true,
          metronome: false,
          goal: 'Сыграйте основной звук каждого аккорда, чтобы почувствовать форму блюза.',
        }),
      ],
      quiz: [
        { type: 'mcq', q: 'Сколько тактов в классическом блюзе?', options: ['8', '12', '16', '32'], answer: 1 },
        { type: 'mcq', q: 'На каком такте блюза впервые звучит аккорд IV?', options: ['2-м или 5-м', '9-м', '11-м', '12-м'], answer: 0 },
      ],
    },
    {
      id: 'm11-l4',
      title: 'Блюзовая гамма',
      subtitle: 'Шесть нот, которые звучат всегда',
      minutes: 14,
      tier: 4,
      blocks: [
        {
          type: 'text',
          md: `**Блюзовая гамма** — минорная пентатоника плюс «блюзовая нота» (пониженная V ступень). От Соль: **Соль — Си♭ — До — До♯ (Ре♭) — Ре — Фа — Соль**.

Её звуки хорошо ложатся на **все три аккорда** блюза — поэтому с неё начинают импровизировать. «Блюзовую ноту» До-диез используйте как **проходящую**: не задерживайтесь на ней.`,
        },
        { type: 'abc', abc: scaleAbc(n('G4'), 'blues', { bpm: 92 }), caption: 'Блюзовая гамма от Соль.' },
      ],
      exercises: [
        seq('bscale', 'Блюзовая гамма', scaleAbc(n('G4'), 'blues', { bpm: 92 })),
        seq('licks', 'Блюзовые фразы', abc('G_Bc^c d2 _B2 | G8 | d^cc_B G2 F2 | G8 |]', { L: '1/8', bpm: 100 }), { swing: true, style: 'blues', chords: '| G7 | G7 | C7 | G7 |' }),
      ],
      quiz: [{ type: 'mcq', q: 'Чем блюзовая гамма отличается от минорной пентатоники?', options: ['Ничем', 'Добавлена пониженная V ступень', 'Нет тоники', 'Добавлена VII ступень'], answer: 1 }],
    },
    {
      id: 'm11-l5',
      title: 'Блюз для Бибопа',
      subtitle: 'Первая блюзовая тема',
      minutes: 15,
      tier: 4,
      blocks: [
        {
          type: 'text',
          md: `Тема-рифф на блюзовой гамме — так строили темы многие классические блюзы. Форма **AAB**: фраза, её повтор на IV ступени и ответ.

Свингуйте восьмые, акцентируйте вершины фраз и **слушайте ритм-секцию**.`,
        },
        { type: 'listen', label: 'Блюз для Бибопа', demo: { kind: 'abc', abc: BLUES_HEAD, swing: true, style: 'blues', chords: BLUES_G } },
      ],
      exercises: [
        seq('head', 'Блюз для Бибопа', BLUES_HEAD, { swing: true, style: 'blues', chords: BLUES_G, metronome: false }),
      ],
    },
  ],
  exam: {
    title: 'Экзамен: свинг и блюз',
    description: 'Блюзовая гамма, свинговые восьмые и блюзовая тема с ритм-секцией.',
    exercises: [
      seq('ex-scale', 'Блюзовая гамма', scaleAbc(n('G4'), 'blues', { bpm: 104 })),
      seq('ex-swing', 'Свинговые восьмые', SWING_LINE, { swing: true, style: 'swing', chords: '| G | Em7 | Am7 D7 | G |' }),
      seq('ex-head', 'Блюз для Бибопа', BLUES_HEAD, { swing: true, style: 'blues', chords: BLUES_G, metronome: false }),
    ],
    quiz: [
      { type: 'mcq', q: 'Какие аккорды у блюза в Соль (строй альта)?', options: ['G, Am, D', 'G7, C7, D7', 'Gmaj7, Cmaj7, Dmaj7', 'G7, A7, B7'], answer: 1 },
      { type: 'chordQuality', qualities: ['major', 'minor', 'dom7'], count: 3 },
    ],
  },
};
