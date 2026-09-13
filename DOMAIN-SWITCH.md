# The domain: `t.talibalim.com`

The site is reachable at **https://t.talibalim.com**. Nothing in the code knows
that — there is no domain string anywhere in `src/`; every URL the app builds
comes from `siteUrl()`, which reads one variable. What *does* have to be told,
separately, is six outside services. Five of them fail loudly if they are
wrong. One fails silently, and it is the one that stops students registering.

Work down the list in order. Each step says how to tell it worked.

---

## 1. Vercel — the domain itself

Project → Settings → Domains → `t.talibalim.com`, with the DNS record at the
registrar. **Done.**

Check: `https://t.talibalim.com` answers and the certificate is valid. Every
step below assumes that.

## 2. Vercel — `NEXT_PUBLIC_SITE_URL`, then REDEPLOY

Settings → Environment Variables:

```
NEXT_PUBLIC_SITE_URL = https://t.talibalim.com
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
values. (`https://t.talibalim.com/sitemap.xml` is the second opinion — the URLs
inside it must name the new domain.)

## 3. Supabase — the redirect allow list

**This is the one that fails silently.**

Supabase → Authentication → URL Configuration:

- **Site URL** → `https://t.talibalim.com`
- **Redirect URLs** → add `https://t.talibalim.com/auth/callback`

Sign-up confirmation, magic links and password resets all ask Supabase to send
the student to `{siteUrl()}/auth/callback`. Supabase refuses any redirect target
that is not on this list — it does not error, it quietly substitutes the Site
URL. So the symptom is never "an error"; it is a student landing somewhere
unexpected after clicking the link in their email.

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
    "AllowedOrigins": ["https://t.talibalim.com"],
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
to `https://t.talibalim.com/api/paypal/webhook`.

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
`https://t.talibalim.com/api/cron/sweep`.

`CRON_SECRET` does not change. Verify with Actions → Sweep → Run workflow: a
green run printing `HTTP 200` and a small JSON body.

## 7. The app's own e-mail — receipts, alerts, approvals

Same mailbox as step 3. In Vercel:

```
SMTP_HOST     = mail.talibalim.com
SMTP_PORT     = 465
SMTP_USER     = contact@talibalim.com
SMTP_PASSWORD = the mailbox password           (Secret)
EMAIL_FROM    = Institut Talib Alim <contact@talibalim.com>
```

This sends the order receipts, the alert when somebody uses the contact form,
the alert when somebody registers, and the welcome message when you approve an
account.

Optional by design: unset, every send is a logged no-op. A student still gets
their access and the failure is a line in the log, never a lost sale.

**Resend is gone.** Delete `RESEND_API_KEY` and any old `EMAIL_FROM` pointing
at it — nothing reads them.

---

## Checking it worked

1. **Admin → Diagnostic.** *Adresse publique du site* green. (Covers 2.)
2. **Register a brand-new test account.** It must complete. With confirmation
   on, the email must link to `t.talibalim.com` and clicking it must land on the
   dashboard. (Covers 3.)
3. **Admin → a live class → Diapositives → upload an image.** (Covers 4.)
4. **Buy something in sandbox** and confirm the entitlement appears in
   Admin → Étudiants — not merely that the success page rendered. (Covers 5.)
5. **Actions → Sweep → Run workflow** → green. (Covers 6.)
6. **Pay once and check the inbox** for the receipt. (Covers 7.)

If step 2 lands on the old domain, the redeploy in step 1 was skipped or the
Supabase list in step 3 was not updated — those are the two usual causes, and
step 1's diagnostic tells you which.
