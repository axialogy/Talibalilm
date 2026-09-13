#!/usr/bin/env node
/*
 * Print a fresh VAPID key pair for Web Push.
 *
 * Run once, ever. The pair identifies this site to every browser vendor's push
 * service; regenerating it invalidates every subscription already stored, and
 * every device then has to press "Activer les notifications" again.
 *
 *   npm run push:keys
 *
 * The private key is a credential. It goes into Vercel as a Secret and nowhere
 * else — not into a commit, not into a chat window.
 */
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`
Paste these into Vercel → Settings → Environment Variables:

  VAPID_PUBLIC_KEY              ${publicKey}
  VAPID_PRIVATE_KEY             ${privateKey}        <- mark as Secret
  NEXT_PUBLIC_VAPID_PUBLIC_KEY  ${publicKey}
  VAPID_SUBJECT                 mailto:contact@talibalim.com

The public key appears twice on purpose: the browser needs it to subscribe, and
NEXT_PUBLIC_ is what ships it to the browser. It is public by design — only the
private key is a secret.

NEXT_PUBLIC_ values are frozen into the bundle at build time, so redeploy with
the build cache OFF after saving.
`);
