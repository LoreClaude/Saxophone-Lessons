// End-to-end check in Chromium with a real alto-sax recording as the microphone.
// Usage: npm run build:web && npx vite preview --port 4173 & node e2e/run.mjs [baseUrl] [wav] [outDir]
// The WAV must contain a sustained written B4 (concert D4) — e.g. public/samples/sax/D4.mp3
// converted with: ffmpeg -i public/samples/sax/D4.mp3 -ac 1 -ar 48000 b4.wav
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [base = 'http://localhost:4173/', wav, out = 'e2e/out'] = process.argv.slice(2);
if (!wav) throw new Error('Pass a WAV file with a sustained written B4');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`, '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const fail = (m) => {
  console.error('FAIL:', m);
  process.exitCode = 1;
};

await page.goto(base);
// skip onboarding, unlock lesson 1.4
await page.evaluate(() => {
  localStorage.setItem('sax.settings', JSON.stringify({ state: { onboardingDone: true, ai: { enabled: false, model: '', autoFeedback: false, sendAudio: false, budgetUsd: 5 } }, version: 1 }));
  const done = { completed: true, quizBest: 100 };
  localStorage.setItem('sax.progress', JSON.stringify({ state: { lessons: { 'm01-l1': done, 'm01-l2': done, 'm01-l3': done } }, version: 1 }));
});
await page.reload();

// 1) tuner recognizes the written note
await page.goto(base + '#/tuner');
await page.waitForTimeout(2500);
const tuner = await page.locator('.tuner-note').innerText();
console.log('tuner shows:', tuner);
if (tuner.trim() !== 'Си') fail(`tuner expected «Си», got «${tuner}»`);

// 2) long tone exercise end-to-end
await page.goto(base + '#/exercise/m01-l4/lt-b');
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Начать/ }).first().click();
await page.waitForSelector('.result-hero', { timeout: 20000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/longtone-levelup.png` });
const ura = page.getByRole('button', { name: 'Ура!' });
if (await ura.count()) await ura.click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/longtone-result.png` });
const score = Number((await page.locator('.result-hero .val').first().innerText()).replace(/\D/g, ''));
console.log('long tone score:', score);
if (!(score >= 70)) fail(`long tone score too low: ${score}`);

// 3) progress was saved
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sax.progress') || '{}').state?.exercises?.['m01-l4/lt-b']);
console.log('saved progress:', JSON.stringify(saved));
if (!saved?.passed) fail('exercise was not marked as passed');

// 4) a sequence exercise page renders notation with overlays
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('sax.progress'));
  p.state.lessons['m01-l4'] = { completed: true, quizBest: 100 };
  localStorage.setItem('sax.progress', JSON.stringify(p));
});
await page.goto(base + '#/');
await page.reload();
await page.goto(base + '#/exercise/m01-l5/tongue1');
await page.waitForTimeout(1500);
const notes = await page.locator('.staff-wrap svg .abcjs-note').count();
console.log('rendered notes:', notes);
if (notes < 10) fail('notation not rendered');
await page.screenshot({ path: `${out}/sequence.png` });

// 5) the content area scrolls in a small window
await page.setViewportSize({ width: 1100, height: 650 });
await page.goto(base + '#/lesson/m01-l1');
await page.waitForTimeout(800);
const scrolled = await page.evaluate(() => {
  const c = document.getElementById('content');
  c.scrollTop = 4000;
  return c.scrollTop;
});
console.log('content scrollTop after scrolling:', scrolled);
if (!(scrolled > 100)) fail('page does not scroll in a small window');

if (errors.length) fail(`page errors: ${errors.join('; ')}`);
console.log(process.exitCode ? 'E2E FAILED' : 'E2E OK');
await browser.close();
