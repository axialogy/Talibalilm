-- ---------------------------------------------------------------------------
-- Let staff actually create a live class.
--
-- `20260912120000_live_sessions.sql` wrote the policy that allows staff to
-- write this table, and then granted `authenticated` nothing but SELECT. A
-- grant is checked before any policy is consulted, so the policy never got a
-- say: every attempt to schedule a class died on "permission denied for table
-- live_sessions", which the admin screen reported as a failed save.
--
-- The policies are unchanged and remain the control — `live_sessions_write_staff`
-- still restricts these writes to `is_staff()`. This only stops the grant from
-- refusing them first. Non-staff gain nothing: their policy check fails exactly
-- as before.
--
-- Participants and join requests are deliberately NOT widened: those rows are
-- written by the security-definer functions (`live_join`, `live_leave`,
-- `live_decide_join`), which is what keeps a student from admitting themselves.
-- ---------------------------------------------------------------------------

grant insert, update, delete on public.live_sessions to authenticated;
