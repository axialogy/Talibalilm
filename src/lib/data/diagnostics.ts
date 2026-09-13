import 'server-only';
import { headers } from 'next/headers';
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

/**
 * Every table the app reads. A missing one means a migration was not applied.
 *
 * `admin_audit` is here for a reason worth stating: it is the ONLY table
 * created by `20260911180000_admin_operations.sql`. Leave it out and that whole
 * migration can be absent while this page reports a clean bill of health — the
 * `coupons` table it appears to be about is created by an earlier file, so its
 * green tick proves nothing about the generator function. The rate limiter's
 * own table is covered through `rate_limit_hit` in the cache probe below.
 */
const TABLES = [
  'admin_audit',
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
  'live_sessions',
  'live_participants',
  'live_join_requests',
  'live_slides',
  'live_messages',
  'live_board_ops',
] as const;

/**
 * Columns added by a later migration, which a table-level probe cannot see.
 *
 * `select('*')` succeeds against a table that is missing half its columns, so
 * "the table is there" was never the question worth asking. These are named
 * explicitly: a page that selects them gets nothing back when they are absent,
 * and nothing back reads as "this course does not exist".
 */
const COLUMNS: [string, string][] = [
  ['courses', 'department, department_body, requirements, highlights, gallery'],
  ['live_sessions', 'require_approval, chat_enabled, student_camera, student_screen'],
  ['live_participants', 'muted, camera_allowed, screen_allowed, banned_at'],
];

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
  // The parameter is `cid`, not `course` — getting this wrong here reported a
  // fault in an application that was calling it correctly all along.
  ['has_course_access', { cid: '00000000-0000-4000-8000-000000000000' }],
  // `payment_settings` carries no grant for `authenticated` at all, so that a
  // stolen admin session cannot read the PayPal secret back out. It is checked
  // through the status function, which reports whether a secret is stored
  // without ever returning one.
  ['payment_settings_status', {}],
  ['can_join_live', { session_id: '00000000-0000-4000-8000-000000000000' }],
  ['live_room_state', { session_id: '00000000-0000-4000-8000-000000000000' }],
  ['can_read_slide', { key: 'live/none/none.png' }],
];

/** PostgREST's way of saying "there is no such table, column or function here". */
function isMissing(code: string | undefined): boolean {
  return (
    code === 'PGRST202' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    code === '42P01' ||
    code === '42703' ||
    code === '42883'
  );
}

/**
 * PostgREST answers from a cached picture of the schema, and running DDL in
 * the SQL editor does not always refresh it.
 *
 * So "not found" has TWO causes and they need different fixes: the migration
 * was never run here, or it was run and PostgREST has not noticed yet. Saying
 * only the first sent someone to re-run a file they had already run correctly.
 */
const RELOAD_HINT =
  ' — soit la migration n’a pas été exécutée sur ce projet, soit PostgREST n’a pas encore ' +
  "rechargé son schéma : exécutez « notify pgrst, 'reload schema'; » dans l’éditeur SQL, " +
  'puis rouvrez cette page.';

function detailFor(error: { code?: string; message: string } | null, whenOk: string): string {
  if (!error) return whenOk;
  const base = `${error.code ?? ''} ${error.message}`.trim();
  return isMissing(error.code) ? base + RELOAD_HINT : base;
}

/**
 * Does the address we announce match the address we were reached at?
 *
 * `Host` is set by the proxy in front of the app, not by the browser, so on
 * Vercel it is the domain the visitor typed. A mismatch is reported as a
 * problem with both values named, because knowing which two disagree is the
 * whole of the fix.
 *
 * Ports and case are normalised away; a preview deployment, which has no
 * configured address at all, is reported as unset rather than wrong.
 */
async function siteAddressCheck(): Promise<Check> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const announced = siteUrl();

  let servingHost = '';
  try {
    servingHost = ((await headers()).get('host') ?? '').toLowerCase();
  } catch {
    // No request context — a build-time render. Nothing to compare against.
  }

  if (!configured) {
    return {
      group: 'Configuration',
      name: 'Adresse publique du site',
      state: 'unset',
      detail: `NEXT_PUBLIC_SITE_URL n’est pas définie ; l’adresse est déduite de Vercel : ${announced}`,
    };
  }

  const announcedHost = (() => {
    try {
      return new URL(announced).host.toLowerCase();
    } catch {
      return '';
    }
  })();

  if (servingHost === '' || announcedHost === '') {
    return {
      group: 'Configuration',
      name: 'Adresse publique du site',
      state: 'ok',
      detail: announced,
    };
  }

  if (servingHost !== announcedHost) {
    return {
      group: 'Configuration',
      name: 'Adresse publique du site',
      state: 'error',
      detail:
        `NEXT_PUBLIC_SITE_URL annonce ${announcedHost}, mais cette page a été servie par ${servingHost}. ` +
        'Les liens d’inscription, les retours PayPal et le sitemap pointent donc vers la mauvaise adresse. ' +
        'Corrigez la variable dans Vercel PUIS redéployez — une variable NEXT_PUBLIC_ est figée dans le build.',
    };
  }

  return {
    group: 'Configuration',
    name: 'Adresse publique du site',
    state: 'ok',
    detail: `${announced} — correspond à l’adresse servie`,
  };
}

/**
 * What Supabase Auth is actually set to do with a new sign-up.
 *
 * Two switches in the Supabase dashboard decide whether a student can register
 * at all, and neither is visible from inside the app — which is how "students
 * cannot create accounts" became a week of guessing. GoTrue publishes both on
 * an unauthenticated settings endpoint, so ask it.
 *
 * `mailer_autoconfirm` is "Confirm email" INVERTED: true means confirmation is
 * OFF and sign-up completes without any email leaving. That is the setting to
 * reach for when the mail path is broken and registrations have to keep
 * working; it is not a security hole in this app, because nothing is granted
 * by an address alone.
 */
async function authSettingsChecks(): Promise<Check[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const name = 'Inscriptions (réglages Supabase)';
  if (!base || !key) return [];

  let settings: { disable_signup?: boolean; mailer_autoconfirm?: boolean };
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: 'no-store',
    });
    if (!response.ok) {
      return [
        {
          group: 'Configuration',
          name,
          state: 'error',
          detail: `Supabase a répondu ${response.status} à la lecture des réglages d’authentification.`,
        },
      ];
    }
    settings = (await response.json()) as typeof settings;
  } catch (cause) {
    return [
      {
        group: 'Configuration',
        name,
        state: 'error',
        detail: `réglages d’authentification illisibles : ${(cause as Error).message}`,
      },
    ];
  }

  const checks: Check[] = [];

  // A field that is not in the payload has not been read, and saying it is on
  // or off would be inventing an answer. GoTrue has renamed things before.
  if (
    typeof settings.disable_signup !== 'boolean' ||
    typeof settings.mailer_autoconfirm !== 'boolean'
  ) {
    return [
      {
        group: 'Configuration',
        name,
        state: 'error',
        detail:
          'Supabase a répondu, mais sans les champs attendus (disable_signup, mailer_autoconfirm). ' +
          'Vérifiez ces réglages à la main dans Authentication → Sign In / Providers → Email.',
      },
    ];
  }

  if (settings.disable_signup) {
    checks.push({
      group: 'Configuration',
      name,
      state: 'error',
      detail:
        'les inscriptions sont DÉSACTIVÉES dans Supabase (Authentication → Sign In / Providers → Allow new users to sign up). ' +
        'Aucun étudiant ne peut créer de compte tant que c’est le cas.',
    });
  } else {
    checks.push({
      group: 'Configuration',
      name,
      state: 'ok',
      detail: 'les inscriptions sont ouvertes',
    });
  }

  // The switch behind "Error sending confirmation email". With confirmation on,
  // every single sign-up depends on a message leaving Supabase; the built-in
  // sender allows a handful an hour, and a custom SMTP that rejects fails the
  // same way. Neither is a fault in this code and neither is fixed by retrying.
  checks.push({
    group: 'Configuration',
    name: 'Confirmation de l’adresse e-mail',
    state: settings.mailer_autoconfirm ? 'ok' : 'unset',
    detail: settings.mailer_autoconfirm
      ? 'désactivée : le compte s’ouvre immédiatement, sans e-mail à envoyer. Rien ne peut échouer à l’envoi.'
      : 'ACTIVÉE : chaque inscription dépend d’un e-mail envoyé par Supabase. Sans SMTP personnalisé valide ' +
        '(smtp.resend.com, port 465, utilisateur « resend », mot de passe = clé Resend, expéditeur sur un domaine ' +
        'vérifié chez Resend), l’inscription échoue avec « Error sending confirmation email ». ' +
        'Pour débloquer tout de suite : Authentication → Sign In / Providers → Email → décochez « Confirm email ».',
  });

  return checks;
}

/**
 * Every function the app calls by name, including the ones that write.
 *
 * The probe above calls a function to see whether it answers, which rules out
 * anything that changes data — and that is precisely where the faults have
 * been. `admin_generate_coupons` cannot be test-called without generating
 * coupons, so its absence was invisible here while the coupon screen failed.
 */
const RPC_NAMES = [
  'admin_anonymise_user',
  'admin_generate_coupons',
  'admin_grant_entitlement',
  'admin_revoke_entitlement',
  'admin_void_coupon',
  'can_read_slide',
  'claim_confirmation_email',
  'claim_pack',
  'emails_for',
  'expire_entitlements',
  'expire_pending_orders',
  'grant_order_entitlements',
  'has_course_access',
  'live_decide_join',
  'live_join',
  'live_leave',
  'live_room_state',
  'live_set_participant',
  'payment_settings_status',
  'prune_rate_limits',
  'rate_limit_hit',
  'redeem_coupon',
  'release_coupon',
  'release_order_holds',
  'revoke_order_entitlements',
] as const;

/**
 * Ask PostgREST what it actually has, rather than inferring it from a failure.
 *
 * PostgREST publishes its own schema cache as an OpenAPI document at the root
 * of the REST endpoint. Every function it will answer for appears there as
 * `/rpc/<name>`. That makes it the one authority on the question that has cost
 * this project the most time: "the migration ran, so why does the app say the
 * function is missing?"
 *
 * It separates the two causes cleanly. A name absent here is absent from the
 * cache — the migration did not run on THIS project, or PostgREST has not
 * reloaded. A name present here while the app still reports it missing means
 * the arguments disagree, not the function.
 *
 * Read-only, and it calls nothing: this is the only way to check a function
 * that writes without writing.
 */
async function rpcCacheChecks(): Promise<Check[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return [];

  let known: Set<string>;
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      return [
        {
          group: 'Fonctions',
          name: 'cache PostgREST',
          state: 'error',
          detail: `la description du schéma a répondu ${response.status}`,
        },
      ];
    }
    const doc = (await response.json()) as { paths?: Record<string, unknown> };
    known = new Set(
      Object.keys(doc.paths ?? {})
        .filter((path) => path.startsWith('/rpc/'))
        .map((path) => path.slice('/rpc/'.length)),
    );
  } catch (cause) {
    return [
      {
        group: 'Fonctions',
        name: 'cache PostgREST',
        state: 'error',
        detail: `description du schéma illisible : ${(cause as Error).message}`,
      },
    ];
  }

  const absent = RPC_NAMES.filter((name) => !known.has(name));
  if (absent.length === 0) {
    return [
      {
        group: 'Fonctions',
        name: 'cache PostgREST',
        state: 'ok',
        detail: `les ${RPC_NAMES.length} fonctions appelées par le site sont publiées`,
      },
    ];
  }

  return [
    {
      group: 'Fonctions',
      name: 'cache PostgREST',
      state: 'missing',
      detail:
        `absentes du cache : ${absent.join(', ')}.` +
        RELOAD_HINT +
        ' Si le rechargement ne change rien, vérifiez que l’éditeur SQL où vous exécutez les ' +
        'migrations est bien le projet nommé sur la ligne « Supabase » ci-dessus.',
    },
  ];
}

export async function runDiagnostics(): Promise<Check[]> {
  const checks: Check[] = [];

  // --- configuration -------------------------------------------------------
  const projectHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').host;
    } catch {
      return '';
    }
  })();

  // Named rather than merely confirmed. A deployment pointed at one Supabase
  // project while the migrations are pasted into another looks exactly like a
  // migration that did not run — every early table answers, and the newest
  // function or column does not. The project is printed so the two can be
  // compared without leaving this page.
  checks.push({
    group: 'Configuration',
    name: 'Supabase',
    state: supabaseConfigured ? 'ok' : 'unset',
    detail: supabaseConfigured
      ? `${projectHost} — c’est CE projet qui doit recevoir les migrations`
      : 'NEXT_PUBLIC_SUPABASE_URL / ANON_KEY',
  });

  // Worth its own line, and worth CHECKING rather than describing.
  //
  // This value is what auth links, PayPal returns and the sitemap are built
  // from. A deployment reachable at one address while announcing another sends
  // students to a site that is not the one they are using — and it does so
  // silently, because every page still renders. It cost a round of guessing
  // once already: the variable still named the old host after the domain moved,
  // because `NEXT_PUBLIC_*` is baked in at build time and saving it in Vercel
  // without redeploying changes nothing.
  //
  // So the answer is compared here against the host actually serving this
  // request, instead of being printed for a human to eyeball.
  checks.push(await siteAddressCheck());
  checks.push(...(await authSettingsChecks()));

  // Worth saying out loud when it is on: accounts are being opened without the
  // address ever being proved, which is a decision the school made, not a
  // default, and one to undo once the mail path works.
  if (process.env.AUTH_ALLOW_UNVERIFIED_SIGNUP === 'true') {
    checks.push({
      group: 'Configuration',
      name: 'Inscription sans confirmation',
      state: 'unset',
      detail:
        'AUTH_ALLOW_UNVERIFIED_SIGNUP est activée : si Supabase ne parvient pas à envoyer l’e-mail, ' +
        'le compte est tout de même ouvert et l’adresse marquée confirmée. À retirer une fois le SMTP en place.',
    });
  }

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

  const smtpHost = process.env.SMTP_HOST?.trim();
  checks.push({
    group: 'Configuration',
    name: 'Envoi d’e-mails (SMTP)',
    state: smtpHost && process.env.SMTP_USER && process.env.SMTP_PASSWORD ? 'ok' : 'unset',
    detail:
      smtpHost && process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? `${smtpHost}:${process.env.SMTP_PORT ?? '465'} en tant que ${process.env.SMTP_USER}` +
          (process.env.EMAIL_FROM ? ` — expéditeur : ${process.env.EMAIL_FROM}` : '')
        : 'SMTP_HOST / SMTP_USER / SMTP_PASSWORD — facultatif : sans eux, l’élève obtient son accès sans reçu',
  });

  // Auth e-mail is Supabase's own sender, never Resend, and it is the one that
  // decides whether somebody can register at all. Worth saying out loud,
  // because the two are easy to confuse and only one of them blocks a sign-up.
  checks.push({
    group: 'Configuration',
    name: 'E-mails d’inscription',
    state: 'unset',
    detail:
      'envoyés par Supabase, pas par cette application — ce sont deux expéditeurs différents et un seul ' +
      'empêche de s’inscrire. Pointez Supabase sur la même boîte : Authentication → Emails → SMTP Settings, ' +
      'serveur mail.talibalim.com, port 465, utilisateur contact@talibalim.com. ' +
      'Voir DOMAIN-SWITCH.md, étape 3.',
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
        detail: detailFor(error, 'lisible'),
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
        detail: detailFor(error, 'répond'),
      });
    }),
  );

  checks.push(...(await rpcCacheChecks()));

  // --- columns -------------------------------------------------------------
  await Promise.all(
    COLUMNS.map(async ([table, columns]) => {
      const { error } = await supabase
        .from(table as (typeof TABLES)[number])
        .select(columns)
        .limit(1);
      checks.push({
        group: 'Colonnes',
        name: table,
        state: !error ? 'ok' : isMissing(error.code) ? 'missing' : 'error',
        detail: detailFor(error, columns),
      });
    }),
  );

  return checks;
}
