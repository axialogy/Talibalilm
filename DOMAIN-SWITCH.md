# Moving to the real domain

The project runs on a temporary `*.vercel.app` URL while it is being built. When
the school's own domain is ready, six things point at the old one and each has
to be changed by hand. Nothing in the code does — there is no domain string
anywhere in `src/`; every URL the app builds comes from `siteUrl()`, which reads
one variable.

Work down the list in order. The `.vercel.app` URL keeps working afterwards, so
nothing breaks at the moment of the switch; what breaks is anything still
*pointing* at the old one.

---

## 1. Vercel — add the domain

Project → Settings → Domains → add `institut-talib-alim.fr` (or whatever it is)
and follow the DNS instructions at the registrar. Wait for the certificate to
say Valid before going further: every step below assumes `https://` on the new
name actually answers.

## 2. Vercel — `NEXT_PUBLIC_SITE_URL`, then REDEPLOY

Settings → Environment Variables → edit `NEXT_PUBLIC_SITE_URL` to the new
origin. No trailing slash, no path: `https://institut-talib-alim.fr`.

**Saving it is not enough.** `NEXT_PUBLIC_*` values are inlined into the bundle
when the project is built, so the old URL stays baked into the running
deployment until a new build happens. Deployments → ⋯ → Redeploy.

This one variable is what feeds all of: password-reset and sign-up email links,
the sitemap, `robots.txt`, canonical tags, the JSON-LD, and the return and
cancel URLs handed to PayPal for each order.

## 3. Supabase — the redirect allow list

**This is the one that fails silently, and the reason to read this file rather
than guess the list.**

Supabase → Authentication → URL Configuration:

* **Site URL** → the new origin
* **Redirect URLs** → add `https://institut-talib-alim.fr/auth/callback`

Sign-up confirmation, magic links and password resets all ask Supabase to send
the student to `{siteUrl()}/auth/callback`. Supabase refuses any redirect target
that is not on this list — it does not error, it quietly substitutes the Site
URL. So the symptom is not "an error"; it is students landing somewhere
unexpected after clicking a link in their email, which is easy to miss until
somebody cannot finish registering.

Keep the old `*.vercel.app` callback on the list until you are sure no
confirmation emails are still in flight. There is no cost to leaving both.

## 4. Cloudflare R2 — the CORS policy

R2 → your bucket → Settings → CORS Policy. Change `AllowedOrigins` to the new
origin:

```json
[
  {
    "AllowedOrigins": ["https://institut-talib-alim.fr"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

Slides are uploaded straight from the browser to Cloudflare, so this origin must
match exactly or every upload fails with a browser error that names nothing.
Displaying slides is unaffected — a plain `<img>` is not CORS-checked — so the
symptom is "uploads stopped working, the deck still shows".

## 5. PayPal — the webhook URL

developer.paypal.com → Apps & Credentials → your app → Webhooks → edit the URL
to `https://institut-talib-alim.fr/api/paypal/webhook`.

Sandbox and Live are separate apps with separate webhooks. If both exist, both
need changing, and each has its own `PAYPAL_WEBHOOK_ID`.

Do not rely on a redirect from the old domain: the webhook is a POST, and a
redirected POST is not something to trust with the event that grants a student
their access. If the webhook does not arrive, students pay and receive nothing —
the redirect back to the site is cosmetic, the webhook is what settles the sale.

The return and cancel URLs need no change; they are built per order from
`NEXT_PUBLIC_SITE_URL`.

## 6. GitHub — the `SWEEP_URL` secret

Repo → Settings → Secrets and variables → Actions → `SWEEP_URL` →
`https://institut-talib-alim.fr/api/cron/sweep`.

`CRON_SECRET` does not change. Verify with Actions → Sweep → Run workflow: a
green run printing `HTTP 200` and a small JSON body.

---

## Optional, same occasion

**Resend.** Until the school's domain is verified with Resend, receipts are sent
from `onboarding@resend.dev`, which lands in spam for many recipients. Verify the
domain in the Resend dashboard, then set `EMAIL_FROM` to something like
`Institut Talib Alim <contact@institut-talib-alim.fr>`.

---

## Checking it worked

1. Register a brand-new test account. The confirmation email must link to the
   new domain, and clicking it must land on the dashboard. (Covers 2 and 3.)
2. Admin → a live class → Diapositives → upload an image. (Covers 4.)
3. Buy something in sandbox and confirm the entitlement appears in
   Admin → Étudiants — not merely that the success page rendered. (Covers 5.)
4. Actions → Sweep → Run workflow → green. (Covers 6.)
5. Open `https://institut-talib-alim.fr/sitemap.xml` and check the URLs inside
   name the new domain. (Confirms the redeploy in 2 actually happened.)

If step 1 lands on the old domain, the redeploy in step 2 was skipped or the
Supabase list in step 3 was not updated — those are the two usual causes.
