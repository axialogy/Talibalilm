'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';

const markSchema = z.object({
  lessonId: z.string().uuid(),
  completed: z.boolean(),
});

export interface ProgressState {
  ok: boolean;
  error?: string;
}

/**
 * Mark a lesson complete, or undo it.
 *
 * No membership check in here on purpose. The RLS policy on `lesson_progress`
 * already requires `has_active_membership()` to insert, so a non-member's
 * write is refused by the database. Re-checking in application code would
 * imply the database check is optional, which is the habit this rebuild is
 * meant to break.
 */
export async function setLessonComplete(
  _prev: ProgressState,
  formData: FormData,
): Promise<ProgressState> {
  if (!supabaseConfigured) return { ok: false, error: 'unavailable' };

  const parsed = markSchema.safeParse({
    lessonId: formData.get('lessonId'),
    completed: formData.get('completed') === 'true',
  });
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { error } = await supabase.from('lesson_progress').upsert(
    {
      user_id: user.id,
      lesson_id: parsed.data.lessonId,
      status: parsed.data.completed ? 'completed' : 'in_progress',
      completed_at: parsed.data.completed ? new Date().toISOString() : null,
    },
    { onConflict: 'user_id,lesson_id' },
  );

  if (error) return { ok: false, error: 'refused' };

  revalidatePath('/dashboard', 'layout');
  return { ok: true };
}
