// AI tutor «Бибоп» via OpenRouter. Measurements are done locally by the DSP
// evaluators; the language model interprets them and coaches the student.
import { platform, type ChatBody, type ModelInfo } from '../lib/platform';
import { getSettings, useSettings } from '../store/settings';
import { progressSnapshot, SKILL_NAMES, type SkillId } from '../store/progress';
import { levelFromXp, rankFor } from '../game/levels';
import { noteNameRu } from '../music/notes';
import { courseProgress, nextLesson } from '../content/progression';
import type { EvalResult } from '../practice/types';
import { db } from '../store/db';

export const PERSONA = `Ты — Бибоп, ИИ-наставник по игре на альт-саксофоне в приложении «Саксофония».
Ты опытный саксофонист (классика, джаз, эстрада) и терпеливый, весёлый педагог. Твой ученик — взрослый,
учится самостоятельно, немного играет, ноты читает слабо; его цель — свободно импровизировать.

Правила:
- Отвечай только по-русски, обращайся на «вы», дружелюбно и с лёгким джазовым юмором, без сюсюканья.
- Опирайся на измерения приложения (баллы, центы, миллисекунды). Ничего не выдумывай: если данных нет — так и скажи.
- Давай конкретные физические подсказки: дыхание и опора, амбушюр, положение языка, пальцы, аппликатуры.
- Учитывай особенности альт-саксофона: верхние ноты (ладонные клапаны) склонны к завышению, нижние — к занижению,
  До-диез второй октавы звучит «пусто» и часто завышен, переход До-диез → Ре второй октавы — трудное место.
- Ноты называй как в саксофонных нотах (строй ми-бемоль), по-русски: До, Ре, Ми…
- Не пиши длинные лекции. Используй **жирный** для главного, без заголовков и таблиц.`;

const MODEL_CACHE = 'sax.models';

export async function fetchModels(force = false): Promise<ModelInfo[]> {
  if (!force) {
    try {
      const c = JSON.parse(localStorage.getItem(MODEL_CACHE) || 'null');
      if (c && Date.now() - c.ts < 24 * 3600 * 1000 && c.models?.length) return c.models;
    } catch {
      /* ignore */
    }
  }
  const models = await platform.ai.listModels();
  localStorage.setItem(MODEL_CACHE, JSON.stringify({ ts: Date.now(), models }));
  return models;
}

/** Picks a sensible default: a fast, inexpensive, recent model that writes good Russian. */
export function recommendModels(models: ModelInfo[]): ModelInfo[] {
  const prefs = [/^google\/gemini-[\d.]+-flash(?!-lite)/, /^anthropic\/claude-[\w.-]*haiku/, /^openai\/gpt-[\d.]+-mini$/, /^deepseek\/deepseek-chat/];
  const out: ModelInfo[] = [];
  for (const re of prefs) {
    const cands = models.filter((m) => re.test(m.id) && !m.id.includes(':free') && m.promptPrice > 0).sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
    if (cands[0]) out.push(cands[0]);
  }
  return out;
}

export async function ensureModel(): Promise<string> {
  const s = getSettings();
  if (s.ai.model) return s.ai.model;
  const models = await fetchModels();
  const rec = recommendModels(models)[0] ?? models.find((m) => m.id.endsWith(':free'));
  if (!rec) throw new Error('Не удалось выбрать модель. Выберите её в настройках.');
  useSettings.getState().setAi({ model: rec.id });
  return rec.id;
}

export async function aiAvailable() {
  const s = getSettings();
  return s.ai.enabled && (await platform.ai.hasKey());
}

// ---------------------------------------------------------------------------
// Spend tracking
// ---------------------------------------------------------------------------

const SPEND = 'sax.aiSpend';

export function monthSpend(): number {
  try {
    const s = JSON.parse(localStorage.getItem(SPEND) || 'null');
    const m = new Date().toISOString().slice(0, 7);
    return s && s.month === m ? s.usd : 0;
  } catch {
    return 0;
  }
}

function addSpend(usd: number) {
  const m = new Date().toISOString().slice(0, 7);
  const cur = monthSpend();
  localStorage.setItem(SPEND, JSON.stringify({ month: m, usd: cur + usd }));
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export function studentProfile(): string {
  const p = progressSnapshot();
  const s = getSettings();
  const lv = levelFromXp(p.xp);
  const cp = courseProgress(p);
  const next = nextLesson(p);
  const skills = (Object.entries(p.skills) as [SkillId, number][])
    .sort((a, b) => a[1] - b[1])
    .map(([k, v]) => `${SKILL_NAMES[k]} ${v}`)
    .join(', ');
  const notes = Object.entries(p.noteStats)
    .filter(([, v]) => v.n >= 3)
    .sort((a, b) => Math.abs(b[1].cents) - Math.abs(a[1].cents))
    .slice(0, 5)
    .map(([m, v]) => `${noteNameRu(Number(m))} ${v.cents > 0 ? '+' : ''}${Math.round(v.cents)} ц`)
    .join(', ');
  return [
    `Имя: ${s.userName || 'не указано'}. Уровень ${lv.level} («${rankFor(lv.level)}»), серия дней: ${p.streak.current}.`,
    `Курс: пройдено ${cp.done} из ${cp.total} уроков. Следующий урок: ${next ? next.lesson.title : 'курс завершён'}.`,
    skills ? `Навыки (0–100, от слабых к сильным): ${skills}.` : 'Навыки ещё не измерены.',
    notes ? `Интонация по нотам (в среднем): ${notes}.` : '',
    `Практика всего: ${Math.round(p.totals.seconds / 60)} мин, попыток: ${p.totals.attempts}.`,
  ]
    .filter(Boolean)
    .join('\n');
}

export interface AttemptContext {
  exerciseTitle: string;
  kind: string;
  goal: string;
  lessonTitle?: string;
  tier: number;
  attempt: number;
  previousBest?: number;
  mode?: string;
  result: EvalResult;
}

function attemptText(c: AttemptContext) {
  const r = c.result;
  const crit = r.criteria.map((x) => `- ${x.label}: ${x.score}/100 — ${x.detail}`).join('\n');
  const wrong = (r.notes ?? [])
    .filter((x) => x.judgment === 'wrong' || x.judgment === 'miss')
    .slice(0, 12)
    .map((x) => (x.judgment === 'miss' ? `нота ${x.i + 1} (${noteNameRu(x.expected)}) не прозвучала${x.flag === 'merged' ? ' — слилась с предыдущей' : ''}` : `нота ${x.i + 1}: нужно ${noteNameRu(x.expected)}, сыграно ${noteNameRu(x.played ?? 0)}${x.flag === 'squeak' ? ' (кикс)' : ''}`))
    .join('; ');
  const metrics = Object.entries(r.metrics)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  return `Упражнение: «${c.exerciseTitle}» (${c.kind}${c.mode ? `, режим ${c.mode}` : ''})${c.lessonTitle ? `, урок «${c.lessonTitle}»` : ''}.
Задача: ${c.goal}
Уровень строгости: ${c.tier} из 4. Попытка №${c.attempt}${c.previousBest !== undefined ? `, лучший прошлый результат ${c.previousBest}%` : ''}.
Итог: ${r.score}% (${r.passed ? 'зачёт' : 'не зачтено'}, нужно ${r.metrics.passScore}%).
Критерии:
${crit}
${wrong ? `Ошибки: ${wrong}.` : ''}
Метрики: ${metrics}`;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export interface AiReply {
  text: string;
  costUsd?: number;
  model?: string;
}

async function run(messages: ChatBody['messages'], onDelta: (t: string) => void, maxTokens = 600, onId?: (id: string) => void): Promise<AiReply> {
  const s = getSettings();
  if (s.ai.budgetUsd > 0 && monthSpend() >= s.ai.budgetUsd)
    throw new Error(`Достигнут месячный лимит расходов на ИИ ($${s.ai.budgetUsd}). Его можно изменить в настройках.`);
  const model = await ensureModel();
  const res = await platform.ai.chat({ model, messages, max_tokens: maxTokens, temperature: 0.7 }, onDelta, onId);
  const cost = Number(res.usage?.cost ?? 0);
  if (cost > 0) addSpend(cost);
  return { text: res.text, costUsd: cost || undefined, model: res.model ?? model };
}

export async function attemptFeedback(c: AttemptContext, onDelta: (t: string) => void, audioWav?: Blob | null, onId?: (id: string) => void): Promise<AiReply> {
  const user: any[] = [
    {
      type: 'text',
      text: `${attemptText(c)}

Профиль ученика:
${studentProfile()}

Дай короткий разбор этой попытки (3–6 предложений): эмоциональная оценка, 1–3 конкретных совета по самым слабым критериям и что делать дальше (повторить, снизить темп, перейти дальше).`,
    },
  ];
  if (audioWav && getSettings().ai.sendAudio) {
    const b64 = await blobToBase64(audioWav);
    user.push({ type: 'input_audio', input_audio: { data: b64, format: 'wav' } });
    user[0].text += '\nК сообщению приложена запись попытки — прислушайся к тембру, атаке и чистоте звука и учти это в разборе.';
  }
  return run(
    [
      { role: 'system', content: PERSONA },
      { role: 'user', content: user.length === 1 ? user[0].text : user },
    ],
    onDelta,
    500,
    onId,
  );
}

export async function chatReply(history: { role: 'user' | 'assistant'; content: string }[], onDelta: (t: string) => void, onId?: (id: string) => void) {
  const recent = await db.attempts.orderBy('date').reverse().limit(8).toArray();
  const attempts = recent
    .map((a) => `${new Date(a.date).toLocaleDateString('ru-RU')} «${a.title}»: ${a.score}%${a.passed ? '' : ' (не зачтено)'}`)
    .join('\n');
  const system = `${PERSONA}

Сейчас вы беседуете в чате. Отвечай по делу, можно подробнее, чем в разборе попытки (до 250 слов), но без воды.
Если ученик спрашивает про аппликатуру — опиши клавиши словами (левая рука 1-2-3, правая 4-5-6, октавный клапан, мизинцы).
Если вопрос не про музыку — мягко верни разговор к саксофону.

Профиль ученика:
${studentProfile()}
${attempts ? `\nПоследние попытки:\n${attempts}` : ''}`;
  return run([{ role: 'system', content: system }, ...history.slice(-16)], onDelta, 900, onId);
}

export async function weeklyReport(onDelta: (t: string) => void) {
  const since = Date.now() - 7 * 86400000;
  const rows = await db.attempts.where('date').above(since).toArray();
  const byKind = new Map<string, number[]>();
  rows.forEach((r) => byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r.score]));
  const lines = [...byKind.entries()].map(([k, v]) => `${k}: ${v.length} попыток, средний балл ${Math.round(v.reduce((a, b) => a + b, 0) / v.length)}`);
  const p = progressSnapshot();
  const days = Object.entries(p.days)
    .filter(([d]) => new Date(d).getTime() >= since - 86400000)
    .map(([d, v]) => `${d}: ${Math.round(v.seconds / 60)} мин`)
    .join(', ');
  return run(
    [
      { role: 'system', content: PERSONA },
      {
        role: 'user',
        content: `Составь недельный отчёт для ученика (до 200 слов): что получилось, что хромает, и план на следующую неделю по дням (коротко, списком).
Занятия по дням: ${days || 'нет данных'}.
Попытки за неделю по типам упражнений:
${lines.join('\n') || 'попыток не было'}
Профиль:
${studentProfile()}`,
      },
    ],
    onDelta,
    900,
  );
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = reject;
    r.readAsDataURL(b);
  });
}
