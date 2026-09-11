import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { reportError } from '@/lib/observability/report';
import {
  courses as fixtureCourses,
  getCourse as getFixtureCourse,
  getInstructor as getFixtureInstructor,
  listCourses as listFixtureCourses,
} from '@/lib/content/courses';
import type { ArtTone, Course, CourseCategory, CourseLevel, Instructor } from '@/lib/content/types';
import type { CourseRow, LessonRow, ModuleRow } from '@/lib/supabase/database.types';

/**
 * Catalogue reads.
 *
 * When Supabase is configured this queries it; otherwise it serves the Phase 1
 * fixtures. That fallback is not laziness — it keeps the marketing site
 * deployable and demoable before the database exists, which is exactly the
 * state the project is in between phases. `usingFixtures()` reports which
 * source answered so the admin can say so plainly rather than showing an
 * empty catalogue that looks like a bug.
 *
 * Nothing here reads `lesson_content`. The gated fields are fetched only by
 * `getLessonContent`, and only ever server-side.
 */

/** Shape returned by the nested select below. */
interface NestedModule extends ModuleRow {
  lessons: LessonRow[];
}
interface NestedCourse extends CourseRow {
  modules: NestedModule[];
}

const COURSE_SELECT = `
  id, slug, title, subtitle, description, title_ar, cover_url, tone, category,
  level, format, language, instructor_id, status, published_at, display_order,
  schedule, duration_weeks, objectives, created_at, updated_at,
  modules ( id, course_id, title, position, created_at, updated_at,
    lessons ( id, module_id, title, slug, type, position, duration_seconds,
              is_preview, created_at, updated_at ) )
`;

function toCourse(row: NestedCourse): Course {
  const objectives = Array.isArray(row.objectives)
    ? row.objectives.filter((o): o is string => typeof o === 'string')
    : [];

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    title_ar: row.title_ar,
    cover_url: row.cover_url,
    tone: row.tone as ArtTone,
    category: row.category as CourseCategory,
    level: row.level as CourseLevel,
    format: row.format,
    language: row.language === 'ar' ? 'ar' : 'fr',
    instructor_id: row.instructor_id ?? '',
    status: row.status === 'published' ? 'published' : 'draft',
    published_at: row.published_at ?? row.created_at,
    display_order: row.display_order,
    schedule: row.schedule,
    duration_weeks: row.duration_weeks,
    objectives,
    modules: (row.modules ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        id: m.id,
        title: m.title,
        position: m.position,
        lessons: (m.lessons ?? [])
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((l) => ({
            id: l.id,
            slug: l.slug,
            title: l.title,
            type: l.type,
            position: l.position,
            duration_seconds: l.duration_seconds,
            is_preview: l.is_preview,
          })),
      })),
  };
}

/** True when the catalogue came from fixtures rather than the database. */
export function usingFixtures(): boolean {
  return !supabaseConfigured;
}

export async function listCourses(): Promise<Course[]> {
  if (!supabaseConfigured) return listFixtureCourses();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('courses')
    .select(COURSE_SELECT)
    .eq('status', 'published')
    .order('display_order', { ascending: true });

  // A query error against a configured database is an OUTAGE, not an empty
  // catalogue — and it must never fabricate courses. Serving the demo fixtures
  // here once real prices exist would let a customer open and try to buy a
  // course that does not exist. Report it and return nothing; the fixtures are
  // only for the pre-database state, which is `!supabaseConfigured` above.
  if (error) {
    reportError('catalogue.list', error);
    return [];
  }
  return (data as unknown as NestedCourse[]).map(toCourse);
}

export async function getCourse(slug: string): Promise<Course | undefined> {
  if (!supabaseConfigured) return getFixtureCourse(slug);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('courses')
    .select(COURSE_SELECT)
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    reportError('catalogue.get', error, { slug });
    return undefined;
  }
  return data ? toCourse(data as unknown as NestedCourse) : undefined;
}

export async function getInstructor(id: string): Promise<Instructor | undefined> {
  if (!supabaseConfigured) return getFixtureInstructor(id);
  if (!id) return undefined;

  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', id)
    .maybeSingle();

  if (!data) return undefined;
  return {
    id: data.id,
    full_name: data.full_name,
    role: data.role === 'admin' ? 'Direction' : 'Enseignant·e',
    bio: '',
  };
}

export async function relatedCourses(course: Course, limit = 3): Promise<Course[]> {
  const all = await listCourses();
  const others = all.filter((c) => c.id !== course.id);
  const sameField = others.filter((c) => c.category === course.category);
  const rest = others.filter((c) => c.category !== course.category);
  return [...sameField, ...rest].slice(0, limit);
}

/** Slugs for `generateStaticParams`; fixtures at build time when there is no DB. */
export function buildTimeCourseSlugs(): string[] {
  return fixtureCourses.filter((c) => c.status === 'published').map((c) => c.slug);
}
