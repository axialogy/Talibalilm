# The domain: `talibalim.com`

The site is reachable at **https://talibalim.com**. Nothing in the code knows
that — there is no domain string anywhere in `src/`; every URL the app builds
comes from `siteUrl()`, which reads one variable. What *does* have to be told,
separately, is six outside services. Five of them fail loudly if they are
wrong. One fails silently, and it is the one that stops students registering.

Work down the list in order. Each step says how to tell it worked.

---

## 1. Vercel — the domain itself

Project → Settings → Domains → `talibalim.com`, with the DNS record at the
registrar.

Keep `t.talibalim.com` pointed at the project too, as a **redirect** to the
apex rather than a second live domain. Confirmation links already sitting in
somebody's inbox name it, and a domain that stops answering turns those into
dead links for no benefit.

Check: `https://talibalim.com` answers and the certificate is valid. Every
step below assumes that.

## 2. Vercel — `NEXT_PUBLIC_SITE_URL`, then REDEPLOY

Settings → Environment Variables:

```
NEXT_PUBLIC_SITE_URL = https://talibalim.com
```

No trailing slash, no path.

**Saving it is not enough.** `NEXT_PUBLIC_*` values are inlined into the bundle
when the project is built, so the old URL stays baked into the deployment that
is currently serving until a new build happens. Deployments → ⋯ → **Redeploy**,
with "Use existing build cache" **off**.

This one variable feeds all of: sign-up and password-reset email links, the
sitemap, `robots.txt`, canonical tags, the JSON-LD, and the return and cancel
URLs handed to PayPal for each order.

Check: **Admin → Diagnostic**. The line *Adresse publique du site* now compares
what the app announces against the host that actually served the page, and says
so in red if they disagree. Green there means this step is done; red names both
values. (`https://talibalim.com/sitemap.xml` is the second opinion — the URLs
inside it must name the new domain.)

## 3. Supabase — the redirect allow list

**This is the one that fails silently.**

Supabase → Authentication → URL Configuration:

- **Site URL** → `https://talibalim.com`
- **Redirect URLs** → add `https://talibalim.com/auth/callback`

Add the wildcard as well:

- **Redirect URLs** → also add `https://talibalim.com/**`

**This is not theory — it has already happened here.** A confirmation e-mail
arrived carrying

```
https://e-learning-ten-eta.vercel.app/?code=e608e214-…
```

Look at what is missing: `/auth/callback`. The app asks Supabase to send the
student to `{siteUrl()}/auth/callback`; Supabase found that target absent from
this list, discarded it, and **silently substituted the Site URL** — which was
still the old host. No error anywhere. The e-mail sent, the page rendered, and
the account was never confirmed, because nothing at `/` exchanges a code.

So two things are wrong at once when this happens, and both need fixing: the
Site URL names the wrong host, AND the callback is not on the allow-list.

The app now catches a stray `?code=` on any page and hands it to
`/auth/callback` (see `src/middleware.ts`), so a link that reaches the right
host works even when Supabase substitutes. That is a safety net, not a
substitute for this list — a substituted link still names whatever the Site URL
says, so if that is wrong the link goes to the wrong site entirely.

Keep the old `*.vercel.app` callback on the list until you are sure no
confirmation emails are still in flight. There is no cost to leaving both.

### While you are on this screen: custom SMTP

Supabase's built-in sender is capped at a few messages an hour, and that cap is
what produced `Error sending confirmation email` during testing.

The school has its own mailbox, which is better than any third party here: one
password, no free-tier limit, and the same address the site sends everything
else from. Point Supabase at it.

Authentication → Emails → SMTP Settings → Enable custom SMTP

```
Host      mail.talibalim.com
Port      465            (implicit TLS; try 587 if the host prefers STARTTLS)
Username  contact@talibalim.com
Password  the mailbox password
Sender    contact@talibalim.com
```

Send the test from that screen **before** turning "Confirm email" back on. Until
it passes, leave confirmation **off** — the code handles both, and an account
that cannot be created is worse than one created without a confirmation step.

Note that this is separate from step 7: Supabase sends the confirmation and
password-reset messages, the app sends receipts and notifications, and they are
two different senders pointed at the same mailbox. When a message does not
arrive, which of the two sent it is the first thing to establish.

## 4. Cloudflare R2 — the CORS policy

R2 → your bucket → Settings → CORS Policy:

```json
[
  {
    "AllowedOrigins": ["https://talibalim.com"],
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
to `https://talibalim.com/api/paypal/webhook`.

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
`https://talibalim.com/api/cron/sweep`.

`CRON_SECRET` does not change. Verify with Actions → Sweep → Run workflow: a
green run printing `HTTP 200` and a small JSON body.

## 7. The app's own e-mail — receipts and alerts

Same mailbox as step 3. In Vercel:

```
SMTP_HOST     = mail.talibalim.com
SMTP_PORT     = 465
SMTP_USER     = contact@talibalim.com
SMTP_PASSWORD = the mailbox password           (Secret)
EMAIL_FROM    = Institut Talib Alim <contact@talibalim.com>
```

This sends the order receipts, the alert when somebody uses the contact form,
and the alert when somebody registers. The alerts go to `SMTP_USER` — the same
mailbox — unless `OFFICE_EMAIL` says otherwise.

Optional by design: unset, every send is a logged no-op. A student still gets
their access and the failure is a line in the log, never a lost sale.

**Resend is gone.** Delete `RESEND_API_KEY` and any old `EMAIL_FROM` pointing
at it — nothing reads them.

---

## Checking it worked

1. **Admin → Diagnostic.** *Adresse publique du site* green. (Covers 2.)
2. **Register a brand-new test account.** It must complete. With confirmation
   on, the email must link to `talibalim.com` and clicking it must land on the
   dashboard. (Covers 3.)
3. **Admin → a live class → Diapositives → upload an image.** (Covers 4.)
4. **Buy something in sandbox** and confirm the entitlement appears in
   Admin → Étudiants — not merely that the success page rendered. (Covers 5.)
5. **Actions → Sweep → Run workflow** → green. (Covers 6.)
6. **Pay once and check the inbox** for the receipt. (Covers 7.)

If step 2 lands on the old domain, the redeploy in step 1 was skipped or the
Supabase list in step 3 was not updated — those are the two usual causes, and
step 1's diagnostic tells you which.
