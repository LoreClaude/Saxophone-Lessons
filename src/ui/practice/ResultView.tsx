// Results screen: score, stars, criteria, per-note map, recording, AI feedback.
import { useEffect, useRef, useState } from 'react';
import { RotateCcw, ArrowRight, Play, Square, Sparkles, KeyRound } from 'lucide-react';
import type { FinishedAttempt } from './common';
import type { Exercise } from '../../practice/types';
import { KIND_NAMES } from '../../practice/types';
import { noteNameRu } from '../../music/notes';
import { aiAvailable, attemptFeedback } from '../../ai/tutor';
import { db } from '../../store/db';
import { getSettings } from '../../store/settings';
import { burst, playSfx, celebrate } from '../../lib/toast';
import { navigate } from '../../lib/router';
import { platform } from '../../lib/platform';
import { Bar, Markdown, Mascot, ScoreRing, Stars } from '../components';
import { useKey } from './common';

export function ResultView({
  ex,
  attempt,
  lessonTitle,
  tier,
  onRetry,
  onNext,
  nextLabel = 'Дальше',
}: {
  ex: Exercise;
  attempt: FinishedAttempt;
  lessonTitle?: string;
  tier: number;
  onRetry: () => void;
  onNext?: () => void;
  nextLabel?: string;
}) {
  const r = attempt.result;
  const [ai, setAi] = useState<{ status: 'off' | 'nokey' | 'loading' | 'done' | 'error'; text: string; cost?: number }>({ status: 'off', text: '' });
  const [playing, setPlaying] = useState(false);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    celebrate(attempt.outcome);
    if (r.passed) {
      playSfx('success');
      if (r.stars >= 2) burst(r.stars === 3);
    } else playSfx('fail');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const askAi = async () => {
    requested.current = true;
    if (!(await aiAvailable())) {
      setAi({ status: 'nokey', text: '' });
      return;
    }
    setAi({ status: 'loading', text: '' });
    try {
      let acc = '';
      const reply = await attemptFeedback(
        {
          exerciseTitle: ex.title,
          kind: KIND_NAMES[ex.kind],
          goal: ex.goal,
          lessonTitle,
          tier,
          attempt: attempt.attemptNo,
          previousBest: attempt.previousBest,
          mode: attempt.mode,
          result: r,
        },
        (d) => {
          acc += d;
          setAi({ status: 'loading', text: acc });
        },
        attempt.recording,
      );
      setAi({ status: 'done', text: reply.text, cost: reply.costUsd });
      if (attempt.attemptId) db.attempts.update(attempt.attemptId, { aiComment: reply.text });
    } catch (e: any) {
      setAi({ status: 'error', text: e?.message || 'Ошибка запроса к ИИ' });
    }
  };

  useEffect(() => {
    if (!requested.current && getSettings().ai.enabled && getSettings().ai.autoFeedback) askAi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useKey(
    (e) => {
      if (e.code === 'KeyR' || (e.code === 'Space' && !r.passed)) {
        e.preventDefault();
        onRetry();
      } else if ((e.code === 'Enter' || e.code === 'Space') && onNext) {
        e.preventDefault();
        onNext();
      }
    },
    [onRetry, onNext, r.passed],
  );

  const togglePlay = () => {
    if (!attempt.recording) return;
    if (playing) {
      audioEl.current?.pause();
      setPlaying(false);
      return;
    }
    const url = URL.createObjectURL(attempt.recording);
    const a = new Audio(url);
    audioEl.current = a;
    a.onended = () => {
      setPlaying(false);
      URL.revokeObjectURL(url);
    };
    a.play();
    setPlaying(true);
  };

  const mood = r.score >= 85 ? 'wow' : r.passed ? 'happy' : r.score >= 40 ? 'think' : 'sad';

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="card glow">
        <div className="result-hero">
          <ScoreRing score={r.score} size={150} />
          <div className="grow">
            <Stars n={r.stars} size={30} />
            <h2 style={{ margin: '8px 0 4px' }}>{r.summary}</h2>
            <div className="muted">
              {r.passed ? 'Упражнение зачтено.' : `Для зачёта нужно ${r.metrics.passScore}%.`}
              {attempt.outcome ? ` +${attempt.outcome.xpGained} XP` : ''}
              {attempt.outcome?.firstPass ? ' · первый зачёт!' : ''}
              {r.points !== undefined ? ` · очки: ${r.points}` : ''}
              {r.maxCombo ? ` · лучшее комбо ×${r.maxCombo}` : ''}
            </div>
            <div className="row mt">
              <button className="btn ghost" onClick={onRetry}>
                <RotateCcw size={18} /> Ещё раз <span className="kbd">R</span>
              </button>
              {onNext && (
                <button className="btn" onClick={onNext}>
                  {nextLabel} <ArrowRight size={18} /> <span className="kbd">Enter</span>
                </button>
              )}
              {attempt.recording && (
                <button className="btn ghost" onClick={togglePlay}>
                  {playing ? <Square size={16} /> : <Play size={16} />} {playing ? 'Стоп' : 'Моя запись'}
                </button>
              )}
            </div>
          </div>
          <Mascot size={110} mood={mood} />
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', alignItems: 'start' }}>
        <div className="card">
          <h3>Разбор по критериям</h3>
          {r.criteria.map((c) => (
            <div key={c.id} className="crit">
              <div>
                <b>{c.label}</b>
              </div>
              <Bar value={c.score} className={c.score >= 80 ? 'good' : c.score >= 55 ? 'mid' : 'low'} />
              <div className="display" style={{ textAlign: 'right' }}>
                {c.score}
              </div>
              <div className="small muted" style={{ gridColumn: '1 / -1', marginTop: -6 }}>
                {c.detail}
              </div>
            </div>
          ))}
          {r.notes && r.notes.length > 0 && (
            <>
              <div className="divider" />
              <div className="small muted mb">Ноты по порядку:</div>
              <div className="note-chips">
                {r.notes.map((nr) => (
                  <span
                    key={nr.i}
                    className={`note-chip ${nr.judgment}`}
                    title={
                      nr.judgment === 'wrong'
                        ? `Сыграно: ${noteNameRu(nr.played ?? 0)}${nr.flag === 'squeak' ? ' (кикс)' : ''}`
                        : nr.judgment === 'miss'
                          ? nr.flag === 'merged'
                            ? 'Слилась с предыдущей'
                            : 'Не прозвучала'
                          : `${nr.cents !== undefined ? `${nr.cents > 0 ? '+' : ''}${Math.round(nr.cents)} ц` : ''}${nr.timing !== undefined ? ` · ${nr.timing > 0 ? '+' : ''}${Math.round(nr.timing * 1000)} мс` : ''}`
                    }
                  >
                    {noteNameRu(nr.expected)}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="row between">
            <h3 style={{ margin: 0 }}>
              <Sparkles size={18} color="var(--accent-3)" /> Бибоп говорит
            </h3>
            {ai.cost ? <span className="tiny muted">${ai.cost.toFixed(4)}</span> : null}
          </div>
          <div className="tutor-bubble mt">
            <Mascot size={58} mood={ai.status === 'loading' ? 'think' : mood} />
            <div className="bubble">
              {ai.status === 'off' && (
                <>
                  {r.tips.length ? (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {r.tips.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  ) : (
                    <div>{r.passed ? 'Отличная работа! Продолжайте в том же духе.' : 'Попробуйте ещё раз — медленнее и спокойнее.'}</div>
                  )}
                  <button className="btn ghost mt" onClick={askAi}>
                    <Sparkles size={16} /> Подробный разбор от ИИ
                  </button>
                </>
              )}
              {ai.status === 'nokey' && (
                <>
                  <div>Чтобы я мог разбирать ваши попытки, подключите ИИ: вставьте ключ OpenRouter в настройках.</div>
                  {r.tips.length > 0 && (
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                      {r.tips.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  )}
                  <button className="btn ghost mt" onClick={() => navigate('/settings')}>
                    <KeyRound size={16} /> Настроить ИИ
                  </button>
                </>
              )}
              {(ai.status === 'loading' || ai.status === 'done') && (ai.text ? <Markdown md={ai.text} /> : <span className="muted">Слушаю вашу игру и думаю…</span>)}
              {ai.status === 'error' && (
                <>
                  <div style={{ color: 'var(--bad)' }}>{ai.text}</div>
                  {r.tips.length > 0 && (
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                      {r.tips.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  )}
                  <button className="btn ghost mt" onClick={askAi}>
                    Повторить запрос
                  </button>
                </>
              )}
            </div>
          </div>
          {!platform.isElectron && ai.status === 'nokey' && <div className="tiny muted mt">Браузерная версия для разработки.</div>}
        </div>
      </div>
    </div>
  );
}
