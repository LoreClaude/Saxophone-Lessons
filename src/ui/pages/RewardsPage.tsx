import { Gift, Lock, Play, Palette, Music, ArrowLeft } from 'lucide-react';
import { REWARDS, findBonus, nextReward } from '../../content/rewards';
import { useProgress } from '../../store/progress';
import { useSettings } from '../../store/settings';
import { levelFromXp, xpForLevel } from '../../game/levels';
import { navigate } from '../../lib/router';
import { STYLE_NAMES } from '../../audio/backing';
import { Bar, Mascot, Stars } from '../components';
import { ExerciseRunner } from '../practice/Runner';
import type { SequenceExercise } from '../../practice/types';

export function RewardsPage() {
  const xp = useProgress((s) => s.xp);
  const exercises = useProgress((s) => s.exercises);
  const theme = useSettings((s) => s.theme);
  const setSettings = useSettings((s) => s.set);
  const lv = levelFromXp(xp);
  const next = nextReward(lv.level);
  const toNext = next ? Math.max(0, xpForLevel(next.level) - xp) : 0;

  return (
    <div className="page">
      <h1>
        <Gift color="var(--accent-3)" /> Награды
      </h1>
      <p className="muted">С каждым новым уровнем открываются бонусные мелодии с аккомпанементом и особая тема оформления. Уровень растёт от опыта (XP) за упражнения, тесты, разминки и задания дня.</p>
      {next && (
        <div className="card glow row" style={{ gap: 18 }}>
          <Mascot size={80} mood="cool" />
          <div className="grow">
            <div className="small muted">Следующая награда — на {next.level} уровне</div>
            <h2 style={{ margin: '4px 0' }}>{next.kind === 'melody' ? `🎵 ${next.title}` : `🎨 ${next.title}`}</h2>
            <Bar value={(100 * (xp - xpForLevel(lv.level))) / Math.max(1, xpForLevel(next.level) - xpForLevel(lv.level))} />
            <div className="tiny muted mt" style={{ marginTop: 4 }}>
              Осталось {toNext} XP
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-2 mt">
        {REWARDS.map((r) => {
          const open = lv.level >= r.level;
          const ep = r.kind === 'melody' ? exercises[`bonus/${r.id}`] : undefined;
          return (
            <div key={r.id} className={`card ${open ? 'hover' : ''}`} style={{ opacity: open ? 1 : 0.55 }} onClick={() => open && r.kind === 'melody' && navigate(`/bonus/${r.id}`)}>
              <div className="row between">
                <span className="chip">{open ? `Уровень ${r.level}` : `🔒 Уровень ${r.level}`}</span>
                {r.kind === 'melody' ? <Music size={18} /> : <Palette size={18} />}
              </div>
              <h3 style={{ margin: '8px 0 4px' }}>{r.title}</h3>
              <div className="small muted">{r.description}</div>
              {r.kind === 'melody' && (
                <div className="tiny muted mt" style={{ marginTop: 6 }}>
                  {r.style ? `${STYLE_NAMES[r.style]} · ` : ''}
                  {r.bpm} уд/мин · понадобятся: {r.needs}
                </div>
              )}
              <div className="row between mt">
                {r.kind === 'melody' ? (
                  <>
                    <Stars n={ep?.stars ?? 0} size={15} />
                    {open ? (
                      <button className="btn" onClick={(e) => (e.stopPropagation(), navigate(`/bonus/${r.id}`))}>
                        <Play size={16} /> Играть
                      </button>
                    ) : (
                      <Lock size={18} />
                    )}
                  </>
                ) : open ? (
                  <button className="btn" disabled={theme === r.theme} onClick={() => setSettings({ theme: r.theme })}>
                    {theme === r.theme ? 'Тема включена' : 'Включить тему'}
                  </button>
                ) : (
                  <Lock size={18} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BonusPage({ id }: { id: string }) {
  const piece = findBonus(id);
  const xp = useProgress((s) => s.xp);
  if (!piece) return <div className="page">Мелодия не найдена.</div>;
  if (levelFromXp(xp).level < piece.level)
    return (
      <div className="page center col" style={{ alignItems: 'center', paddingTop: 60 }}>
        <Lock size={48} />
        <h2>Мелодия откроется на {piece.level} уровне</h2>
        <button className="btn" onClick={() => navigate('/rewards')}>
          К наградам
        </button>
      </div>
    );
  const ex: SequenceExercise = {
    id: piece.id,
    kind: 'sequence',
    title: piece.title,
    goal: `${piece.description} Понадобятся ноты: ${piece.needs}. Начните в режиме «ожидание» или в медленном темпе.`,
    abc: piece.abc,
    bpm: piece.bpm,
    modes: ['tempo', 'wait'],
    metronome: !piece.style,
    style: piece.style,
    chords: piece.chords,
    swing: piece.swing,
    showNames: true,
    xp: 40,
  };
  return (
    <div className="page page-wide">
      <button className="btn ghost mb" onClick={() => navigate('/rewards')}>
        <ArrowLeft size={18} /> Награды
      </button>
      <ExerciseRunner ex={ex} ctx={{ exerciseKey: `bonus/${piece.id}`, lessonId: 'bonus', lessonTitle: 'Бонусные мелодии', tier: piece.tier }} />
    </div>
  );
}
