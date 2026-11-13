import { useEffect, useRef, useState } from 'react';
import { Send, Trash2, FileText, Square, KeyRound } from 'lucide-react';
import { db, type ChatRow } from '../../store/db';
import { aiAvailable, chatReply, weeklyReport } from '../../ai/tutor';
import { useProgress } from '../../store/progress';
import { celebrate } from '../../lib/toast';
import { navigate } from '../../lib/router';
import { platform } from '../../lib/platform';
import { Markdown, Mascot } from '../components';

const QUICK = [
  'Как сделать звук красивее и плотнее?',
  'Почему у меня завышены верхние ноты?',
  'Составь план занятий на неделю по 30 минут',
  'Объясни простыми словами, что такое свинг',
  'С чего начать импровизацию?',
  'Как не уставали губы при игре?',
];

export function TutorPage() {
  const [msgs, setMsgs] = useState<ChatRow[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [ok, setOk] = useState<boolean | null>(null);
  const [err, setErr] = useState('');
  const reqId = useRef('');
  const end = useRef<HTMLDivElement>(null);
  const unlock = useProgress((s) => s.unlock);

  useEffect(() => {
    db.chat.orderBy('ts').toArray().then(setMsgs);
    aiAvailable().then(setOk);
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, streaming]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setErr('');
    const userMsg: ChatRow = { ts: Date.now(), role: 'user', content: t };
    userMsg.id = await db.chat.add(userMsg);
    const history = [...msgs, userMsg];
    setMsgs(history);
    setInput('');
    setBusy(true);
    setStreaming('');
    if (unlock('tutor_chat')) celebrate({ xpGained: 0, levelBefore: 0, levelAfter: 0, newAchievements: ['tutor_chat'], questsDone: [], firstPass: false, newBest: false });
    try {
      let acc = '';
      const r = await chatReply(
        history.map((m) => ({ role: m.role, content: m.content })),
        (d) => {
          acc += d;
          setStreaming(acc);
        },
        (id) => (reqId.current = id),
      );
      const bot: ChatRow = { ts: Date.now(), role: 'assistant', content: r.text };
      bot.id = await db.chat.add(bot);
      setMsgs((m) => [...m, bot]);
    } catch (e: any) {
      setErr(e?.message || 'Ошибка');
    }
    setStreaming('');
    setBusy(false);
  };

  const report = async () => {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      let acc = '';
      const r = await weeklyReport((d) => {
        acc += d;
        setStreaming(acc);
      });
      const bot: ChatRow = { ts: Date.now(), role: 'assistant', content: `📊 **Недельный отчёт**\n\n${r.text}` };
      bot.id = await db.chat.add(bot);
      setMsgs((m) => [...m, bot]);
    } catch (e: any) {
      setErr(e?.message || 'Ошибка');
    }
    setStreaming('');
    setBusy(false);
  };

  if (ok === false)
    return (
      <div className="page center col" style={{ alignItems: 'center', paddingTop: 40 }}>
        <Mascot size={140} mood="think" />
        <h2>Бибоп ждёт подключения</h2>
        <p className="muted" style={{ maxWidth: 520 }}>
          Чтобы общаться с наставником, включите ИИ и добавьте ключ OpenRouter в настройках. Без ключа приложение всё равно оценивает игру и даёт советы после
          упражнений.
        </p>
        <button className="btn" onClick={() => navigate('/settings')}>
          <KeyRound size={18} /> Открыть настройки
        </button>
      </div>
    );

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)' }}>
      <div className="row between">
        <div className="row">
          <Mascot size={64} mood="cool" />
          <div>
            <h1 style={{ margin: 0 }}>Наставник Бибоп</h1>
            <div className="small muted">Спрашивайте о технике, теории, джазе, мотивации. Я знаю ваш прогресс.</div>
          </div>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={report} disabled={busy}>
            <FileText size={18} /> Недельный отчёт
          </button>
          <button
            className="btn ghost icon"
            title="Очистить историю"
            onClick={async () => {
              await db.chat.clear();
              setMsgs([]);
            }}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      <div className="card mt" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {msgs.length === 0 && !streaming && (
          <div className="center muted" style={{ margin: 'auto' }}>
            <p>Задайте вопрос — например:</p>
            <div className="row wrap" style={{ justifyContent: 'center' }}>
              {QUICK.map((q) => (
                <button key={q} className="chip" style={{ cursor: 'pointer' }} onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className="tutor-bubble" style={m.role === 'user' ? { flexDirection: 'row-reverse' } : undefined}>
            {m.role === 'assistant' && <Mascot size={44} mood="happy" />}
            <div className={`bubble ${m.role === 'user' ? 'me' : ''}`} style={{ maxWidth: '80%', whiteSpace: m.role === 'user' ? 'pre-wrap' : 'normal' }}>
              {m.role === 'assistant' ? <Markdown md={m.content} /> : m.content}
            </div>
          </div>
        ))}
        {streaming && (
          <div className="tutor-bubble">
            <Mascot size={44} mood="think" />
            <div className="bubble" style={{ maxWidth: '80%', whiteSpace: 'normal' }}>
              <Markdown md={streaming} />
            </div>
          </div>
        )}
        {busy && !streaming && <div className="muted small">Бибоп думает…</div>}
        {err && <div style={{ color: 'var(--bad)' }}>{err}</div>}
        <div ref={end} />
      </div>
      <div className="row mt">
        <textarea
          className="grow"
          rows={2}
          placeholder="Напишите вопрос… (Enter — отправить, Shift+Enter — новая строка)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        {busy ? (
          <button className="btn danger" onClick={() => reqId.current && platform.ai.abort(reqId.current)}>
            <Square size={18} />
          </button>
        ) : (
          <button className="btn" onClick={() => send(input)} disabled={!input.trim()}>
            <Send size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
