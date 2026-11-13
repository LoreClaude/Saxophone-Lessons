// Strict progression rules: lessons unlock one after another; a module exam
// unlocks the next module and can be taken early to skip known material.
import { COURSE } from './course';
import type { Lesson, Module } from './types';
import type { ProgressState } from '../store/progress';

export type Status = 'locked' | 'available' | 'completed';

export const exKey = (lessonId: string, exId: string) => `${lessonId}/${exId}`;
export const examKey = (moduleId: string, exId: string) => `exam:${moduleId}/${exId}`;

export interface LessonRef {
  module: Module;
  lesson: Lesson;
  moduleIndex: number;
  lessonIndex: number;
}

export function allLessons(): LessonRef[] {
  const out: LessonRef[] = [];
  COURSE.forEach((module, mi) => module.lessons.forEach((lesson, li) => out.push({ module, lesson, moduleIndex: mi, lessonIndex: li })));
  return out;
}

export function findLesson(id: string): LessonRef | undefined {
  return allLessons().find((r) => r.lesson.id === id);
}

export function findModule(id: string): { module: Module; index: number } | undefined {
  const index = COURSE.findIndex((m) => m.id === id);
  return index >= 0 ? { module: COURSE[index], index } : undefined;
}

/** All required exercises passed and quiz ≥ 80 %. */
export function lessonRequirementsMet(lesson: Lesson, p: ProgressState) {
  const exOk = lesson.exercises.filter((e) => !e.optional).every((e) => p.exercises[exKey(lesson.id, e.id)]?.passed);
  const quizOk = !lesson.quiz?.length || (p.lessons[lesson.id]?.quizBest ?? 0) >= 80;
  return exOk && quizOk;
}

export function moduleUnlocked(index: number, p: ProgressState) {
  if (index === 0) return true;
  const prev = COURSE[index - 1];
  return Boolean(p.exams[prev.id]?.passed);
}

export function lessonStatus(ref: LessonRef, p: ProgressState): Status {
  if (p.lessons[ref.lesson.id]?.completed) return 'completed';
  if (p.exams[ref.module.id]?.passed) return 'completed';
  if (!moduleUnlocked(ref.moduleIndex, p)) return 'locked';
  if (ref.lessonIndex === 0) return 'available';
  const prev = ref.module.lessons[ref.lessonIndex - 1];
  return p.lessons[prev.id]?.completed ? 'available' : 'locked';
}

export function examStatus(moduleIndex: number, p: ProgressState): Status {
  const m = COURSE[moduleIndex];
  if (p.exams[m.id]?.passed) return 'completed';
  return moduleUnlocked(moduleIndex, p) ? 'available' : 'locked';
}

/** The lesson the learner should do next. */
export function nextLesson(p: ProgressState): LessonRef | null {
  for (const r of allLessons()) if (lessonStatus(r, p) === 'available') return r;
  return null;
}

/** Module index whose exam is the next step (all lessons done, exam not passed). */
export function pendingExam(p: ProgressState): number | null {
  for (let i = 0; i < COURSE.length; i++) {
    const m = COURSE[i];
    if (!moduleUnlocked(i, p) || p.exams[m.id]?.passed) continue;
    if (m.lessons.every((l) => p.lessons[l.id]?.completed)) return i;
    return null;
  }
  return null;
}

export function courseProgress(p: ProgressState) {
  const lessons = allLessons();
  const done = lessons.filter((r) => lessonStatus(r, p) === 'completed').length;
  return { done, total: lessons.length, percent: Math.round((100 * done) / Math.max(1, lessons.length)) };
}
