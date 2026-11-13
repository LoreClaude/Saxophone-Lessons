// Counts real playing time: every 10 s, if the microphone heard the
// instrument for at least a second, 10 s of practice are added.
import { audio } from '../audio/engine';
import { useProgress } from '../store/progress';
import { celebrate } from './toast';

let started = false;

export function startPracticeTimer() {
  if (started) return;
  started = true;
  let voicedFrames = 0;
  let hop = 0.0107;
  let lastT = 0;
  audio.onFrame((f) => {
    if (lastT) hop = Math.min(0.05, Math.max(0.005, f.t - lastT));
    lastT = f.t;
    if (f.voiced || f.db > -45) voicedFrames++;
  });
  setInterval(() => {
    const voicedSec = voicedFrames * hop;
    voicedFrames = 0;
    if (audio.status === 'on' && voicedSec >= 1) {
      const ach = useProgress.getState().addPracticeSeconds(10);
      if (ach.length) celebrate({ xpGained: 0, levelBefore: 0, levelAfter: 0, newAchievements: ach, questsDone: [], firstPass: false, newBest: false });
    }
  }, 10_000);
}
