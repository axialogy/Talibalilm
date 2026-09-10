# Phase 2 — Courses and content

Status: **complete**, with one item blocked on missing input. Nothing from
phases 3–6 has been scaffolded.

---

## What works

**Schema.** `courses`, `modules`, `lessons`, `lesson_content`, `enrollments`,
`lesson_progress`, plus a minimal `memberships`. Every table has RLS enabled
*and forced*, with its policies in the same migration file.

**The gate.** 29 policy assertions in `supabase/tests/rls_courses.sql`, run
against a real Postgres 16. The ones that matter:

- an anonymous visitor reads lesson **titles** but reaches exactly one
  `lesson_content` row — the free preview
- a direct query *by* the secret video id returns nothing
- a signed-in account with no membership is treated exactly like an anonymous one
- an **expired** membership grants nothing
- a membership row still flagged `active` but past `expires_at` grants nothing —
  the clock decides, not the column, so the nightly sweep is a tidy-up rather
  than the enforcement
- a member reaches every lesson of every **published** course, and no draft
- a member cannot grant themselves a membership: no insert privilege exists

**Admin course builder.** `/admin/courses` lists everything including drafts;
`/admin/courses/[id]` edits course metadata, adds and renames modules, adds
lessons, edits lesson body/video id/duration/preview flag, reorders with
up/down, publishes and unpublishes.

**Lesson viewer.** `/dashboard/courses/[slug]/lessons/[id]` — syllabus sidebar
with progress ticks, mark-complete, previous/next, and a paywall that appears
because the database returned nothing, not because a branch decided to hide
something it was holding.

**Data layer.** `src/lib/data/courses.ts` reads Supabase when configured and
falls back to the Phase 1 fixtures otherwise, so the marketing site stays
deployable before the database exists.

**Tests.** 14 unit, 42 e2e (desktop + mobile), 45 SQL policy assertions.

---

## The deliberate departure from the spec

**§3's `lessons` table cannot work as written.** It asks for lesson titles to be
public while `content` and `video_id` stay members-only. That is two
sensitivities in one row, and Postgres RLS is row-level: one policy cannot
expose a row's title and hide its body.

So the gated fields live in `lesson_content`, keyed 1:1 to `lessons`, with its
own policy. `lessons` stays world-readable and carries only what a shopper may
see. Everything else in §3 is unchanged.

**`memberships` moved from Phase 3 to Phase 2.** The gate has to read something
to decide what "member" means, and a gate that cannot be tested is not a gate.
Phase 3 adds `membership_plans`, `orders`, `coupons` and the grant function on
top of the table created here.

---

## What is stubbed or blocked

| Thing | State |
|---|---|
| **Content migration script** | **Blocked.** It needs `ui-reference/content/`, which was never delivered. Nothing else in the phase depends on it. |
| Video playback | The viewer renders a placeholder where the player goes. Phase 5 supplies the signed URL. `video_id` is stored as an opaque id and a check constraint rejects a URL, so a leak now cannot become permanent. |
| Rich text | Lesson bodies are plain textarea + whitespace-preserved rendering. A real editor is a Phase 6 concern. |
| Drag-and-drop reordering | Up/down buttons instead — see below. |
| Quizzes and assignments | `lesson.type` accepts them; the screens are Phase 6. |

---

## Security concerns

**1. The policy tests caught a real bug in my own work.** The first version of
`lesson_content_select_member` checked `has_active_membership()` and nothing
else — so a paying member could read the content of an unpublished draft
course. Publication and payment are separate axes and both have to hold. Fixed;
the assertion that catches it is *"not even a member sees an unpublished
course"*. This is the argument for the SQL tests existing at all.

**2. Rate limiting is still in-process.** Unchanged from Phase 1 and still the
top pre-launch item. It must be replaced before Phase 3, because coupon
redemption is where brute force actually pays.

**3. `service_role` still has no audit trail.** Nothing calls
`createAdminClient()` yet. The first caller arrives in Phase 3 with the Stripe
webhook, and the audit table should land in the same commit, not after.

**4. Enrolment writes require membership, which is right but worth naming.**
`enrollments_insert_own` and `progress_insert_own` both require
`has_active_membership()`. A non-member browsing a preview therefore records no
progress at all. That is intended — but it means preview-lesson progress is
invisible, which will look like a bug when someone asks why the free lesson
never shows a tick.

---

## What I would do differently

**Reordering is up/down buttons, not drag-and-drop.** The spec asks for
drag-and-drop and calls the builder the most-used screen. The buttons are
keyboard-operable and screen-reader-legible for free, work on touch without a
long-press, and each press is one swap the database validates against the
`(course_id, position)` unique constraint. Drag-and-drop is the nicer gesture
for a sighted mouse user and is worth adding **on top** — but shipping it
*instead* would have traded accessibility for feel. Flagging it as an explicit
deviation rather than quietly declaring the requirement met.

**The client message payload was shipping the whole catalogue.** Every page
serialised all 267 strings — pricing FAQ, legal copy, admin form labels — into
the RSC payload for an anonymous visitor. Now only namespaces a Client
Component actually renders are sent, and
`tests/unit/client-messages.test.ts` fails the build if that list drifts in
either direction. Worth checking the same thing in Phase 3, since Stripe error
copy is easy to leak this way.

**Position swapping is two round trips.** `swapPositions` issues two updates.
The unique constraint is `deferrable initially deferred` so they cannot
collide, but a single RPC would be one trip and genuinely atomic. Worth doing
when the builder grows bulk reordering.
