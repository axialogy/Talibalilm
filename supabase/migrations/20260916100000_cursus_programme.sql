-- ---------------------------------------------------------------------------
-- The cursus programme, shown inside the card
--
-- "Voir le cursus" used to link away to the checkout. It now opens an accordion
-- inside the card, and that accordion needs something to show: the office's own
-- programme, as a written outline and/or a poster image.
--
-- Two columns rather than one:
--   * `details` is the written programme, one line per entry. The card keeps
--     the line breaks and bolds the lines that start with a section emoji.
--   * `image_url` is the poster the office uploads (Supabase Storage, like an
--     event image). Either may be empty; the accordion appears when one of them
--     is set, and disappears when both are.
--
-- The seed below is the school's real programme for the Cursus Approfondi,
-- including the teen track, which is a variant of the same three-year cursus
-- rather than a third route through the checkout. It is written only where the
-- office has not already written its own text, so re-running never overwrites
-- an edit made in the admin panel.
-- ---------------------------------------------------------------------------

alter table public.cursus
  add column if not exists details   text not null default '',
  add column if not exists image_url text;

comment on column public.cursus.details is
  'The written programme shown in the "Voir le cursus" accordion. One line per entry.';
comment on column public.cursus.image_url is
  'Poster image of the programme, shown in the "Voir le cursus" accordion.';

-- ---- Par module -----------------------------------------------------------

update public.cursus
set details = '➡️ Vous choisissez les modules qui vous intéressent.
🔹 Chaque module se suit sur une année complète.
🔹 Les modules peuvent être pris séparément, dans l’ordre que vous voulez.
🔹 Une certification de présence est délivrée à la fin du module.',
    updated_at = now()
where kind = 'module'
  and btrim(details) = '';

-- ---- Cursus Approfondi ----------------------------------------------------

-- The programme the school actually runs is three years. The row was created
-- with the maximum of five so years four and five could be added without a
-- migration; nothing is sold beyond year one today, so it is corrected here
-- rather than left advertising two years that do not exist.
update public.cursus
set year_count = 3,
    updated_at = now()
where kind = 'approfondi'
  and year_count = 5;

update public.cursus
set details = '📚 INSTITUT TALIB AL-ʿILM
✨ Parcours de formation pour hommes et femmes sur 3 ans

➡️ 1ʳᵉ ANNÉE
🔹 Fondements de la jurisprudence
🔹 Jurisprudence des actes cultuels : tahara
🔹 Tajwid du Coran niv. 1 ou langue arabe niv. 1, selon le forfait choisi

➡️ 2ᵉ ANNÉE
🔹 Jurisprudence des actes cultuels : la prière, le jeûne
🔹 ʿAqīdah – Croyance musulmane : la foi en Allah, la foi en Ses messagers
🔹 Histoire de l’islam : la période mequoise de la vie du Prophète ﷺ
🔹 Tajwid du Coran niv. 2 ou langue arabe niv. 2, selon le forfait choisi

➡️ 3ᵉ ANNÉE
🔹 Jurisprudence des actes cultuels : zakat, pèlerinage
🔹 Sciences du Coran
🔹 Tajwid niv. 3 + perfectionnement de la récitation
🔹 Mémorisation du Coran
🔹 Langue arabe niv. 3, selon le forfait choisi

💳 PLUSIEURS FORMULES PROPOSÉES
🔸 Théologie uniquement
🔸 Théologie avec tajwid et Coran
🔸 Théologie avec langue arabe

🎓 CERTIFICATION
➡️ Une certification de l’Institut Talib al-ʿIlm sera délivrée à la fin du parcours de trois ans.
⚠️ Son obtention nécessite :
✅ Une présence régulière à tous les cours
✅ Une assiduité sérieuse pendant les trois années
✅ La validation de l’ensemble du parcours choisi

📖 PARCOURS ADOS – THÉOLOGIE ET CORAN SUR 3 ANS
➡️ 1ʳᵉ ANNÉE
🔹 Fondements de la jurisprudence
🔹 Purification
🔹 ʿAqīdah : foi en Allah, aux prophètes et aux Livres révélés
🔹 Histoire de l’islam : période mecquoise
🔹 Tajwid : première partie
🔹 Mémorisation : Hizb Sabbih

➡️ 2ᵉ ANNÉE
🔹 Jurisprudence : prière et jeûne
🔹 ʿAqīdah : foi au destin et au Jour du jugement
🔹 Histoire de l’islam : période médinoise
🔹 Tajwid : deuxième partie
🔹 Mémorisation : complément du Juzʾ ʿAmma

➡️ 3ᵉ ANNÉE
🔹 Jurisprudence : Zakāt et Ḥajj
🔹 Histoire de l’islam : les califes bien guidés, les Omeyyades, les Abbassides et les Ottomans jusqu’à l’époque contemporaine
🔹 Perfectionnement du tajwid
🔹 Mémorisation : Juzʾ Tabārak

📖 OBJECTIF CORAN
➡️ Mémoriser deux à trois Juzʾ du Coran, selon le niveau et la progression de chaque élève.

🎓 CERTIFICATION
➡️ Une certification de l’Institut Talib al-ʿIlm sera délivrée à la fin du parcours de trois ans.
⚠️ Son obtention nécessite :
✅ Une présence régulière à tous les cours
✅ Une assiduité sérieuse pendant les trois années
✅ La validation du parcours de théologie et de Coran',
    updated_at = now()
where kind = 'approfondi'
  and btrim(details) = '';
