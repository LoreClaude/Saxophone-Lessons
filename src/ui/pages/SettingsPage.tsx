import { useEffect, useMemo, useState } from 'react';
import { Mic, Palette, GraduationCap, Sparkles, Bell, Database, Info, Volume2, Timer, ExternalLink, CheckCircle2 } from 'lucide-react';
import { audio } from '../../audio/engine';
import { startSession } from '../../audio/backing';
import { segmentNotes, median } from '../../audio/segment';
import { useSettings } from '../../store/settings';
import { useProgress, progressSnapshot } from '../../store/progress';
import { db } from '../../store/db';
import { THEMES, type ThemeId } from '../../styles/themes';
import { platform, type ModelInfo } from '../../lib/platform';
import { fetchModels, recommendModels, monthSpend } from '../../ai/tutor';
import { toast } from '../../lib/toast';
import { Seg, Toggle } from '../components';
import { LevelMeter, LivePitch, FrameCollector } from '../practice/common';

export function SettingsPage() {
  const s = useSettings();
  return (
    <div className="page">
      <h1>Настройки</h1>
      <div className="col" style={{ gap: 18 }}>
        <MicSection />
        <LatencySection />
        <Section icon={<Volume2 />} title="Звук">
          <Slider label="Общая громкость" value={s.masterVolume} onChange={(v) => s.set({ masterVolume: v })} />
          <Slider label="Метроном" value={s.metronomeVolume} onChange={(v) => s.set({ metronomeVolume: v })} />
          <Slider label="Аккомпанемент" value={s.backingVolume} onChange={(v) => s.set({ backingVolume: v })} />
          <Slider label="Мелодия-образец" value={s.melodyVolume} onChange={(v) => s.set({ melodyVolume: v })} />
          <div className="row wrap" style={{ gap: 18 }}>
            <div className="row">
              <span className="small">Щелчок метронома</span>
              <Seg value={s.metronomeSound} onChange={(v) => s.set({ metronomeSound: v })} options={[['wood', 'Дерево'], ['click', 'Клик'], ['beep', 'Бип']]} />
            </div>
            <Toggle on={s.sfx} onChange={(v) => s.set({ sfx: v })} label="Игровые звуки" />
          </div>
        </Section>
        <ThemeSection />
        <Section icon={<GraduationCap />} title="Обучение">
          <div className="row wrap" style={{ gap: 18 }}>
            <div className="row">
              <span className="small">Строгость оценки</span>
              <Seg value={s.strictness} onChange={(v) => s.set({ strictness: v })} options={[['easy', 'Мягче'], ['normal', 'Обычная'], ['hard', 'Строже']]} />
            </div>
            <div className="row">
              <span className="small">Камертон ля</span>
              <Seg value={String(s.a4)} onChange={(v) => s.set({ a4: Number(v) })} options={[['440', '440'], ['441', '441'], ['442', '442'], ['443', '443']]} />
            </div>
          </div>
          <div className="small muted">
            Строгость зависит от уровня модуля (Новичок → Мастер): чем дальше по курсу, тем точнее нужно играть. Здесь можно сделать её чуть мягче или строже.
          </div>
          <div className="row wrap" style={{ gap: 22 }}>
            <Toggle on={s.showNoteNames} onChange={(v) => s.set({ showNoteNames: v })} label="Названия нот под нотами" />
            <Toggle on={s.showFingerings} onChange={(v) => s.set({ showFingerings: v })} label="Аппликатуры над нотами" />
            <Toggle on={s.tunerConcert} onChange={(v) => s.set({ tunerConcert: v })} label="Тюнер в концертном строе" />
            <Toggle on={s.keepRecordings} onChange={(v) => s.set({ keepRecordings: v })} label="Сохранять записи попыток" />
          </div>
          <div className="row">
            <span className="small">Цель на день</span>
            <input type="number" min={5} max={180} value={s.dailyGoalMin} onChange={(e) => s.set({ dailyGoalMin: Number(e.target.value) || 20 })} style={{ width: 90 }} />
            <span className="small muted">минут</span>
          </div>
          <div className="row">
            <span className="small">Как к вам обращаться</span>
            <input type="text" value={s.userName} onChange={(e) => s.set({ userName: e.target.value })} placeholder="Имя" />
          </div>
        </Section>
        <AiSection />
        <Section icon={<Bell />} title="Напоминания">
          <Toggle on={s.reminders.enabled} onChange={(v) => s.set({ reminders: { ...s.reminders, enabled: v } })} label="Напоминать о занятиях" />
          <div className="row wrap">
            <span className="small">Время</span>
            <input type="time" value={s.reminders.time} onChange={(e) => s.set({ reminders: { ...s.reminders, time: e.target.value } })} />
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d, i) => {
              const day = (i + 1) % 7;
              const on = s.reminders.days.includes(day);
              return (
                <button key={d} className={`btn ${on ? '' : 'ghost'}`} style={{ padding: '6px 10px' }} onClick={() => s.set({ reminders: { ...s.reminders, days: on ? s.reminders.days.filter((x) => x !== day) : [...s.reminders.days, day] } })}>
                  {d}
                </button>
              );
            })}
          </div>
          <Toggle on={s.minimizeToTray} onChange={(v) => s.set({ minimizeToTray: v })} label="При закрытии сворачивать в трей (чтобы напоминания приходили)" />
          <Toggle
            on={s.launchAtLogin}
            onChange={(v) => {
              s.set({ launchAtLogin: v });
              platform.setLaunchAtLogin(v);
            }}
            label="Запускать вместе с Windows (свёрнутым)"
          />
          {!platform.isElectron && <div className="tiny muted">Напоминания работают в приложении для Windows.</div>}
        </Section>
        <DataSection />
        <Section icon={<Info />} title="О программе">
          <AboutInfo />
        </Section>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card col" style={{ gap: 14 }}>
      <h2 className="row" style={{ margin: 0 }}>
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}

function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div className="row">
      <span className="small" style={{ width: 170 }}>
        {label}
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="small muted" style={{ width: 48 }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

function MicSection() {
  const s = useSettings();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [status, setStatus] = useState(audio.status);
  const [measuring, setMeasuring] = useState(false);
  const refresh = async () => setDevices(await audio.listInputs());
  useEffect(() => {
    audio.startMic(s.micDeviceId || undefined).then(refresh).catch(refresh);
    const off = audio.statusChanged.on((st) => {
      setStatus(st);
      refresh();
    });
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh);
    return () => {
      off();
      navigator.mediaDevices?.removeEventListener?.('devicechange', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const calibrate = async () => {
    setMeasuring(true);
    const floor = await audio.measureNoise(2);
    const gate = Math.max(-68, Math.min(-40, floor + 10));
    s.set({ noiseFloorDb: Math.round(floor), gateDb: Math.round(gate) });
    audio.setGate(gate);
    setMeasuring(false);
    toast('🎚️', 'Шум измерен', `Фон ${Math.round(floor)} дБ, порог звука ${Math.round(gate)} дБ`);
  };
  return (
    <Section icon={<Mic />} title="Микрофон">
      <div className="grid" style={{ gridTemplateColumns: '1fr 280px', gap: 18 }}>
        <div className="col" style={{ gap: 12 }}>
          <div className="row">
            <span className="small" style={{ width: 120 }}>
              Устройство
            </span>
            <select
              className="grow"
              value={s.micDeviceId}
              onChange={async (e) => {
                s.set({ micDeviceId: e.target.value });
                await audio.startMic(e.target.value || undefined).catch(() => {});
              }}
            >
              <option value="">По умолчанию (Windows)</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Микрофон ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <span className="small" style={{ width: 120 }}>
              Уровень
            </span>
            <div className="grow">
              <LevelMeter />
            </div>
          </div>
          <div className="row">
            <span className="small" style={{ width: 120 }}>
              Усиление
            </span>
            <input type="range" min={0.3} max={4} step={0.05} value={s.inputGain} onChange={(e) => s.set({ inputGain: Number(e.target.value) })} />
            <span className="small muted" style={{ width: 48 }}>
              ×{s.inputGain.toFixed(1)}
            </span>
          </div>
          <div className="row wrap">
            <button className="btn ghost" onClick={calibrate} disabled={measuring || status !== 'on'}>
              {measuring ? 'Тишина… измеряю' : 'Измерить фоновый шум (2 с тишины)'}
            </button>
            <span className="small muted">
              Фон: {s.noiseFloorDb} дБ · порог звука: {s.gateDb} дБ
            </span>
          </div>
          {status === 'error' && <div className="small" style={{ color: 'var(--bad)' }}>{audio.error}</div>}
          <div className="small muted">
            Совет: играйте в наушниках — тогда аккомпанемент и метроном не попадают в микрофон. Если звук «обрезается» на долгих нотах, отключите в Windows
            «улучшения звука» и шумоподавление для микрофона (Параметры → Система → Звук → Свойства устройства).
          </div>
        </div>
        <LivePitch />
      </div>
    </Section>
  );
}

function LatencySection() {
  const s = useSettings();
  const [state, setState] = useState<'idle' | 'run' | 'done'>('idle');
  const [beat, setBeat] = useState(-1);
  const lat = audio.latency();
  const run = async () => {
    setState('run');
    await audio.startMic(s.micDeviceId || undefined).catch(() => {});
    const col = new FrameCollector();
    const sess = await startSession({ bpm: 80, beatsPerBar: 4, countInBars: 1, totalBeats: 8, metronome: true, metronomeVolume: s.metronomeVolume, onBeat: setBeat });
    col.start();
    await new Promise((r) => setTimeout(r, ((sess.t0 - audio.now()) + 8 * 0.75 + 0.8) * 1000));
    sess.stop();
    const notes = segmentNotes(col.stop());
    const offsets: number[] = [];
    for (let k = 0; k < 8; k++) {
      const t = sess.beatToTime(k);
      const near = notes.reduce<number | null>((best, nt) => {
        const d = nt.start - t;
        return Math.abs(d) < 0.3 && (best === null || Math.abs(d) < Math.abs(best)) ? d : best;
      }, null);
      if (near !== null) offsets.push(near);
    }
    setBeat(-1);
    if (offsets.length < 4) {
      toast('⚠️', 'Не получилось', 'Мы услышали слишком мало нот. Играйте короткие ноты ровно со щелчками.');
      setState('idle');
      return;
    }
    const total = median(offsets);
    const extra = Math.round((total - (lat.output + lat.input)) * 1000);
    s.set({ latencyMs: Math.max(-150, Math.min(400, extra)) });
    toast('⏱️', 'Задержка откалибрована', `Общая задержка ≈ ${Math.round(total * 1000)} мс`);
    setState('done');
  };
  return (
    <Section icon={<Timer />} title="Задержка звука (для оценки ритма)">
      <div className="small muted">
        Звук идёт до наушников и обратно в микрофон с небольшой задержкой. Калибровка: после отсчёта сыграйте 8 коротких нот ровно вместе со щелчками
        метронома — приложение учтёт задержку при оценке ритма.
      </div>
      <div className="row wrap">
        <button className="btn" onClick={run} disabled={state === 'run'}>
          {state === 'run' ? `Играйте вместе со щелчками… ${beat >= 0 ? beat + 1 : ''}` : 'Откалибровать'}
        </button>
        {state === 'done' && <CheckCircle2 color="var(--good)" />}
        <span className="small muted">
          Оценка устройства: {Math.round((lat.output + lat.input) * 1000)} мс · поправка: {s.latencyMs} мс
        </span>
      </div>
      <div className="row">
        <span className="small" style={{ width: 170 }}>
          Поправка вручную
        </span>
        <input type="range" min={-150} max={400} step={5} value={s.latencyMs} onChange={(e) => s.set({ latencyMs: Number(e.target.value) })} />
        <span className="small muted" style={{ width: 70 }}>
          {s.latencyMs} мс
        </span>
      </div>
    </Section>
  );
}

function ThemeSection() {
  const s = useSettings();
  return (
    <Section icon={<Palette />} title="Оформление">
      <div className="grid grid-3">
        {(Object.keys(THEMES) as ThemeId[]).map((id) => {
          const t = THEMES[id];
          return (
            <div
              key={id}
              className="card hover"
              onClick={() => s.set({ theme: id })}
              style={{ padding: 14, background: t.vars['--bg'], backgroundImage: t.vars['--bg-grad'], color: t.vars['--text'], border: s.theme === id ? `2px solid ${t.vars['--accent']}` : undefined }}
            >
              <div className="row" style={{ gap: 6 }}>
                {['--accent', '--accent-2', '--accent-3', '--good'].map((v) => (
                  <span key={v} style={{ width: 22, height: 22, borderRadius: 7, background: t.vars[v] }} />
                ))}
              </div>
              <b style={{ display: 'block', marginTop: 8 }}>{t.name}</b>
              <div className="tiny" style={{ opacity: 0.8 }}>
                {t.description}
              </div>
            </div>
          );
        })}
      </div>
      <Toggle on={s.animations} onChange={(v) => s.set({ animations: v })} label="Анимации и конфетти" />
    </Section>
  );
}

function AiSection() {
  const s = useSettings();
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [filter, setFilter] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    platform.ai.hasKey().then(setHasKey);
  }, []);
  const load = async (force = false) => {
    setLoading(true);
    try {
      setModels(await fetchModels(force));
    } catch (e: any) {
      setInfo(e?.message || 'Не удалось загрузить список моделей (нет интернета?)');
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);
  const save = async () => {
    await platform.ai.setKey(key.trim());
    setHasKey(Boolean(key.trim()));
    setKey('');
    toast('🔑', 'Ключ сохранён', 'Ключ хранится в зашифрованном виде на этом компьютере.');
    test();
  };
  const test = async () => {
    setInfo('Проверяю ключ…');
    try {
      const k = await platform.ai.keyInfo();
      const left = k?.limit_remaining ?? k?.limit ?? null;
      setInfo(`Ключ работает ✓${k?.usage !== undefined ? ` · потрачено всего: $${Number(k.usage).toFixed(2)}` : ''}${left !== null && left !== undefined ? ` · лимит: $${Number(left).toFixed(2)}` : ''}${k?.is_free_tier ? ' · бесплатный тариф' : ''}`);
    } catch (e: any) {
      setInfo(e?.message || 'Ключ не работает');
    }
  };
  const rec = useMemo(() => recommendModels(models), [models]);
  const shown = useMemo(() => {
    const f = filter.toLowerCase();
    const list = models.filter((m) => !f || m.id.toLowerCase().includes(f) || m.name.toLowerCase().includes(f));
    return list.slice(0, 300);
  }, [models, filter]);
  const price = (m: ModelInfo) => (m.promptPrice === 0 && m.completionPrice === 0 ? 'бесплатно' : `$${(m.promptPrice * 1e6).toFixed(2)} / $${(m.completionPrice * 1e6).toFixed(2)} за 1 млн токенов`);
  const perAttempt = (m: ModelInfo) => m.promptPrice * 1800 + m.completionPrice * 350;

  return (
    <Section icon={<Sparkles />} title="ИИ-наставник (OpenRouter)">
      <Toggle on={s.ai.enabled} onChange={(v) => s.setAi({ enabled: v })} label="Включить ИИ-наставника Бибопа" />
      <div className="small muted">
        Измерения (ноты, интонация, ритм) делает само приложение на вашем компьютере. ИИ получает только результаты измерений (и, по желанию, короткую запись) и
        превращает их в живые советы. Нужен ключ{' '}
        <a href="#" onClick={(e) => (e.preventDefault(), platform.openExternal('https://openrouter.ai/keys'))}>
          OpenRouter <ExternalLink size={12} />
        </a>
        . Ключ хранится зашифрованным только на этом компьютере.
      </div>
      <div className="row">
        <input type="password" className="grow" placeholder={hasKey ? 'Ключ сохранён (введите новый, чтобы заменить)' : 'sk-or-v1-…'} value={key} onChange={(e) => setKey(e.target.value)} />
        <button className="btn" onClick={save} disabled={!key.trim()}>
          Сохранить
        </button>
        {hasKey && (
          <button className="btn ghost" onClick={test}>
            Проверить
          </button>
        )}
        {hasKey && (
          <button
            className="btn ghost"
            onClick={async () => {
              await platform.ai.setKey('');
              setHasKey(false);
              setInfo('Ключ удалён');
            }}
          >
            Удалить
          </button>
        )}
      </div>
      {info && <div className="small">{info}</div>}
      <div className="row">
        <span className="small" style={{ width: 120 }}>
          Модель
        </span>
        <b className="grow">{s.ai.model || 'выберется автоматически'}</b>
        <button className="btn ghost" onClick={() => load(true)} disabled={loading}>
          {loading ? 'Загрузка…' : 'Обновить список'}
        </button>
      </div>
      {rec.length > 0 && (
        <div className="col" style={{ gap: 8 }}>
          <div className="small muted">Рекомендуемые (быстрые, недорогие, хорошо пишут по-русски):</div>
          <div className="row wrap">
            {rec.map((m) => (
              <button key={m.id} className={`btn ${s.ai.model === m.id ? '' : 'ghost'}`} onClick={() => s.setAi({ model: m.id })} title={price(m)}>
                {m.name} · ≈${perAttempt(m).toFixed(4)} за разбор
              </button>
            ))}
          </div>
        </div>
      )}
      {models.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer' }}>Все модели ({models.length})</summary>
          <input type="text" placeholder="Поиск: claude, gemini, gpt, free…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: '100%', margin: '10px 0' }} />
          <div className="col" style={{ gap: 4, maxHeight: 320, overflowY: 'auto' }}>
            {shown.map((m) => (
              <div key={m.id} className="row between card" style={{ padding: '8px 12px', cursor: 'pointer', borderColor: s.ai.model === m.id ? 'var(--accent)' : undefined }} onClick={() => s.setAi({ model: m.id })}>
                <div>
                  <b>{m.name}</b>
                  <div className="tiny muted">
                    {m.id}
                    {m.inputModalities.includes('audio') ? ' · 🎧 понимает аудио' : ''}
                  </div>
                </div>
                <span className="tiny muted">{price(m)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="row wrap" style={{ gap: 22 }}>
        <Toggle on={s.ai.autoFeedback} onChange={(v) => s.setAi({ autoFeedback: v })} label="Разбор после каждого упражнения" />
        <Toggle on={s.ai.sendAudio} onChange={(v) => s.setAi({ sendAudio: v })} label="Отправлять запись попытки (для моделей с 🎧)" />
      </div>
      <div className="row">
        <span className="small">Лимит расходов в месяц, $</span>
        <input type="number" min={0} step={1} value={s.ai.budgetUsd} onChange={(e) => s.setAi({ budgetUsd: Number(e.target.value) || 0 })} style={{ width: 90 }} />
        <span className="small muted">потрачено в этом месяце: ${monthSpend().toFixed(3)} (0 — без лимита)</span>
      </div>
    </Section>
  );
}

function DataSection() {
  const reset = useProgress((s) => s.reset);
  const importState = useProgress((s) => s.importState);
  const [recCount, setRecCount] = useState(0);
  useEffect(() => {
    db.recordings.count().then(setRecCount);
  }, []);
  const exportData = async () => {
    const data = {
      app: 'saxophonia',
      version: 1,
      date: new Date().toISOString(),
      progress: progressSnapshot(),
      settings: { ...useSettings.getState() },
      attempts: await db.attempts.toArray(),
      pieces: await db.pieces.toArray(),
      userLessons: await db.userLessons.toArray(),
      diary: await db.diary.toArray(),
      chat: await db.chat.toArray(),
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `saxophonia-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'saxophonia') throw new Error('Это не файл «Саксофонии»');
      importState(data.progress);
      await db.transaction('rw', [db.attempts, db.pieces, db.userLessons, db.diary, db.chat], async () => {
        await db.attempts.bulkPut(data.attempts ?? []);
        await db.pieces.bulkPut(data.pieces ?? []);
        await db.userLessons.bulkPut(data.userLessons ?? []);
        await db.diary.bulkPut(data.diary ?? []);
        await db.chat.bulkPut(data.chat ?? []);
      });
      toast('📦', 'Прогресс загружен');
    } catch (e: any) {
      toast('⚠️', 'Ошибка импорта', e?.message);
    }
  };
  return (
    <Section icon={<Database />} title="Данные">
      <div className="row wrap">
        <button className="btn ghost" onClick={exportData}>
          Сохранить резервную копию
        </button>
        <label className="btn ghost">
          Загрузить из копии
          <input type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        </label>
        <button
          className="btn ghost"
          onClick={async () => {
            await db.recordings.clear();
            setRecCount(0);
            toast('🗑️', 'Записи удалены');
          }}
        >
          Удалить записи ({recCount})
        </button>
        <button
          className="btn danger"
          onClick={async () => {
            if (!window.confirm('Сбросить весь прогресс? Это нельзя отменить.')) return;
            reset();
            await db.attempts.clear();
            toast('♻️', 'Прогресс сброшен');
          }}
        >
          Сбросить прогресс
        </button>
      </div>
    </Section>
  );
}

function AboutInfo() {
  const [v, setV] = useState('');
  useEffect(() => {
    platform.version().then(setV);
  }, []);
  return (
    <div className="small muted">
      «Саксофония» {v} — обучающее приложение для альт-саксофона. Код — лицензия MIT. Сэмплы саксофона, фортепиано и баса — проект tonejs-instruments (CC BY 3.0:
      Karoryfer Samples, VSCO 2 CE). Шрифты Rubik и Unbounded — SIL Open Font License.
    </div>
  );
}
