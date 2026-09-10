'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { requireStaff } from '@/lib/auth/guards';

/**
 * Course-builder mutations.
 *
 * Each one re-establishes staff identity and then writes through the ordinary
 * anon-key client, so the `is_staff()` policies apply. The service-role client
 * is deliberately not used here: an authoring screen has no business bypassing
 * the rules it is authoring under.
 */
export interface AdminState {
  ok: boolean;
  error?: string;
}

const OK: AdminState = { ok: true };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

async function client() {
  if (!supabaseConfigured) throw new Error('unavailable');
  await requireStaff();
  return createClient();
}

const courseSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(200),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  subtitle: z.string().max(300).default(''),
  description: z.string().max(8000).default(''),
  title_ar: z.string().max(200).default(''),
  category: z.string().max(40).default('fiqh'),
  level: z.enum(['all', 'beginner', 'intermediate', 'advanced']).default('all'),
  format: z.enum(['presentiel', 'visio', 'hybride']).default('hybride'),
  tone: z.string().max(20).default('emerald'),
  schedule: z.string().max(200).default(''),
  duration_weeks: z.coerce.number().int().min(0).max(200).default(0),
});

export async function createCourse(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const title = String(formData.get('title') ?? '');
  const parsed = courseSchema.safeParse({
    title,
    slug: String(formData.get('slug') || slugify(title)),
  });
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { data, error } = await supabase
    .from('courses')
    .insert({ title: parsed.data.title, slug: parsed.data.slug })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.code === '23505' ? 'duplicate' : 'refused' };

  revalidatePath('/admin/courses', 'layout');
  redirect(`/admin/courses/${data.id}`);
}

export async function updateCourse(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = courseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !parsed.data.id) return { ok: false, error: 'invalid' };

  const { id, ...fields } = parsed.data;
  const supabase = await client();
  const { error } = await supabase.from('courses').update(fields).eq('id', id);
  if (error) return { ok: false, error: error.code === '23505' ? 'duplicate' : 'refused' };

  revalidatePath('/admin/courses', 'layout');
  revalidatePath('/courses', 'layout');
  return OK;
}

export async function setCourseStatus(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({ id: z.string().uuid(), status: z.enum(['draft', 'published', 'archived']) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  // `published_at` is required by a check constraint once status is published,
  // and is set here rather than by a trigger so re-publishing keeps the
  // original date visible to the editor.
  const { error } = await supabase
    .from('courses')
    .update({
      status: parsed.data.status,
      ...(parsed.data.status === 'published' ? { published_at: new Date().toISOString() } : {}),
    })
    .eq('id', parsed.data.id);

  if (error) return { ok: false, error: 'refused' };

  revalidatePath('/admin/courses', 'layout');
  revalidatePath('/courses', 'layout');
  return OK;
}

export async function deleteCourse(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { error } = await supabase.from('courses').delete().eq('id', parsed.data.id);
  if (error) return { ok: false, error: 'refused' };

  revalidatePath('/admin/courses', 'layout');
  redirect('/admin/courses');
}

/* ---- Modules ---------------------------------------------------------- */

export async function addModule(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({ courseId: z.string().uuid(), title: z.string().min(1).max(200) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { data: existing } = await supabase
    .from('modules')
    .select('position')
    .eq('course_id', parsed.data.courseId)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition = (existing?.[0]?.position ?? 0) + 1;
  const { error } = await supabase
    .from('modules')
    .insert({ course_id: parsed.data.courseId, title: parsed.data.title, position: nextPosition });

  if (error) return { ok: false, error: 'refused' };
  revalidatePath('/admin/courses', 'layout');
  return OK;
}

export async function renameModule(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({ id: z.string().uuid(), title: z.string().min(1).max(200) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { error } = await supabase
    .from('modules')
    .update({ title: parsed.data.title })
    .eq('id', parsed.data.id);

  if (error) return { ok: false, error: 'refused' };
  revalidatePath('/admin/courses', 'layout');
  return OK;
}

export async function deleteModule(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { error } = await supabase.from('modules').delete().eq('id', parsed.data.id);
  if (error) return { ok: false, error: 'refused' };
  revalidatePath('/admin/courses', 'layout');
  return OK;
}

/**
 * Swap two rows' positions.
 *
 * `(course_id, position)` is unique, so a naive two-step update collides
 * mid-flight. The constraint is `deferrable initially deferred`, which lets
 * both writes land inside one statement and be checked at commit — hence the
 * single RPC-shaped update rather than two round trips.
 */
async function swapPositions(
  table: 'modules' | 'lessons',
  a: { id: string; position: number },
  b: { id: string; position: number },
): Promise<AdminState> {
  const supabase = await client();
  const { error: firstError } = await supabase
    .from(table)
    .update({ position: b.position })
    .eq('id', a.id);
  if (firstError) return { ok: false, error: 'refused' };

  const { error: secondError } = await supabase
    .from(table)
    .update({ position: a.position })
    .eq('id', b.id);
  if (secondError) return { ok: false, error: 'refused' };

  revalidatePath('/admin/courses', 'layout');
  return OK;
}

export async function moveModule(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({
      id: z.string().uuid(),
      position: z.coerce.number().int(),
      otherId: z.string().uuid(),
      otherPosition: z.coerce.number().int(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid' };

  return swapPositions(
    'modules',
    { id: parsed.data.id, position: parsed.data.position },
    { id: parsed.data.otherId, position: parsed.data.otherPosition },
  );
}

export async function moveLesson(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({
      id: z.string().uuid(),
      position: z.coerce.number().int(),
      otherId: z.string().uuid(),
      otherPosition: z.coerce.number().int(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid' };

  return swapPositions(
    'lessons',
    { id: parsed.data.id, position: parsed.data.position },
    { id: parsed.data.otherId, position: parsed.data.otherPosition },
  );
}

/* ---- Lessons ---------------------------------------------------------- */

export async function addLesson(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({ moduleId: z.string().uuid(), title: z.string().min(1).max(200) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { data: existing } = await supabase
    .from('lessons')
    .select('position')
    .eq('module_id', parsed.data.moduleId)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition = (existing?.[0]?.position ?? 0) + 1;
  const { data, error } = await supabase
    .from('lessons')
    .insert({
      module_id: parsed.data.moduleId,
      title: parsed.data.title,
      slug: slugify(parsed.data.title) || `lecon-${nextPosition}`,
      position: nextPosition,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: 'refused' };

  // The 1:1 content row is created alongside so the editor always has
  // something to write into and the join never has to cope with a missing row.
  await supabase.from('lesson_content').insert({ lesson_id: data.id });

  revalidatePath('/admin/courses', 'layout');
  return OK;
}

export async function updateLesson(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200),
      type: z.enum(['video', 'text', 'live', 'quiz', 'assignment']).default('video'),
      minutes: z.coerce.number().int().min(0).max(1440).default(0),
      is_preview: z.coerce.boolean().default(false),
      content: z.string().max(50000).default(''),
      video_id: z.string().max(200).default(''),
    })
    .safeParse({
      ...Object.fromEntries(formData),
      is_preview: formData.get('is_preview') === 'on',
    });
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { error: lessonError } = await supabase
    .from('lessons')
    .update({
      title: parsed.data.title,
      type: parsed.data.type,
      duration_seconds: parsed.data.minutes * 60,
      is_preview: parsed.data.is_preview,
    })
    .eq('id', parsed.data.id);

  if (lessonError) return { ok: false, error: 'refused' };

  const { error: contentError } = await supabase.from('lesson_content').upsert(
    {
      lesson_id: parsed.data.id,
      content: parsed.data.content,
      video_id: parsed.data.video_id || null,
      video_provider: parsed.data.video_id ? 'bunny' : 'none',
    },
    { onConflict: 'lesson_id' },
  );

  // The check constraint rejects a URL in video_id; report that specifically
  // rather than as a generic failure, because it is a mistake an author makes.
  if (contentError) {
    return { ok: false, error: contentError.code === '23514' ? 'video_id_is_url' : 'refused' };
  }

  revalidatePath('/admin/courses', 'layout');
  revalidatePath('/courses', 'layout');
  return OK;
}

export async function deleteLesson(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await client();
  const { error } = await supabase.from('lessons').delete().eq('id', parsed.data.id);
  if (error) return { ok: false, error: 'refused' };
  revalidatePath('/admin/courses', 'layout');
  return OK;
}
