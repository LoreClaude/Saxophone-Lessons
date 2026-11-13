// Smoke test + screenshots of the main pages in Chromium with a fake microphone.
// Usage: node e2e/screens.mjs <baseUrl> <outDir> <fakeMicWav>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [base = 'http://localhost:4173/', out = 'e2e/out', wav = ''] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
if (wav) args.push(`--use-file-for-fake-audio-capture=${wav}`);
const browser = await chromium.launch({ args });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror @${page.url()}: ${e.message} ${(e.stack || '').split('\n').slice(1, 4).join(' / ')}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

const shot = async (name) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('shot', name);
};

await page.goto(base);
await shot('01-onboarding');
await page.getByPlaceholder('Как к вам обращаться?').fill('Тест');
await page.getByRole('button', { name: /Поехали/ }).click();
await page.getByRole('button', { name: /Включить микрофон/ }).click();
await page.waitForTimeout(4500);
await shot('02-onboarding-mic');
await page.getByRole('button', { name: /Дальше/ }).click();
await page.getByRole('button', { name: /Понятно/ }).click();
await shot('03-onboarding-theme');
await page.getByRole('button', { name: /Дальше/ }).click();
await page.getByRole('button', { name: /Позже/ }).click();
await page.getByRole('button', { name: /Начать первый урок/ }).click();
await shot('04-home');
for (const [hash, name] of [
  ['#/lesson/m01-l1', '05-lesson'],
  ['#/lesson/m01-l4', '06-lesson-fingering'],
  ['#/tuner', '07-tuner'],
  ['#/metronome', '08-metronome'],
  ['#/fingering', '09-fingering'],
  ['#/progress', '10-progress'],
  ['#/settings', '11-settings'],
  ['#/practice', '12-practice'],
  ['#/my', '13-my'],
  ['#/tutor', '14-tutor'],
  ['#/warmup', '15-warmup'],
  ['#/exam/m01', '16-exam'],
]) {
  await page.goto(base + hash);
  await shot(name);
}
fs.writeFileSync(`${out}/errors.txt`, errors.join('\n'));
console.log('errors:', errors.length);
errors.slice(0, 20).forEach((e) => console.log(e));
await browser.close();
