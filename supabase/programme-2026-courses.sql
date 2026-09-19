-- ---------------------------------------------------------------------------
-- The 2026 teaching programme: the nineteen courses
--
-- This is DATA, not schema. It is not a migration: it is the school's
-- programme, written once, and it is pasted into Supabase → SQL Editor on the
-- project that already has the tables. `./supabase/bundle.sh` deliberately
-- does not include it — a fresh project should not inherit a year's catalogue
-- it did not ask for.
--
-- What it does NOT do, on purpose:
--   * no cursus is created — the two the application needs (`Par module`,
--     `Cursus Approfondi`) already exist and are edited nowhere else;
--   * no programme grid — which module sits in which year of the cursus is
--     ticked on each module's Cursus step, by the office;
--   * no price — a tariff is a decision about money and is entered on the
--     module's Tarif step, by the office;
--   * no cover and no gallery — the images are added on the module's Contenu
--     step, by the office;
--   * everything is left `draft`, so nothing is visible to students until the
--     office publishes it.
--
-- Idempotent by slug: pasting it twice cannot duplicate a course, and it never
-- overwrites a row the office has since edited (`do nothing`).
--
-- Titles, Arabic names, categories, levels and prerequisites come from the
-- school's brief. Subtitles and descriptions were drafted from the course
-- subjects and are meant to be reviewed in Admin → the module → Détails.
--
-- Prerequisite: the brief says "Savoir lire l'arabe" for the Tajwid levels,
-- Mémorisation, and everything in the teens programme — which shares five
-- rows with the adults (Fondements, Purification, Prière et jeûne, Zakât,
-- Histoire mecquoise). They carry it here too.
-- ---------------------------------------------------------------------------

insert into public.courses
  (slug, title, subtitle, description, title_ar, category, level, format,
   duration_weeks, requirements, display_order, status)
values
  (
    'fondements-de-la-jurisprudence',
    'Fondements de la jurisprudence',
    'Comprendre d’où viennent les règles et comment on les déduit.',
    'Comprendre comment les règles sont déduites du Coran et de la Sunna, et étudier les actes d’adoration.',
    'أصول الفقه',
    'fiqh', 'beginner', 'hybride', 30,
    '["Savoir lire l’arabe"]'::jsonb, 1, 'draft'
  ),
  (
    'jurisprudence-la-purification',
    'Jurisprudence des actes cultuels — La purification',
    'Les règles de la pureté, avant la prière.',
    'Étudier les règles de la purification — l’eau, les impuretés, les ablutions et ce qui les annule — pour accomplir les actes d’adoration en toute clarté.',
    'فقه العبادات: الطهارة',
    'fiqh', 'beginner', 'hybride', 30,
    '["Savoir lire l’arabe"]'::jsonb, 2, 'draft'
  ),
  (
    'jurisprudence-priere-et-jeune',
    'Jurisprudence des actes cultuels — Prière et jeûne',
    'Les règles de la prière et du jeûne, en pratique.',
    'Étudier les conditions, les piliers et les actes de la prière, puis les règles du jeûne de Ramadan, à partir des textes et de la jurisprudence classique.',
    'فقه العبادات: الصلاة والصيام',
    'fiqh', 'intermediate', 'hybride', 30,
    '["Savoir lire l’arabe"]'::jsonb, 3, 'draft'
  ),
  (
    'jurisprudence-zakat-et-pelerinage',
    'Jurisprudence des actes cultuels — Zakât et pèlerinage',
    'Les deux grands actes d’adoration : l’aumône et le pèlerinage.',
    'Étudier les règles de la zakât — son calcul et ses bénéficiaires — puis celles du pèlerinage et de la ʿumra, à partir des textes et de la jurisprudence classique.',
    'فقه العبادات: الزكاة والحج',
    'fiqh', 'advanced', 'hybride', 30,
    '["Savoir lire l’arabe"]'::jsonb, 4, 'draft'
  ),
  (
    'aqida-allah-et-ses-messagers',
    'ʿAqīdah — La foi en Allah et en Ses messagers',
    'Ce que le musulman croit au sujet d’Allah et de Ses messagers.',
    'Étudier la croyance en Allah — Ses noms, Ses attributs et ce qu’elle implique — et la foi en Ses messagers, d’après le Coran et la Sunna.',
    'العقيدة: الإيمان بالله ورسله',
    'aqida', 'intermediate', 'hybride', 30,
    '[]'::jsonb, 5, 'draft'
  ),
  (
    'aqida-allah-prophetes-et-livres',
    'ʿAqīdah — La foi en Allah, aux prophètes et aux Livres',
    'Les fondements de la croyance, expliqués simplement.',
    'Découvrir les fondements de la croyance musulmane : la foi en Allah, en Ses prophètes et en Ses Livres révélés, expliquée simplement à partir des textes.',
    'العقيدة: الإيمان بالله وأنبيائه وكتبه',
    'aqida', 'beginner', 'hybride', 30,
    '["Savoir lire l’arabe"]'::jsonb, 6, 'draft'
  ),
  (
    'aqida-destin-et-jour-du-jugement',
    'ʿAqīdah — La foi au destin et au Jour du jugement',
    'La foi au destin et à la vie dernière.',
    'Étudier la foi au décret divin et au Jour du jugement, et ce qu’elle change dans la vie du croyant, d’après le Coran et la Sunna.',
    'العقيدة: الإيمان بالقدر واليوم الآخر',
    'aqida', 'intermediate', 'hybride', 30,
    '["Savoir lire l’arabe"]'::jsonb, 7, 'draft'
  ),
  (
    'histoire-periode-mecquoise',
    'Histoire de l’islam — La période mecquoise',
    'Les débuts de la révélation, à La Mecque.',
    'Suivre la période mecquoise de la vie du Prophète ﷺ : la révélation, l’appel, la patience des premiers croyants et les leçons à en tirer.',
    'السيرة النبوية: العهد المكي',
    'histoire', 'beginner', 'hybride', 30,
    '["Savoir lire l’arabe"]'::jsonb, 8, 'draft'
  ),
  (
    'histoire-periode-medinoise',
    'Histoire de l’islam — La période médinoise',
    'La vie du Prophète ﷺ à Médine et la naissance de la communauté.',
    'Étudier la période médinoise : l’installation à Médine, la construction de la communauté, les grandes étapes et les leçons de cette période.',
    'السيرة النبوية: العهد المدني',
    'histoire', 'intermediate', 'hybride', 30,
    '["Savoir lire l’arabe"]'::jsonb, 9, 'draft'
  ),
  (
    'histoire-des-califes-a-aujourd-hui',
    'Histoire de l’islam — Des califes bien guidés à l’époque contemporaine',
    'Des califes bien guidés aux empires musulmans, jusqu’à aujourd’hui.',
    'Parcourir l’histoire des califes bien guidés, puis des Omeyyades, des Abbassides et des Ottomans jusqu’à l’époque contemporaine, pour situer les grandes étapes de la civilisation musulmane.',
    'التاريخ الإسلامي: الخلفاء الراشدون والدول',
    'histoire', 'advanced', 'hybride', 30,
    '["Savoir lire l’arabe"]'::jsonb, 10, 'draft'
  ),
  (
    'sciences-du-coran',
    'Sciences du Coran',
    'Les sciences qui éclairent la lecture du Coran.',
    'Mieux comprendre le Coran à travers les principales sciences qui permettent de l’interpréter.',
    'علوم القرآن',
    'coran', 'intermediate', 'hybride', 30,
    '[]'::jsonb, 11, 'draft'
  ),
  (
    'tajwid-niveau-1',
    'Tajwid — Niveau 1',
    'Lire le Coran en appliquant les règles du tajwid.',
    'Apprendre à lire le Coran avec les règles du tajwid : les points d’articulation des lettres et leurs qualités, avec une application progressive.',
    'التجويد — المستوى الأول',
    'coran', 'beginner', 'hybride', 30,
    '["Savoir lire l’arabe"]'::jsonb, 12, 'draft'
  ),
  (
    'tajwid-niveau-2',
    'Tajwid — Niveau 2',
    'Approfondir les règles et les appliquer dans la récitation.',
    'Poursuivre l’étude du tajwid : les règles de la récitation, les prolongations et les rencontres entre lettres, avec une pratique suivie.',
    'التجويد — المستوى الثاني',
    'coran', 'intermediate', 'hybride', 30,
    '["Savoir lire l’arabe"]'::jsonb, 13, 'draft'
  ),
  (
    'tajwid-niveau-3-et-perfectionnement',
    'Tajwid — Niveau 3 et perfectionnement',
    'Maîtriser la récitation et la perfectionner.',
    'Perfectionner la récitation : les règles avancées du tajwid, la précision des points d’articulation et un suivi individuel de la lecture.',
    'التجويد — المستوى الثالث والإتقان',
    'coran', 'advanced', 'hybride', 30,
    '["Savoir lire l’arabe"]'::jsonb, 14, 'draft'
  ),
  (
    'memorisation-du-coran',
    'Mémorisation du Coran',
    'Mémoriser le Coran avec un suivi régulier.',
    'Mémoriser le Coran par étapes, avec une méthode régulière et un suivi individuel, selon le niveau et la progression de chaque élève.',
    'حفظ القرآن الكريم',
    'coran', 'all', 'hybride', 30,
    '["Savoir lire l’arabe"]'::jsonb, 15, 'draft'
  ),
  (
    'lecture-de-l-arabe-nourania',
    'Lecture de l’arabe — Al-Qāʿida an-Nūrāniyya',
    'Lire l’arabe et prononcer correctement les lettres.',
    'Apprendre à lire l’arabe, bien prononcer les lettres et accéder à la lecture du Coran.',
    'القاعدة النورانية',
    'langue', 'beginner', 'hybride', 30,
    '[]'::jsonb, 16, 'draft'
  ),
  (
    'langue-arabe-niveau-1',
    'Langue arabe — Niveau 1',
    'Premiers pas en arabe : lire, écrire et comprendre.',
    'Apprendre les bases de la langue arabe : lecture, écriture et premières notions de grammaire, avec des exercices réguliers.',
    'اللغة العربية — المستوى الأول',
    'langue', 'beginner', 'hybride', 30,
    '[]'::jsonb, 17, 'draft'
  ),
  (
    'langue-arabe-niveau-2',
    'Langue arabe — Niveau 2',
    'Consolider la grammaire et le vocabulaire.',
    'Poursuivre l’étude de la langue arabe : grammaire, conjugaison et vocabulaire, avec des textes simples et des exercices d’application.',
    'اللغة العربية — المستوى الثاني',
    'langue', 'intermediate', 'hybride', 30,
    '[]'::jsonb, 18, 'draft'
  ),
  (
    'langue-arabe-niveau-3',
    'Langue arabe — Niveau 3',
    'Lire et comprendre des textes arabes.',
    'Approfondir la langue arabe : analyse grammaticale, compréhension de textes et expression écrite, pour lire les textes arabes avec plus d’aisance.',
    'اللغة العربية — المستوى الثالث',
    'langue', 'advanced', 'hybride', 30,
    '[]'::jsonb, 19, 'draft'
  )
on conflict (slug) do nothing;
