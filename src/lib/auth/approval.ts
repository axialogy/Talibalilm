import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured, siteUrl } from '@/lib/env';
import { institut } from '@/lib/content/institut';
import { sendMail } from '@/lib/email/send';
import { newRegistration } from '@/lib/email/templates';
import { reportError } from '@/lib/observability/report';

/**
 * Whether this account has been let in, and telling the office when one is
 * waiting.
 *
 * The answer always comes from `is_approved()` in the database. Nothing here
 * reads `approved_at` and decides for itself: a second opinion about who may
 * buy is a second thing to get wrong.
 */

/** Is the signed-in caller allowed past the pending state? */
export async function viewerIsApproved(): Promise<boolean> {
  if (!supabaseConfigured) return true;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('is_approved', {});
  if (error) {
    // Fail OPEN, deliberately. This gate exists so the school can vet who
    // joins, not to protect anything — RLS already refuses an unpaid account
    // every lesson. Failing closed would turn a hiccup in one function into
    // "nobody in the school can enrol", which is the worse outcome by far.
    reportError('approval.check', error);
    return true;
  }
  return data === true;
}

/** How many students are waiting, for the badge on the admin shell. */
export async function pendingStudentCount(): Promise<number> {
  if (!supabaseConfigured) return 0;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('pending_student_count', {});
  if (error) return 0;
  return typeof data === 'number' ? data : 0;
}

/**
 * Tell the office somebody has registered.
 *
 * Called from the sign-up action, and deliberately never allowed to fail it: a
 * student who has just created an account must not see an error because the
 * school's mail server was slow. Every path here swallows and reports.
 */
export async function notifyOfficeOfRegistration(input: {
  fullName: string;
  email: string;
  userId: string;
}): Promise<void> {
  try {
    await sendMail(
      newRegistration({
        to: institut.email,
        fullName: input.fullName,
        email: input.email,
        reviewUrl: `${siteUrl()}/admin/students/${input.userId}`,
      }),
    );
  } catch (cause) {
    reportError('approval.notify', cause, {
      note: 'the account was created; only the alert to the office failed',
    });
  }
}
