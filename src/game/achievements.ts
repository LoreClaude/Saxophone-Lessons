// Achievements ("достижения").

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  xp: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_sound', title: 'Первый звук', description: 'Сыграйте первое упражнение', icon: '🎷', xp: 20 },
  { id: 'first_pass', title: 'Зачёт!', description: 'Сдайте первое упражнение', icon: '✅', xp: 20 },
  { id: 'three_stars', title: 'Три звезды', description: 'Получите 3 звезды в упражнении', icon: '⭐', xp: 30 },
  { id: 'combo_10', title: 'Комбо ×10', description: '10 точных нот подряд', icon: '🔥', xp: 30 },
  { id: 'combo_25', title: 'Комбо ×25', description: '25 точных нот подряд', icon: '💥', xp: 50 },
  { id: 'combo_50', title: 'Комбо ×50', description: '50 точных нот подряд', icon: '🚀', xp: 100 },
  { id: 'long_10', title: 'Долгое дыхание', description: 'Продержите ноту 10 секунд', icon: '🌬️', xp: 30 },
  { id: 'long_20', title: 'Лёгкие кита', description: 'Продержите ноту 20 секунд', icon: '🐋', xp: 80 },
  { id: 'breath_30', title: 'Марафонец', description: 'Выдох длиной 30 секунд', icon: '🏃', xp: 50 },
  { id: 'streak_3', title: 'Три дня подряд', description: 'Занимайтесь 3 дня подряд', icon: '📅', xp: 30 },
  { id: 'streak_7', title: 'Неделя в ритме', description: 'Занимайтесь 7 дней подряд', icon: '🗓️', xp: 80 },
  { id: 'streak_30', title: 'Месяц без пропусков', description: 'Занимайтесь 30 дней подряд', icon: '🏆', xp: 300 },
  { id: 'attempts_100', title: 'Сотня', description: 'Сыграйте 100 упражнений', icon: '💯', xp: 100 },
  { id: 'hours_1', title: 'Первый час', description: 'Наберите 1 час практики', icon: '⏱️', xp: 50 },
  { id: 'hours_10', title: 'Десять часов', description: 'Наберите 10 часов практики', icon: '⌛', xp: 200 },
  { id: 'night_owl', title: 'Ночная репетиция', description: 'Позанимайтесь после 23:00', icon: '🦉', xp: 20 },
  { id: 'early_bird', title: 'Ранняя пташка', description: 'Позанимайтесь до 8:00', icon: '🐦', xp: 20 },
  { id: 'pure_tone', title: 'Чистый строй', description: 'Интонация 100 в упражнении по нотам', icon: '🎯', xp: 50 },
  { id: 'first_improv', title: 'Первая импровизация', description: 'Сыграйте импровизацию', icon: '🎶', xp: 40 },
  { id: 'improviser', title: 'Импровизатор', description: 'Импровизация на 85% и больше', icon: '🎺', xp: 100 },
  { id: 'vibrato', title: 'Вибрато!', description: 'Сдайте упражнение на вибрато', icon: '〰️', xp: 50 },
  { id: 'golden_ear', title: 'Золотое ухо', description: '«Повтори за мной» на 100%', icon: '👂', xp: 60 },
  { id: 'tutor_chat', title: 'Беседа с Бибопом', description: 'Задайте вопрос наставнику', icon: '🐱', xp: 15 },
  { id: 'warmup_7', title: 'Разогретый', description: 'Сделайте разминку 7 раз', icon: '♨️', xp: 60 },
  { id: 'my_piece', title: 'Своя пьеса', description: 'Добавьте свои ноты', icon: '📜', xp: 30 },
  { id: 'quests_all', title: 'Охотник за заданиями', description: 'Выполните все задания дня', icon: '🎁', xp: 40 },
  { id: 'level_5', title: 'Уровень 5', description: 'Достигните 5 уровня', icon: '5️⃣', xp: 0 },
  { id: 'level_10', title: 'Уровень 10', description: 'Достигните 10 уровня', icon: '🔟', xp: 0 },
  { id: 'level_20', title: 'Уровень 20', description: 'Достигните 20 уровня', icon: '👑', xp: 0 },
  { id: 'comeback', title: 'Возвращение', description: 'Вернитесь к занятиям после перерыва в неделю', icon: '🔁', xp: 30 },
  { id: 'exam_1', title: 'Первый экзамен', description: 'Сдайте экзамен модуля', icon: '🎓', xp: 50 },
  { id: 'course_done', title: 'Выпускник', description: 'Пройдите весь курс', icon: '🏅', xp: 500 },
];

export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
