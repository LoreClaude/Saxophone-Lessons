import type { Module } from '../types';
import { abc, echo, n, scaleAbc, seq } from '../helpers';

const phrase = (body: string, bpm = 80) => abc(body, { bpm });

export const m09: Module = {
  id: 'm09',
  title: 'Гаммы, арпеджио и слух',
  icon: '👂',
  description: 'Гаммы с бемолями, трезвучия и септаккорды, интервалы на слух и игра «повтори за мной».',
  lessons: [
    {
      id: 'm09-l1',
      title: 'Гаммы с бемолями',
      subtitle: 'Си-бемоль и Ми-бемоль мажор',
      minutes: 14,
      tier: 3,
      blocks: [
        {
          type: 'text',
          md: `Для джаза особенно важны тональности **с бемолями** — в них написана большая часть стандартов (для альта они часто превращаются в тональности с диезами, но и бемольные встречаются постоянно).

Играйте гаммы **восьмыми**: сначала медленно, потом ускоряйте на 4 удара метронома за раз, пока все ноты остаются ровными.`,
        },
      ],
      exercises: [
        seq('bb', 'Си-бемоль мажор', scaleAbc(n('Bb3'), 'major', { key: 'Bb', bpm: 80 })),
        seq('eb', 'Ми-бемоль мажор', scaleAbc(n('Eb4'), 'major', { key: 'Eb', bpm: 80 })),
      ],
      quiz: [{ type: 'mcq', q: 'Сколько бемолей в Ми-бемоль мажоре?', options: ['1', '2', '3', '4'], answer: 2 }],
    },
    {
      id: 'm09-l2',
      title: 'Трезвучия и арпеджио',
      subtitle: 'Аккорд по одной ноте',
      minutes: 14,
      tier: 3,
      blocks: [
        {
          type: 'text',
          md: `**Трезвучие** — аккорд из трёх звуков через терцию: **I, III и V** ступени. Саксофон играет по одной ноте, поэтому аккорды мы играем **арпеджио** — по очереди.

- **Мажорное** трезвучие: большая терция + малая (До — Ми — Соль), звучит светло.
- **Минорное**: малая терция + большая (Ля — До — Ми), звучит мягко и грустно.

Знание аккордов — основа импровизации: самые «надёжные» ноты над аккордом — его собственные звуки.`,
        },
        {
          type: 'compare',
          items: [
            { label: 'Мажор (До)', demo: { kind: 'chord', notes: [60, 64, 67] } },
            { label: 'Минор (Ля)', demo: { kind: 'chord', notes: [69, 72, 76] } },
          ],
        },
      ],
      exercises: [
        seq('arp', 'Арпеджио До, Фа, Соль', abc('C E G c | G E C2 | F A c f | c A F2 | G B d g | d B G2 |]', { bpm: 84 })),
        seq('arpmin', 'Минорные арпеджио', abc('A c e a | e c A2 | D F A d | A F D2 | E G B e | B G E2 |]', { bpm: 84 })),
      ],
      quiz: [
        { type: 'chordQuality', qualities: ['major', 'minor'], count: 4 },
        { type: 'mcq', q: 'Какие ступени входят в трезвучие?', options: ['I, II, III', 'I, III, V', 'I, IV, V', 'I, V, VII'], answer: 1 },
      ],
    },
    {
      id: 'm09-l3',
      title: 'Интервалы на слух',
      subtitle: 'Терции, кварты, квинты',
      minutes: 12,
      tier: 3,
      blocks: [
        {
          type: 'text',
          md: `**Интервал** — расстояние между двумя звуками. Чтобы узнавать интервалы на слух, музыканты запоминают их по началу знакомых мелодий:

- **Большая секунда** — «Братец Якоб» (До — Ре).
- **Большая терция** — «Когда святые маршируют» (До — Ми).
- **Чистая кварта** — свадебный хор Вагнера «Here Comes the Bride» (Соль — До).
- **Чистая квинта** — главная тема «Звёздных войн» (До — Соль).
- **Октава** — «Somewhere Over the Rainbow».`,
        },
        {
          type: 'compare',
          items: [
            { label: 'Секунда', demo: { kind: 'interval', a: 60, b: 62 } },
            { label: 'Терция', demo: { kind: 'interval', a: 60, b: 64 } },
            { label: 'Кварта', demo: { kind: 'interval', a: 60, b: 65 } },
            { label: 'Квинта', demo: { kind: 'interval', a: 60, b: 67 } },
            { label: 'Октава', demo: { kind: 'interval', a: 60, b: 72 } },
          ],
        },
      ],
      exercises: [
        echo('echo2', 'Повтори два звука', [phrase('G2 c2 |]'), phrase('G2 d2 |]'), phrase('c2 e2 |]'), phrase('A2 d2 |]'), phrase('G2 g2 |]')], 80),
      ],
      quiz: [{ type: 'interval', intervals: [2, 4, 5, 7, 12], count: 6 }],
    },
    {
      id: 'm09-l4',
      title: 'Повтори за мной',
      subtitle: 'Фразы на слух',
      minutes: 14,
      tier: 3,
      blocks: [
        {
          type: 'text',
          md: `Подбор по слуху — главный навык импровизатора. Я играю короткую фразу, вы — повторяете.

1. Слушайте, **пропойте** фразу про себя.
2. Найдите **первую ноту** (подсказка: все фразы начинаются с Соль, До или Ре второй октавы).
3. Повторите — и не бойтесь ошибиться: после ответа ноты покажутся на экране.`,
        },
      ],
      exercises: [
        echo('echo3', 'Короткие фразы', [phrase('G A B2 |]'), phrase('c B A2 |]'), phrase('G B d2 |]'), phrase('d c B G |]'), phrase('c d e c |]')], 84),
        echo('echo4', 'Фразы с ритмом', [abc('G2 AB c2 |]', { L: '1/8', bpm: 80 }), abc('d2 cB A2 |]', { L: '1/8', bpm: 80 }), abc('c2 e2 dc B2 |]', { L: '1/8', bpm: 80 }), abc('G B d B c2 |]', { L: '1/8', bpm: 80 })], 80),
      ],
    },
    {
      id: 'm09-l5',
      title: 'Септаккорды',
      subtitle: 'Доминантсептаккорд — сердце блюза',
      minutes: 14,
      tier: 3,
      blocks: [
        {
          type: 'text',
          md: `Добавим к трезвучию ещё одну терцию — получится **септаккорд** (I–III–V–VII). Самый важный для нас — **доминантсептаккорд** (обозначается просто «7»: G7, C7, D7): мажорное трезвучие + **малая септима**.

Его напряжённое звучание — основа **блюза**: в блюзе почти все аккорды — доминантсептаккорды.`,
        },
        { type: 'listen', label: 'Соль-доминантсептаккорд (G7)', demo: { kind: 'chord', notes: [67, 71, 74, 77] } },
      ],
      exercises: [
        seq('dom7', 'Арпеджио G7, C7, D7', abc('G B d f | d B G2 | c e g _b | g e c2 | D ^F A c | A ^F D2 |]', { bpm: 84 })),
      ],
      quiz: [{ type: 'chordQuality', qualities: ['major', 'minor', 'dom7'], count: 5 }],
    },
  ],
  exam: {
    title: 'Экзамен: гаммы и слух',
    description: 'Гамма, арпеджио септаккордов и фразы на слух.',
    exercises: [
      seq('ex-bb', 'Си-бемоль мажор', scaleAbc(n('Bb3'), 'major', { key: 'Bb', bpm: 92 })),
      seq('ex-dom7', 'Септаккорды', abc('G B d f | d B G2 | c e g _b | g e c2 |]', { bpm: 92 })),
      echo('ex-echo', 'Повтори за мной', [phrase('G A B2 |]'), phrase('d c B G |]'), phrase('c d e c |]')], 84),
    ],
    quiz: [
      { type: 'interval', intervals: [3, 4, 5, 7], count: 4 },
      { type: 'chordQuality', qualities: ['major', 'minor', 'dom7'], count: 3 },
    ],
  },
};
