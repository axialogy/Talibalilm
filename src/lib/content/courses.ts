import type { Course, CourseModule, Instructor, Lesson } from './types';

/* ------------------------------------------------------------------ */
/* Phase 1 fixtures.                                                   */
/*                                                                     */
/* Replaced in Phase 2 by Supabase queries against the same shape. The */
/* accessors at the bottom are the only way the app reads this, so the */
/* swap touches this file and nothing else.                            */
/* ------------------------------------------------------------------ */

export const instructors: Instructor[] = [
  {
    id: 'sihem',
    full_name: 'Sihem',
    role: 'Enseignante',
    bio: "Enseigne les sciences islamiques à l'institut depuis sa fondation. Formée en jurisprudence et en sciences du Coran, elle assure la majorité des cursus, en présentiel comme en visioconférence.",
  },
];

let lessonSeq = 0;

/** Terse fixture builder — the fields that vary, positioned automatically. */
function lesson(
  title: string,
  minutes: number,
  opts: { type?: Lesson['type']; preview?: boolean } = {},
): Omit<Lesson, 'position'> {
  lessonSeq += 1;
  return {
    id: `l-${lessonSeq}`,
    slug: title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60),
    title,
    type: opts.type ?? 'video',
    duration_seconds: minutes * 60,
    is_preview: opts.preview ?? false,
  };
}

function moduleOf(id: string, title: string, position: number, items: Omit<Lesson, 'position'>[]): CourseModule {
  return {
    id,
    title,
    position,
    lessons: items.map((l, i) => ({ ...l, position: i + 1 })),
  };
}

export const courses: Course[] = [
  {
    id: 'c-fiqh',
    slug: 'fiqh-al-ibadat',
    title: 'Jurisprudence islamique — Fiqh al-‘Ibādāt',
    subtitle: 'Purification, prière, jeûne et pèlerinage, avec leurs preuves',
    title_ar: 'فقه العبادات',
    description:
      "Le module le plus suivi de l'institut. On y traite les actes d'adoration dans l'ordre où les ouvrages classiques les présentent : la purification, la prière, le jeûne, la zakat et le pèlerinage. Chaque règle est rattachée à sa preuve, et les divergences entre écoles sont exposées calmement, pour comprendre plutôt que pour trancher.",
    cover_url: null,
    tone: 'sand',
    category: 'fiqh',
    level: 'all',
    format: 'hybride',
    language: 'fr',
    instructor_id: 'sihem',
    status: 'published',
    published_at: '2025-09-01T08:00:00.000Z',
    display_order: 1,
    schedule: 'Vendredi · 19h00 – 21h00',
    duration_weeks: 20,
    objectives: [
      "Accomplir les actes d'adoration en connaissance de cause",
      'Rattacher une règle pratique à sa preuve',
      'Comprendre pourquoi les écoles divergent sur un point',
      "Corriger les erreurs héritées de l'habitude",
    ],
    modules: [
      moduleOf('m-fiqh-1', 'At-Tahāra — la purification', 1, [
        lesson('Les eaux et les impuretés', 42, { preview: true }),
        lesson('Les ablutions, le ghusl et le tayammum', 55),
        lesson('Les règles propres aux femmes', 48),
      ]),
      moduleOf('m-fiqh-2', 'As-Salāt — la prière', 2, [
        lesson('Conditions, piliers et obligations', 61),
        lesson('Les invalidants et les oublis', 47),
        lesson('Prière du voyageur et prière du malade', 39),
        lesson('Contrôle — les piliers de la prière', 15, { type: 'quiz' }),
      ]),
      moduleOf('m-fiqh-3', 'Le jeûne et le pèlerinage', 3, [
        lesson('Le jeûne : piliers, dispenses et rattrapage', 52),
        lesson('La zakat : biens concernés et bénéficiaires', 44),
        lesson('Le Hajj et la ‘Umra étape par étape', 68),
      ]),
    ],
  },
  {
    id: 'c-aqida',
    slug: 'croyance-islamique-aqida',
    title: 'Croyance islamique — ‘Aqīda',
    subtitle: 'Unicité, noms et attributs, foi et au-delà',
    title_ar: 'العقيدة الإسلامية',
    description:
      "Le module d'entrée de tout cursus sérieux. On y étudie les six piliers de la foi, la signification du tawhid et ses catégories, les noms et attributs divins tels que les textes les énoncent, ainsi que les questions de la foi, de ses branches et de ce qui l'annule. Le ton reste celui de l'enseignement : on expose, on démontre, on n'anathématise pas.",
    cover_url: null,
    tone: 'emerald',
    category: 'aqida',
    level: 'beginner',
    format: 'hybride',
    language: 'fr',
    instructor_id: 'sihem',
    status: 'published',
    published_at: '2025-09-01T08:00:00.000Z',
    display_order: 2,
    schedule: 'Samedi · 10h00 – 12h00',
    duration_weeks: 12,
    objectives: [
      'Énoncer et comprendre les six piliers de la foi',
      'Distinguer les catégories du tawhid',
      'Aborder les noms et attributs selon la voie des anciens',
      'Reconnaître ce qui renforce et ce qui annule la foi',
    ],
    modules: [
      moduleOf('m-aqida-1', 'Le tawhid', 1, [
        lesson('Seigneurie, adoration, noms et attributs', 46, { preview: true }),
        lesson('Ce qui contredit le tawhid', 51),
        lesson('Le sens de la shahāda', 38),
      ]),
      moduleOf('m-aqida-2', 'Les piliers de la foi', 2, [
        lesson('Anges, Livres et Messagers', 49),
        lesson('Le Jour dernier et ses signes', 57),
        lesson('Le décret divin, entre volonté et responsabilité', 62),
      ]),
      moduleOf('m-aqida-3', 'La foi et ses branches', 3, [
        lesson('Foi, parole et acte', 44),
        lesson('L’augmentation et la diminution de la foi', 41),
        lesson('Les annulatifs, exposés avec prudence', 53),
      ]),
    ],
  },
  {
    id: 'c-coran',
    slug: 'sciences-du-coran',
    title: 'Sciences du Coran',
    subtitle: 'Révélation, compilation, causes de descente et lectures',
    title_ar: 'علوم القرآن',
    description:
      "Avant d'interpréter, il faut connaître le texte. Ce module présente l'histoire de la révélation et de sa mise par écrit, les circonstances de descente (asbāb an-nuzūl), la distinction mecquois/médinois, la question de l'abrogation et les lectures canoniques. Un socle indispensable pour aborder ensuite l'exégèse sans contresens.",
    cover_url: null,
    tone: 'plum',
    category: 'coran',
    level: 'all',
    format: 'hybride',
    language: 'fr',
    instructor_id: 'sihem',
    status: 'published',
    published_at: '2025-09-15T08:00:00.000Z',
    display_order: 3,
    schedule: 'Dimanche · 10h00 – 12h00',
    duration_weeks: 14,
    objectives: [
      'Retracer les étapes de la révélation et de la compilation',
      'Utiliser les causes de descente à bon escient',
      'Distinguer versets mecquois et médinois',
      'Comprendre ce que recouvrent les lectures canoniques',
    ],
    modules: [
      moduleOf('m-coran-1', 'La révélation', 1, [
        lesson('Modalités et étapes de la descente', 43, { preview: true }),
        lesson('Le premier et le dernier verset révélés', 36),
        lesson('Mecquois et médinois : critères et intérêts', 48),
      ]),
      moduleOf('m-coran-2', 'La compilation', 2, [
        lesson('La collecte sous Abū Bakr', 40),
        lesson('L’unification sous ‘Uthmān', 45),
        lesson('Le rasm et la vocalisation', 39),
      ]),
      moduleOf('m-coran-3', 'Sciences appliquées', 3, [
        lesson('Asbāb an-nuzūl : usage et limites', 47),
        lesson('An-nāsikh wa al-mansūkh', 52),
        lesson('Les sept lettres et les lectures', 55),
      ]),
    ],
  },
  {
    id: 'c-hadith',
    slug: 'sciences-du-hadith',
    title: 'Les Sciences du Hadith',
    subtitle: 'Le statut de la Sunna, le voyage et les sciences du hadith',
    title_ar: 'علوم الحديث',
    description:
      "Comment sait-on qu'un hadith est authentique ? Ce module retrace le parcours de la Sunna, depuis la parole prophétique jusqu'aux grands recueils, et présente les outils que les savants ont forgés pour l'authentifier : la chaîne de transmission, la critique des rapporteurs, la classification des degrés.",
    cover_url: null,
    tone: 'indigo',
    category: 'hadith',
    level: 'all',
    format: 'hybride',
    language: 'fr',
    instructor_id: 'sihem',
    status: 'published',
    published_at: '2025-10-01T08:00:00.000Z',
    display_order: 4,
    schedule: 'Samedi · 14h00 – 16h00',
    duration_weeks: 12,
    objectives: [
      'Situer la Sunna comme source législative aux côtés du Coran',
      'Distinguer sahīh, hasan, da‘īf et mawdū‘',
      'Lire une chaîne de transmission et en comprendre l’apport',
      'Se repérer dans les grands recueils et leurs méthodes',
    ],
    modules: [
      moduleOf('m-hadith-1', 'Le statut de la Sunna', 1, [
        lesson('La Sunna comme deuxième source du droit', 44, { preview: true }),
        lesson('Sunna qawliyya, fi‘liyya et taqrīriyya', 38),
        lesson('Les objections classiques et leurs réponses', 46),
      ]),
      moduleOf('m-hadith-2', 'Le voyage du hadith', 2, [
        lesson('De la mémorisation à la mise par écrit', 41),
        lesson('La génération des Compagnons et des Suivants', 49),
        lesson('La formation des grands recueils', 53),
      ]),
      moduleOf('m-hadith-3', 'Les sciences du hadith', 3, [
        lesson('Sanad et matn : anatomie d’un hadith', 42),
        lesson('La critique des rapporteurs', 58),
        lesson('Les degrés d’authenticité et leurs conséquences', 47),
      ]),
    ],
  },
  {
    id: 'c-tafsir',
    slug: 'exegese-du-coran-tafsir',
    title: 'Exégèse du Qur’an — Tafsīr pratique',
    subtitle: 'Lecture commentée des sourates les plus récitées',
    title_ar: 'التفسير',
    description:
      "Un atelier de lecture plus qu'un cours magistral. On avance sourate par sourate — le juz' ‘Amma d'abord — en explicitant le vocabulaire, le contexte de descente, la cohérence interne du passage, puis ce que les grands exégètes en ont dit.",
    cover_url: null,
    tone: 'crimson',
    category: 'tafsir',
    level: 'intermediate',
    format: 'hybride',
    language: 'fr',
    instructor_id: 'sihem',
    status: 'published',
    published_at: '2025-10-15T08:00:00.000Z',
    display_order: 5,
    schedule: 'Dimanche · 14h00 – 16h00',
    duration_weeks: 16,
    objectives: [
      'Distinguer tafsīr par la tradition et par l’effort d’analyse',
      'Se servir des sources classiques sans les trahir',
      'Expliquer un passage court avec méthode',
      'Relier la récitation quotidienne au sens',
    ],
    modules: [
      moduleOf('m-tafsir-1', 'Méthode', 1, [
        lesson('Les conditions de l’exégèse', 40, { preview: true }),
        lesson('Tafsīr bi-l-ma’thūr et bi-r-ra’y', 45),
        lesson('Les grands ouvrages et leurs orientations', 50),
      ]),
      moduleOf('m-tafsir-2', 'Le juz’ ‘Amma', 2, [
        lesson('An-Nās, Al-Falaq, Al-Ikhlās', 43),
        lesson('Les sourates de l’exhortation', 48),
        lesson('Les scènes de l’au-delà', 52),
      ]),
      moduleOf('m-tafsir-3', 'Sourates longues', 3, [
        lesson('Al-Fātiha, mère du Livre', 46),
        lesson('Āyat al-Kursī et la fin d’Al-Baqara', 54),
        lesson('Sourate Al-Kahf et ses récits', 60),
      ]),
    ],
  },
  {
    id: 'c-langue',
    slug: 'langue-arabe-fondamental',
    title: 'Langue arabe — niveau fondamental',
    subtitle: 'Lire, écrire et comprendre l’arabe littéraire à partir de zéro',
    title_ar: 'اللغة العربية',
    description:
      "Un parcours complet pour poser les bases de la langue du Coran. On part de l'alphabet et de la lecture syllabée, puis on installe progressivement la morphologie (as-sarf) et les règles d'analyse grammaticale (an-nahw). Chaque séance mêle explication, application écrite et lecture à voix haute.",
    cover_url: null,
    tone: 'teal',
    category: 'langue',
    level: 'beginner',
    format: 'hybride',
    language: 'ar',
    instructor_id: 'sihem',
    status: 'published',
    published_at: '2025-11-01T08:00:00.000Z',
    display_order: 6,
    schedule: 'Mardi · 18h30 – 20h00',
    duration_weeks: 24,
    objectives: [
      'Lire un texte vocalisé couramment et sans hésitation',
      'Reconnaître les schèmes verbaux et nominaux les plus fréquents',
      'Analyser une phrase simple et en justifier les désinences',
      'Constituer un premier lexique coranique actif',
    ],
    modules: [
      moduleOf('m-langue-1', 'Lecture et écriture', 1, [
        lesson('L’alphabet, les formes liées et les points d’articulation', 38, { preview: true }),
        lesson('Voyelles brèves, longues et signes de prolongation', 42),
        lesson('Le tanwīn, la chadda et le soukūn', 35),
      ]),
      moduleOf('m-langue-2', 'Morphologie (as-sarf)', 2, [
        lesson('La racine trilitère et la notion de schème', 47),
        lesson('Le verbe accompli et inaccompli', 51),
        lesson('Les formes dérivées les plus courantes', 56),
      ]),
      moduleOf('m-langue-3', 'Grammaire (an-nahw)', 3, [
        lesson('La phrase nominale et la phrase verbale', 44),
        lesson('Sujet, complément et cas de déclinaison', 49),
        lesson('Application sur des versets courts', 53),
      ]),
    ],
  },
];

/* ---- Accessors. Phase 2 swaps these bodies for Supabase queries. ---- */

export function listCourses(): Course[] {
  return courses
    .filter((c) => c.status === 'published')
    .slice()
    .sort((a, b) => a.display_order - b.display_order);
}

export function getCourse(slug: string): Course | undefined {
  return courses.find((c) => c.slug === slug && c.status === 'published');
}

export function getInstructor(id: string): Instructor | undefined {
  return instructors.find((i) => i.id === id);
}

export function relatedCourses(course: Course, limit = 3): Course[] {
  const others = listCourses().filter((c) => c.id !== course.id);
  const sameField = others.filter((c) => c.category === course.category);
  const rest = others.filter((c) => c.category !== course.category);
  return [...sameField, ...rest].slice(0, limit);
}
