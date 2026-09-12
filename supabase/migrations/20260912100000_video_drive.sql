-- ---------------------------------------------------------------------------
-- Google Drive as a video source.
--
-- The school records its live classes with MeetPress, which writes a local
-- .webm, and then puts that file on YouTube or Google Drive. The lesson only
-- ever stores the provider's opaque id — never a playable URL, which is what
-- `lesson_content_video_id_not_url` enforces — and the page builds the embed
-- from a fixed template at render time.
--
-- Nothing here uses the new label: PostgreSQL refuses to read a value added to
-- an enum in the same transaction that added it, so the usage lives in the
-- application and in later migrations.
-- ---------------------------------------------------------------------------

alter type public.video_provider add value if not exists 'drive';
