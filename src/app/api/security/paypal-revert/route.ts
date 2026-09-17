import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { supabaseConfigured, siteUrl } from '@/lib/env';
import { verifyRevertToken } from '@/lib/security/pin';
import { reportError } from '@/lib/observability/report';
import { sendMail, officeInbox } from '@/lib/email/send';
import { securityAlert } from '@/lib/email/templates';
import { institut } from '@/lib/content/institut';

/**
 * "It was not me."
 *
 * One click from the alert e-mail, and it does three things in this order:
 *
 *   1. Clears the PayPal credentials and switches online payment OFF. The
 *      money path is closed before anybody investigates — clearing rather than
 *      restoring the previous values, because the previous values are exactly
 *      what an attacker was moving the money away from.
 *   2. Sends the account holder a password-reset e-mail. Until that password
 *      is changed, the stolen session is still a session.
 *   3. Tells the office, with what to do next.
 *
 * The link is signed (HMAC over the admin's id and the moment of the change)
 * and works from the mailbox, with no session — the person who needs it may
 * not be able to sign in any more.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.STEPUP_SECRET?.trim();
  const userId = request.nextUrl.searchParams.get('u');
  const token = request.nextUrl.searchParams.get('t');

  if (!supabaseConfigured || !secret || !userId || !token) {
    return NextResponse.json({ error: 'unavailable' }, { status: 400 });
  }

  if (!verifyRevertToken(token, userId, secret)) {
    // A forged or expired link is worth a note: the second is what happens
    // when somebody opens the alert a month later.
    reportError('security.revert.invalid', new Error('revert token refused'), { userId });
    return NextResponse.json({ error: 'invalid' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from('payment_settings')
    .update({
      client_id: '',
      client_secret: '',
      webhook_id: '',
      enabled: false,
    })
    .eq('id', true);

  if (error) {
    reportError('security.revert.save', error, { userId });
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  const { data: account } = await admin.auth.admin.getUserById(userId);
  const email = account?.user?.email ?? null;

  if (email) {
    const { error: resetError } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl()}/reset-password`,
    });
    if (resetError) reportError('security.revert.reset', resetError, { userId });
  }

  try {
    await sendMail(
      securityAlert({
        to: officeInbox(institut.email),
        action: 'Paiement en ligne coupé (signalement)',
        actor: email ?? userId,
        detail:
          'Les identifiants PayPal ont été vidés et le paiement en ligne désactivé. ' +
          'Changez le mot de passe du compte administrateur, puis remettez les identifiants depuis Administration → Paiement.',
        revertUrl: null,
      }),
    );
  } catch (cause) {
    reportError('security.revert.mail', cause, { userId });
  }

  return NextResponse.redirect(`${siteUrl()}/admin/payments?security=reverted`);
}
