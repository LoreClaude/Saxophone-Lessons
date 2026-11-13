import { useEffect, useState } from 'react';
import { ArrowRight, Headphones, Mic, Sparkles, ExternalLink } from 'lucide-react';
import { useSettings } from '../../store/settings';
import { audio } from '../../audio/engine';
import { concertToWritten, noteNameRu } from '../../music/notes';
import { THEMES, type ThemeId, applyTheme } from '../../styles/themes';
import { platform } from '../../lib/platform';
import { Mascot } from '../components';
import { LevelMeter } from '../practice/common';

const STEPS = ['hello', 'mic', 'headphones', 'theme', 'ai', 'done'] as const;

export function Onboarding() {
  const s = useSettings();
  const [step, setStep] = useState(0);
  const cur = STEPS[step];
  const next = () => setStep((x) => Math.min(STEPS.length - 1, x + 1));
  useEffect(() => {
    applyTheme(s.theme);
  }, [s.theme]);

  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 20, overflowY: 'auto' }}>
      <div className="card glow" style={{ width: 'min(760px, 96vw)', padding: 34 }}>
        <div className="row" style={{ gap: 6, marginBottom: 22 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 6, borderRadius: 6, background: i <= step ? 'var(--accent)' : 'var(--surface-2)' }} />
          ))}
        </div>
        {cur === 'hello' && (
          <div className="col center" style={{ alignItems: 'center' }}>
            <Mascot size={150} mood="cool" float />
            <h1>Привет! Я Бибоп.</h1>
            <p className="muted" style={{ maxWidth: 540 }}>
              Я научу вас играть на альт-саксофоне: от дыхания и первых нот до свинга и импровизации. Я слушаю вашу игру через микрофон, оцениваю ноты, ритм,
              интонацию и звук — и подсказываю, как стать лучше.
            </p>
            <input type="text" placeholder="Как к вам обращаться?" value={s.userName} onChange={(e) => s.set({ userName: e.target.value })} style={{ width: 320, textAlign: 'center' }} />
            <button className="btn big mt" onClick={next}>
              Поехали <ArrowRight />
            </button>
          </div>
        )}
        {cur === 'mic' && <MicStep onNext={next} />}
        {cur === 'headphones' && (
          <div className="col center" style={{ alignItems: 'center' }}>
            <Headphones size={70} color="var(--accent-2)" />
            <h2>Играйте в наушниках</h2>
            <p className="muted" style={{ maxWidth: 560 }}>
              Метроном, аккомпанемент и образцы мелодий звучат из приложения. Если они идут через колонки, микрофон их слышит и путает с саксофоном. В наушниках
              оценка будет точной. Подойдут любые закрытые наушники; можно надеть один наушник, если так удобнее.
            </p>
            <button className="btn big" onClick={next}>
              Понятно <ArrowRight />
            </button>
          </div>
        )}
        {cur === 'theme' && (
          <div className="col">
            <h2 className="center">Выберите оформление</h2>
            <div className="grid grid-3">
              {(Object.keys(THEMES) as ThemeId[]).filter((id) => !THEMES[id].unlockLevel).map((id) => {
                const t = THEMES[id];
                return (
                  <div
                    key={id}
                    className="card hover"
                    onClick={() => s.set({ theme: id })}
                    style={{ background: t.vars['--bg'], backgroundImage: t.vars['--bg-grad'], color: t.vars['--text'], border: s.theme === id ? `3px solid ${t.vars['--accent']}` : undefined }}
                  >
                    <div className="row" style={{ gap: 6 }}>
                      {['--accent', '--accent-2', '--accent-3'].map((v) => (
                        <span key={v} style={{ width: 22, height: 22, borderRadius: 7, background: t.vars[v] }} />
                      ))}
                    </div>
                    <b style={{ display: 'block', marginTop: 8 }}>{t.name}</b>
                  </div>
                );
              })}
            </div>
            <div className="center mt">
              <button className="btn big" onClick={next}>
                Дальше <ArrowRight />
              </button>
            </div>
          </div>
        )}
        {cur === 'ai' && <AiStep onNext={next} />}
        {cur === 'done' && (
          <div className="col center" style={{ alignItems: 'center' }}>
            <Mascot size={140} mood="wow" float />
            <h1>Всё готово!</h1>
            <p className="muted" style={{ maxWidth: 520 }}>
              Курс открывается шаг за шагом: следующий урок становится доступен, когда вы сдадите упражнения предыдущего. Если что-то уже умеете — сдайте экзамен
              модуля досрочно. Удачи — и пусть звук будет тёплым!
            </p>
            <button className="btn big" onClick={() => s.set({ onboardingDone: true })}>
              Начать первый урок 🎷
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MicStep({ onNext }: { onNext: () => void }) {
  const s = useSettings();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [err, setErr] = useState('');
  const [heard, setHeard] = useState<string | null>(null);
  const [phase, setPhase] = useState<'start' | 'quiet' | 'play'>('start');

  const begin = async (id?: string) => {
    setErr('');
    try {
      await audio.startMic(id || undefined);
      setDevices(await audio.listInputs());
      setPhase('quiet');
      const floor = await audio.measureNoise(2);
      const gate = Math.max(-68, Math.min(-40, floor + 10));
      s.set({ noiseFloorDb: Math.round(floor), gateDb: Math.round(gate) });
      audio.setGate(gate);
      setPhase('play');
    } catch (e: any) {
      setErr(e?.message || 'Ошибка микрофона');
    }
  };

  useEffect(() => {
    if (phase !== 'play') return;
    let stable = 0;
    let last = -1;
    const off = audio.onFrame((f) => {
      if (!f.voiced) return;
      const w = Math.round(concertToWritten(f.midi));
      stable = w === last ? stable + 1 : 0;
      last = w;
      if (stable === 10) setHeard(noteNameRu(w));
    });
    return off;
  }, [phase]);

  return (
    <div className="col">
      <h2 className="row">
        <Mic /> Микрофон
      </h2>
      {phase === 'start' && (
        <>
          <p className="muted">
            Подойдёт встроенный микрофон ноутбука, но USB-микрофон или клипса на раструб дадут точнее. Разрешите доступ к микрофону, когда Windows спросит.
          </p>
          <button className="btn big" onClick={() => begin(s.micDeviceId)}>
            Включить микрофон
          </button>
        </>
      )}
      {phase !== 'start' && (
        <>
          <div className="row">
            <span className="small" style={{ width: 110 }}>
              Устройство
            </span>
            <select
              className="grow"
              value={s.micDeviceId}
              onChange={(e) => {
                s.set({ micDeviceId: e.target.value });
                begin(e.target.value);
              }}
            >
              <option value="">По умолчанию</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || d.deviceId.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <LevelMeter />
          {phase === 'quiet' && <div className="card center">🤫 Секундочку тишины — измеряю фоновый шум…</div>}
          {phase === 'play' && (
            <div className="card center">
              {heard ? (
                <>
                  <div className="display" style={{ fontSize: 40, fontWeight: 800, color: 'var(--good)' }}>
                    {heard}
                  </div>
                  <div>Слышу вас отлично! 🎉</div>
                </>
              ) : (
                <div>🎷 Сыграйте на саксофоне любую ноту и подержите её пару секунд.</div>
              )}
            </div>
          )}
        </>
      )}
      {err && <div style={{ color: 'var(--bad)' }}>{err}</div>}
      <div className="row between mt">
        <button className="btn ghost" onClick={onNext}>
          Пропустить
        </button>
        <button className="btn" onClick={onNext} disabled={phase === 'start'}>
          Дальше <ArrowRight />
        </button>
      </div>
    </div>
  );
}

function AiStep({ onNext }: { onNext: () => void }) {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  return (
    <div className="col">
      <h2 className="row">
        <Sparkles color="var(--accent-3)" /> ИИ-наставник (по желанию)
      </h2>
      <p className="muted">
        Я сам слушаю и измеряю вашу игру. А с подключённым ИИ ещё и разбираю каждую попытку человеческим языком, отвечаю на вопросы в чате и составляю план занятий.
        Для этого нужен ключ сервиса OpenRouter.
      </p>
      <ol className="small" style={{ lineHeight: 1.8 }}>
        <li>
          Зарегистрируйтесь на{' '}
          <a href="#" onClick={(e) => (e.preventDefault(), platform.openExternal('https://openrouter.ai/keys'))}>
            openrouter.ai/keys <ExternalLink size={12} />
          </a>{' '}
          и создайте ключ (Create key).
        </li>
        <li>Пополните баланс на $5–10 — этого хватит на месяцы занятий. Есть и бесплатные модели (с лимитом запросов в день).</li>
        <li>Вставьте ключ сюда. Его можно добавить и позже в настройках.</li>
      </ol>
      <div className="row">
        <input type="password" className="grow" placeholder="sk-or-v1-…" value={key} onChange={(e) => setKey(e.target.value)} />
        <button
          className="btn"
          disabled={!key.trim()}
          onClick={async () => {
            await platform.ai.setKey(key.trim());
            setSaved(true);
            setKey('');
          }}
        >
          Сохранить
        </button>
      </div>
      {saved && <div style={{ color: 'var(--good)' }}>Ключ сохранён ✓</div>}
      <div className="row between mt">
        <button className="btn ghost" onClick={onNext}>
          Позже
        </button>
        <button className="btn" onClick={onNext}>
          Дальше <ArrowRight />
        </button>
      </div>
    </div>
  );
}
