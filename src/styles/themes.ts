// Color themes. Applied as CSS variables on <html>.

export type ThemeId = 'neon' | 'brass' | 'ocean' | 'sunset' | 'sunny' | 'mint' | 'gold';

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  dark: boolean;
  vars: Record<string, string>;
  /** Reward theme: available from this level. */
  unlockLevel?: number;
}

const dark = (v: Record<string, string>) => ({
  '--surface': 'rgba(255,255,255,0.06)',
  '--surface-2': 'rgba(255,255,255,0.11)',
  '--surface-solid': '#1f1640',
  '--border': 'rgba(255,255,255,0.12)',
  '--shadow': '0 10px 30px rgba(0,0,0,0.35)',
  ...v,
});

const light = (v: Record<string, string>) => ({
  '--surface': '#ffffff',
  '--surface-2': '#f4f0ff',
  '--surface-solid': '#ffffff',
  '--border': 'rgba(40,20,80,0.12)',
  '--shadow': '0 10px 30px rgba(60,40,120,0.12)',
  ...v,
});

export const THEMES: Record<ThemeId, Theme> = {
  neon: {
    id: 'neon',
    name: 'Неоновый джаз-клуб',
    description: 'Ночной клуб: глубокий фиолетовый, розовый и бирюзовый неон',
    dark: true,
    vars: dark({
      '--bg': '#140c2e',
      '--bg-grad': 'radial-gradient(1200px 700px at 10% -10%, #3a1670 0%, transparent 60%), radial-gradient(900px 600px at 110% 10%, #0f3b5e 0%, transparent 55%), linear-gradient(160deg, #140c2e 0%, #1c0f42 60%, #120a26 100%)',
      '--panel': 'rgba(12,6,32,0.72)',
      '--surface-solid': '#21164a',
      '--text': '#f6f0ff',
      '--muted': '#b4a8d6',
      '--accent': '#ff4fd8',
      '--accent-2': '#3df2ff',
      '--accent-3': '#ffd23f',
      '--good': '#3dffa8',
      '--ok': '#ffd23f',
      '--bad': '#ff5a6e',
      '--glow': 'rgba(255,79,216,0.45)',
      '--staff-ink': '#f6f0ff',
    }),
  },
  brass: {
    id: 'brass',
    name: 'Медь и бархат',
    description: 'Цвета саксофона: латунь, медь и тёмный бархат',
    dark: true,
    vars: dark({
      '--bg': '#1a1210',
      '--bg-grad': 'radial-gradient(1000px 700px at 0% 0%, #4a2a12 0%, transparent 60%), radial-gradient(900px 600px at 100% 100%, #3a1218 0%, transparent 55%), linear-gradient(160deg, #1a1210 0%, #241614 100%)',
      '--panel': 'rgba(20,12,8,0.75)',
      '--surface-solid': '#2b1d17',
      '--text': '#fff5e6',
      '--muted': '#cbb79a',
      '--accent': '#f2b544',
      '--accent-2': '#e0573f',
      '--accent-3': '#f7e3b0',
      '--good': '#7bd88f',
      '--ok': '#f2c14e',
      '--bad': '#ff6b5e',
      '--glow': 'rgba(242,181,68,0.45)',
      '--staff-ink': '#fff5e6',
    }),
  },
  ocean: {
    id: 'ocean',
    name: 'Ночной океан',
    description: 'Спокойный синий с бирюзой и коралловыми акцентами',
    dark: true,
    vars: dark({
      '--bg': '#06182b',
      '--bg-grad': 'radial-gradient(1000px 700px at 100% 0%, #0d4a6b 0%, transparent 60%), radial-gradient(900px 600px at 0% 100%, #0b3a3a 0%, transparent 55%), linear-gradient(170deg, #06182b 0%, #0a2238 100%)',
      '--panel': 'rgba(4,16,30,0.75)',
      '--surface-solid': '#0f2a44',
      '--text': '#eaf6ff',
      '--muted': '#9ab8d0',
      '--accent': '#2ee6c5',
      '--accent-2': '#5ab0ff',
      '--accent-3': '#ff8a65',
      '--good': '#4cffb0',
      '--ok': '#ffd166',
      '--bad': '#ff6b81',
      '--glow': 'rgba(46,230,197,0.4)',
      '--staff-ink': '#eaf6ff',
    }),
  },
  sunset: {
    id: 'sunset',
    name: 'Закат в Новом Орлеане',
    description: 'Тёплые оранжевые и малиновые тона джазового вечера',
    dark: true,
    vars: dark({
      '--bg': '#2a0e2e',
      '--bg-grad': 'radial-gradient(1000px 700px at 0% 0%, #6b1d3a 0%, transparent 60%), radial-gradient(900px 700px at 100% 100%, #7a3a12 0%, transparent 55%), linear-gradient(160deg, #2a0e2e 0%, #3a1230 100%)',
      '--panel': 'rgba(30,8,28,0.75)',
      '--surface-solid': '#3d1838',
      '--text': '#fff0f3',
      '--muted': '#d6a8b8',
      '--accent': '#ff8a3d',
      '--accent-2': '#ff3d7f',
      '--accent-3': '#ffc857',
      '--good': '#5ef0a0',
      '--ok': '#ffc857',
      '--bad': '#ff5470',
      '--glow': 'rgba(255,138,61,0.45)',
      '--staff-ink': '#fff0f3',
    }),
  },
  sunny: {
    id: 'sunny',
    name: 'Солнечный день',
    description: 'Светлая тема: тёплый крем, оранжевый и фиолетовый',
    dark: false,
    vars: light({
      '--bg': '#fff8ec',
      '--bg-grad': 'radial-gradient(1000px 600px at 0% 0%, #ffe1c2 0%, transparent 60%), radial-gradient(900px 600px at 100% 0%, #e9ddff 0%, transparent 55%), linear-gradient(170deg, #fff8ec 0%, #fff1e6 100%)',
      '--panel': 'rgba(255,255,255,0.8)',
      '--text': '#2a1e3d',
      '--muted': '#7a6e8a',
      '--accent': '#ff6a1a',
      '--accent-2': '#7b3cff',
      '--accent-3': '#00b3a4',
      '--good': '#17b26a',
      '--ok': '#e0a100',
      '--bad': '#e5484d',
      '--glow': 'rgba(255,106,26,0.3)',
      '--staff-ink': '#2a1e3d',
    }),
  },
  mint: {
    id: 'mint',
    name: 'Мятная свежесть',
    description: 'Светлая тема: мята, лаванда и розовый',
    dark: false,
    vars: light({
      '--bg': '#effbf6',
      '--bg-grad': 'radial-gradient(1000px 600px at 100% 0%, #d7f3ff 0%, transparent 60%), radial-gradient(900px 600px at 0% 100%, #e6defd 0%, transparent 55%), linear-gradient(170deg, #effbf6 0%, #eef6ff 100%)',
      '--panel': 'rgba(255,255,255,0.82)',
      '--text': '#102a33',
      '--muted': '#5f7a85',
      '--accent': '#12b886',
      '--accent-2': '#7b5cff',
      '--accent-3': '#ff5c8a',
      '--good': '#12b886',
      '--ok': '#e0a100',
      '--bad': '#e5484d',
      '--glow': 'rgba(18,184,134,0.3)',
      '--staff-ink': '#102a33',
    }),
  },
  gold: {
    id: 'gold',
    name: 'Золотой саксофон',
    description: 'Награда 10 уровня: чёрный бархат и сияющее золото',
    dark: true,
    unlockLevel: 10,
    vars: dark({
      '--bg': '#0b0907',
      '--bg-grad': 'radial-gradient(1100px 700px at 15% -10%, #3d2b0a 0%, transparent 60%), radial-gradient(900px 600px at 110% 110%, #2a1d05 0%, transparent 55%), linear-gradient(165deg, #0b0907 0%, #15100a 100%)',
      '--panel': 'rgba(10,8,5,0.82)',
      '--surface-solid': '#1c160d',
      '--text': '#fff8e7',
      '--muted': '#c9b88f',
      '--accent': '#f5c542',
      '--accent-2': '#ffdf80',
      '--accent-3': '#ff9f43',
      '--good': '#8be38b',
      '--ok': '#ffd166',
      '--bad': '#ff6b5e',
      '--glow': 'rgba(245,197,66,0.5)',
      '--staff-ink': '#fff8e7',
    }),
  },
};

export function applyTheme(id: ThemeId) {
  const t = THEMES[id] ?? THEMES.neon;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(t.vars)) root.style.setProperty(k, v);
  root.dataset.theme = t.id;
  root.dataset.dark = String(t.dark);
}

export function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
