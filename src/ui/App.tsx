import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import {
  Map as MapIcon,
  Dumbbell,
  Gauge,
  Timer,
  Music2,
  Hand,
  MessageCircle,
  BarChart3,
  FolderOpen,
  Settings as SettingsIcon,
  Flame,
  Target,
  Mic,
  Gift,
} from 'lucide-react';
import { useRoute, navigate } from '../lib/router';
import { useSettings } from '../store/settings';
import { useProgress } from '../store/progress';
import { applyTheme } from '../styles/themes';
import { levelFromXp, rankFor } from '../game/levels';
import { useToasts } from '../lib/toast';
import { audio, type MicStatus } from '../audio/engine';
import { startPracticeTimer } from '../lib/practiceTimer';
import { platform } from '../lib/platform';
import { todayKey } from '../store/db';
import { Bar, Mascot, Modal, SaxIcon } from './components';
import { Home } from './pages/Home';
import { LessonPage } from './pages/LessonPage';
import { ExercisePage } from './pages/ExercisePage';
import { ExamPage } from './pages/ExamPage';
import { PracticeHub } from './pages/PracticeHub';
import { TunerPage } from './pages/TunerPage';
import { MetronomePage } from './pages/MetronomePage';
import { DronePage } from './pages/DronePage';
import { FingeringPage } from './pages/FingeringPage';
import { TutorPage } from './pages/TutorPage';
import { ProgressPage } from './pages/ProgressPage';
import { MyMusicPage } from './pages/MyMusicPage';
import { SettingsPage } from './pages/SettingsPage';
import { Onboarding } from './pages/Onboarding';
import { WarmupPage } from './pages/WarmupPage';
import { PiecePage } from './pages/PiecePage';
import { UserLessonPage } from './pages/UserLessonPage';
import { DiaryPage } from './pages/DiaryPage';
import { RewardsPage, BonusPage } from './pages/RewardsPage';
import { rewardsBetween } from '../content/rewards';

const NAV: { path: string; label: string; icon: ReactElement; match: string }[] = [
  { path: '/', label: 'Путь к джазу', icon: <MapIcon size={20} />, match: '' },
  { path: '/practice', label: 'Практика', icon: <Dumbbell size={20} />, match: 'practice' },
  { path: '/tutor', label: 'Наставник', icon: <MessageCircle size={20} />, match: 'tutor' },
  { path: '/progress', label: 'Прогресс', icon: <BarChart3 size={20} />, match: 'progress' },
  { path: '/rewards', label: 'Награды', icon: <Gift size={20} />, match: 'rewards' },
];
const TOOLS: { path: string; label: string; icon: ReactElement; match: string }[] = [
  { path: '/tuner', label: 'Тюнер', icon: <Gauge size={20} />, match: 'tuner' },
  { path: '/metronome', label: 'Метроном', icon: <Timer size={20} />, match: 'metronome' },
  { path: '/drone', label: 'Бурдон', icon: <Music2 size={20} />, match: 'drone' },
  { path: '/fingering', label: 'Аппликатуры', icon: <Hand size={20} />, match: 'fingering' },
  { path: '/my', label: 'Мои ноты и уроки', icon: <FolderOpen size={20} />, match: 'my' },
];

export function App() {
  const route = useRoute();
  const settings = useSettings();
  const ensureToday = useProgress((s) => s.ensureToday);
  const levelUp = useToasts((s) => s.levelUp);
  const setLevelUp = useToasts((s) => s.setLevelUp);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);
  useEffect(() => {
    document.documentElement.classList.toggle('no-anim', !settings.animations);
  }, [settings.animations]);
  useEffect(() => {
    ensureToday(settings.dailyGoalMin);
    const t = setInterval(() => ensureToday(useSettings.getState().dailyGoalMin), 60_000);
    return () => clearInterval(t);
  }, [ensureToday, settings.dailyGoalMin]);
  useEffect(() => {
    audio.setA4(settings.a4);
    audio.setGate(settings.gateDb);
    audio.setInputGain(settings.inputGain);
  }, [settings.a4, settings.gateDb, settings.inputGain]);
  useEffect(() => {
    if (audio.master) audio.master.gain.value = settings.masterVolume;
  }, [settings.masterVolume]);
  useEffect(() => {
    startPracticeTimer();
    platform.setReminders({ ...settings.reminders, minimizeToTray: settings.minimizeToTray });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.reminders, settings.minimizeToTray]);
  useEffect(() => {
    // the AudioContext may only start after a user gesture
    const resume = () => {
      audio.ensureContext().then(() => {
        audio.master.gain.value = useSettings.getState().masterVolume;
      });
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }, []);

  if (!settings.onboardingDone && route.parts[0] !== 'settings') {
    return <Onboarding />;
  }

  const p = route.parts;
  let page: ReactElement;
  switch (p[0]) {
    case undefined:
      page = <Home />;
      break;
    case 'lesson':
      page = <LessonPage id={p[1]} />;
      break;
    case 'exercise':
      page = <ExercisePage lessonId={p[1]} exerciseId={p[2]} />;
      break;
    case 'exam':
      page = <ExamPage moduleId={p[1]} />;
      break;
    case 'practice':
      page = <PracticeHub />;
      break;
    case 'warmup':
      page = <WarmupPage />;
      break;
    case 'tuner':
      page = <TunerPage />;
      break;
    case 'metronome':
      page = <MetronomePage />;
      break;
    case 'drone':
      page = <DronePage />;
      break;
    case 'fingering':
      page = <FingeringPage />;
      break;
    case 'tutor':
      page = <TutorPage />;
      break;
    case 'progress':
      page = <ProgressPage />;
      break;
    case 'diary':
      page = <DiaryPage />;
      break;
    case 'my':
      page = p[1] === 'piece' ? <PiecePage id={Number(p[2])} /> : p[1] === 'lesson' ? <UserLessonPage id={p[2]} /> : <MyMusicPage />;
      break;
    case 'settings':
      page = <SettingsPage />;
      break;
    case 'rewards':
      page = <RewardsPage />;
      break;
    case 'bonus':
      page = <BonusPage id={p[1]} />;
      break;
    default:
      page = <Home />;
  }

  const isActive = (m: string) => (m === '' ? p.length === 0 || p[0] === 'lesson' || p[0] === 'exercise' || p[0] === 'exam' : p[0] === m);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            <SaxIcon size={24} color="#fff" />
          </div>
          <span>Саксофония</span>
        </div>
        {NAV.map((it) => (
          <button key={it.path} className={`nav-item ${isActive(it.match) ? 'active' : ''}`} onClick={() => navigate(it.path)}>
            {it.icon}
            <span>{it.label}</span>
          </button>
        ))}
        <div className="nav-sep" />
        {TOOLS.map((it) => (
          <button key={it.path} className={`nav-item ${isActive(it.match) ? 'active' : ''}`} onClick={() => navigate(it.path)}>
            {it.icon}
            <span>{it.label}</span>
          </button>
        ))}
        <div className="grow" />
        <button className={`nav-item ${isActive('settings') ? 'active' : ''}`} onClick={() => navigate('/settings')}>
          <SettingsIcon size={20} />
          <span>Настройки</span>
        </button>
      </aside>
      <div className="main">
        <TopBar />
        <div className="content" id="content">
          {page}
        </div>
      </div>
      <Toasts />
      {levelUp && (
        <Modal onClose={() => setLevelUp(null)}>
          <div className="col center" style={{ alignItems: 'center' }}>
            <Mascot size={130} mood="wow" float />
            <div className="muted display">Новый уровень!</div>
            <div className="display gradient-text" style={{ fontSize: 72, fontWeight: 800, lineHeight: 1 }}>
              {levelUp.level}
            </div>
            <h2>{levelUp.rank}</h2>
            {rewardsBetween(levelUp.from, levelUp.level).length > 0 ? (
              <div className="col" style={{ width: '100%', gap: 10 }}>
                {rewardsBetween(levelUp.from, levelUp.level).map((r) => (
                  <div key={r.id} className="card row between" style={{ padding: 14, borderColor: 'var(--accent-3)' }}>
                    <div style={{ textAlign: 'left' }}>
                      <div className="tiny muted">{r.kind === 'melody' ? '🎁 Открыта новая мелодия' : '🎁 Открыта новая тема оформления'}</div>
                      <b>{r.title}</b>
                    </div>
                    {r.kind === 'melody' ? (
                      <button
                        className="btn"
                        onClick={() => {
                          setLevelUp(null);
                          navigate(`/bonus/${r.id}`);
                        }}
                      >
                        Сыграть
                      </button>
                    ) : (
                      <button
                        className="btn"
                        onClick={() => {
                          useSettings.getState().set({ theme: r.theme });
                          setLevelUp(null);
                        }}
                      >
                        Включить
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Так держать! Каждый уровень — это часы честной практики.</p>
            )}
            <button className="btn big mt" onClick={() => setLevelUp(null)}>
              Ура!
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TopBar() {
  const xp = useProgress((s) => s.xp);
  const streak = useProgress((s) => s.streak);
  const quests = useProgress((s) => s.quests);
  const today = useProgress((s) => s.days[todayKey()]);
  const goal = useSettings((s) => s.dailyGoalMin);
  const [mic, setMic] = useState<MicStatus>(audio.status);
  const [level, setLevel] = useState(-100);
  const [showQuests, setShowQuests] = useState(false);
  useEffect(() => audio.statusChanged.on(setMic), []);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 80) {
        last = t;
        setLevel(audio.status === 'on' && audio.lastFrame ? audio.lastFrame.db : -100);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const lv = levelFromXp(xp);
  const minutes = Math.floor((today?.seconds ?? 0) / 60);
  const alive = streak.lastDay === todayKey();
  const doneQuests = quests.items.filter((q) => q.done).length;
  return (
    <div className="topbar">
      <div className="level-pill">
        <div className="level-badge">{lv.level}</div>
        <div className="grow">
          <div className="row between small">
            <b>{rankFor(lv.level)}</b>
            <span className="muted">
              {lv.into}/{lv.need} XP
            </span>
          </div>
          <Bar value={lv.progress * 100} thin />
        </div>
      </div>
      <div className={`streak ${alive ? '' : 'dead'}`} title="Дней подряд с занятиями">
        <Flame size={22} color="var(--accent-3)" /> {streak.current}
      </div>
      <div className="row small" title="Минут практики сегодня">
        <Timer size={18} color="var(--accent-2)" />
        <span>
          <b>{minutes}</b>
          <span className="muted"> / {goal} мин</span>
        </span>
      </div>
      <button className="btn ghost" onClick={() => setShowQuests(true)} title="Задания дня">
        <Target size={18} /> Задания {doneQuests}/{quests.items.length}
      </button>
      <div className="grow" />
      <div className="row small" title={audio.error || audio.deviceLabel || 'Микрофон'} style={{ cursor: 'pointer' }} onClick={() => navigate('/settings')}>
        <Mic size={18} />
        <div className={`mic-dot ${mic === 'on' ? 'on' : mic === 'error' ? 'error' : ''}`} />
        <div style={{ width: 70 }}>
          <Bar value={mic === 'on' ? Math.max(0, (level + 70) * 1.6) : 0} thin />
        </div>
      </div>
      {showQuests && (
        <Modal onClose={() => setShowQuests(false)}>
          <div className="row" style={{ gap: 16 }}>
            <Mascot size={80} mood="cool" />
            <div>
              <h2>Задания дня</h2>
              <p className="muted">Выполните все три — получите бонус +60 XP. Новые задания появляются каждый день.</p>
            </div>
          </div>
          <div className="col mt">
            {quests.items.map((q) => (
              <div key={q.id} className="card" style={{ padding: 14 }}>
                <div className="row between">
                  <b>{q.done ? '✅ ' : '🎯 '}{q.title}</b>
                  <span className="chip accent">+{q.xp} XP</span>
                </div>
                <div className="mt" style={{ marginTop: 8 }}>
                  <Bar value={(100 * q.progress) / q.target} />
                </div>
                <div className="tiny muted mt" style={{ marginTop: 4 }}>
                  {Math.floor(q.progress)} / {q.target}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toast" onClick={() => dismiss(t.id)}>
          <div className="ic">{t.icon}</div>
          <div>
            <b>{t.title}</b>
            {t.text && <div className="small muted">{t.text}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
