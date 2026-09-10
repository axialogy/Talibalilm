/**
 * Phase 1 renders the public catalogue from these fixtures.
 *
 * The shape deliberately mirrors the `courses` / `modules` / `lessons` tables
 * from the build spec, so Phase 2 replaces the fixture module with a Supabase
 * query and every component keeps its props.
 */
export type CourseLevel = 'all' | 'beginner' | 'intermediate' | 'advanced';
export type CourseCategory = 'aqida' | 'fiqh' | 'coran' | 'hadith' | 'tafsir' | 'langue' | 'histoire';
export type CourseFormat = 'presentiel' | 'visio' | 'hybride';
export type LessonType = 'video' | 'text' | 'live' | 'quiz' | 'assignment';
export type ArtTone = 'emerald' | 'indigo' | 'plum' | 'sand' | 'crimson' | 'teal' | 'night';

export interface Instructor {
  id: string;
  full_name: string;
  role: string;
  bio: string;
}

export interface Lesson {
  id: string;
  slug: string;
  title: string;
  type: LessonType;
  position: number;
  duration_seconds: number;
  /** Playable without a membership. Everything else is gated in RLS. */
  is_preview: boolean;
}

export interface CourseModule {
  id: string;
  title: string;
  position: number;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  /** The discipline's Arabic name, printed on the generated cover. */
  title_ar: string;
  cover_url: string | null;
  tone: ArtTone;
  category: CourseCategory;
  level: CourseLevel;
  format: CourseFormat;
  /** The language taught, not the language of the page. */
  language: 'ar' | 'fr';
  instructor_id: string;
  status: 'draft' | 'published';
  published_at: string;
  display_order: number;
  schedule: string;
  duration_weeks: number;
  objectives: string[];
  modules: CourseModule[];
}

/** Every lesson across every module, in reading order. */
export function courseLessons(course: Course): Lesson[] {
  return course.modules
    .slice()
    .sort((a, b) => a.position - b.position)
    .flatMap((m) => m.lessons.slice().sort((a, b) => a.position - b.position));
}

export function lessonCount(course: Course): number {
  return course.modules.reduce((n, m) => n + m.lessons.length, 0);
}
