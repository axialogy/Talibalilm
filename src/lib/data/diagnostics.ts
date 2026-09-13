import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured, siteUrl } from '@/lib/env';
import { r2Configured, r2Missing } from '@/lib/storage/r2';
import { liveKitConfigured } from '@/lib/live/server';

/**
 * Does this deployment have everything it needs?
 *
 * Written after several faults cost a round each, all of the same shape: a
 * table or a function missing from the project because a migration was never
 * run, or a variable added to Vercel after the deployment that is serving. The
 * app degrades quietly in those cases — by design, because a missing receipt
 * must never lose a sale — and quiet degradation is exactly what makes the
 * cause hard to find from the outside.
 *
 * So this asks every question at once and reports the answers in words. Reads
 * only: nothing here creates, changes or deletes anything, and every query
 * goes through the caller's own session, so it reports what the app can
 * actually see rather than what a privileged connection could.
 */

export type CheckState = 'ok' | 'missing' | 'error' | 'unset';

export interface Check {
  group: string;
  name: string;
  state: CheckState;
  /** The exact words the database or the runtime used. Never a paraphrase. */
  detail: string;
}

/** Every table the app reads. A missing one means a migration was not applied. */
const TABLES = [
  'profiles',
  'courses',
  'modules',
  'lessons',
  'lesson_content',
  'enrollments',
  'lesson_progress',
  'cursus',
  'cursus_courses',
  'products',
  'packs',
  'pack_items',
  'orders',
  'order_items',
  'entitlements',
  'coupons',
  'payment_settings',
  'live_sessions',
  'live_participants',
  'live_join_requests',
  'live_slides',
  'live_messages',
  'live_board_ops',
] as const;

/**
 * Read-only functions, and the arguments that make them answer without doing
 * anything. Nothing that writes is called — a diagnostic that mutates is not a
 * diagnostic.
 */
type RpcName = Parameters<Awaited<ReturnType<typeof createClient>>['rpc']>[0];

const FUNCTIONS: [RpcName, Record<string, unknown>][] = [
  ['is_staff', {}],
  ['is_admin', {}],
  ['has_any_entitlement', {}],
  ['has_course_access', { course: '00000000-0000-4000-8000-000000000000' }],
  ['can_join_live', { session_id: '00000000-0000-4000-8000-000000000000' }],
  ['live_room_state', { session_id: '00000000-0000-4000-8000-000000000000' }],
  ['can_read_slide', { key: 'live/none/none.png' }],
];

/** PostgREST's way of saying "there is no such table or function here". */
function isMissing(code: string | undefined): boolean {
  return code === 'PGRST202' || code === 'PGRST205' || code === '42P01' || code === '42883';
}

export async function runDiagnostics(): Promise<Check[]> {
  const checks: Check[] = [];

  // --- configuration -------------------------------------------------------
  checks.push({
    group: 'Configuration',
    name: 'Supabase',
    state: supabaseConfigured ? 'ok' : 'unset',
    detail: supabaseConfigured ? siteUrl() : 'NEXT_PUBLIC_SUPABASE_URL / ANON_KEY',
  });

  const missingR2 = r2Missing();
  checks.push({
    group: 'Configuration',
    name: 'Cloudflare R2 (diapositives)',
    state: r2Configured ? 'ok' : 'unset',
    detail: r2Configured ? 'les quatre variables sont lues' : missingR2.join(', '),
  });

  checks.push({
    group: 'Configuration',
    name: 'LiveKit (cours en direct)',
    state: liveKitConfigured ? 'ok' : 'unset',
    detail: liveKitConfigured
      ? 'URL, clé et secret lus'
      : 'NEXT_PUBLIC_LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET',
  });

  const paypal = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  checks.push({
    group: 'Configuration',
    name: 'PayPal (variables)',
    state: paypal ? 'ok' : 'unset',
    detail: paypal
      ? `environnement : ${process.env.PAYPAL_ENVIRONMENT === 'live' ? 'live' : 'sandbox'}`
      : 'absentes — la configuration vient alors de l’écran Paiements',
  });

  checks.push({
    group: 'Configuration',
    name: 'Reçus par e-mail (Resend)',
    state: process.env.RESEND_API_KEY ? 'ok' : 'unset',
    detail: process.env.RESEND_API_KEY
      ? 'clé lue — les reçus partent après un paiement'
      : 'facultatif : sans lui, l’élève obtient son accès sans reçu',
  });

  // Auth e-mail is Supabase's own sender, never Resend, and it is the one that
  // decides whether somebody can register at all. Worth saying out loud,
  // because the two are easy to confuse and only one of them blocks a sign-up.
  checks.push({
    group: 'Configuration',
    name: 'E-mails d’inscription',
    state: 'unset',
    detail:
      'envoyés par Supabase, pas par Resend. Sans SMTP personnalisé, le service intégré est limité à quelques messages par heure — désactivez « Confirm email » dans Supabase tant que l’institut n’a pas son domaine.',
  });

  checks.push({
    group: 'Configuration',
    name: 'Nettoyage automatique',
    state: process.env.CRON_SECRET ? 'ok' : 'unset',
    detail: process.env.CRON_SECRET ? 'CRON_SECRET lu' : 'CRON_SECRET — le balayage refuse tout',
  });

  if (!supabaseConfigured) return checks;

  const supabase = await createClient();

  // --- tables --------------------------------------------------------------
  await Promise.all(
    TABLES.map(async (table) => {
      const { error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .limit(1);
      checks.push({
        group: 'Tables',
        name: table,
        state: !error ? 'ok' : isMissing(error.code) ? 'missing' : 'error',
        detail: error ? `${error.code ?? ''} ${error.message}`.trim() : 'lisible',
      });
    }),
  );

  // --- functions -----------------------------------------------------------
  await Promise.all(
    FUNCTIONS.map(async ([fn, args]) => {
      const { error } = await supabase.rpc(fn, args as never);
      checks.push({
        group: 'Fonctions',
        name: fn,
        state: !error ? 'ok' : isMissing(error.code) ? 'missing' : 'error',
        detail: error ? `${error.code ?? ''} ${error.message}`.trim() : 'répond',
      });
    }),
  );

  return checks;
}
