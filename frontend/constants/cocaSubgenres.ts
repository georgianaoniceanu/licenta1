/**
 * COCA Subgenres — full 96-category taxonomy.
 *
 * Source: coca_genre_data.json (backend/app/services/coca_genre_data.json),
 *   ultimately derived from the Corpus of Contemporary American English
 *   (Davies 2008–2024), lemmas_60k_subgenres.xlsx.
 *
 * Nine main genres × 96 fine-grained subcategories.
 * IDs 101–214 mirror the corpus' internal column codes.
 */

export type CocaMainKey = 'SPOK' | 'FIC' | 'MAG' | 'NEWS' | 'ACAD' | 'Web' | 'Blog' | 'Mov' | 'TV';

export interface CocaSubgenre {
  id: number;            // 101..214 — corpus column code
  code: string;          // "SPOK:ABC"
  main: CocaMainKey;     // top-level genre
  sub: string;           // "ABC"
  label: string;         // human-readable name
  icon: string;          // emoji
  description: string;
}

export interface CocaMainMeta {
  key: CocaMainKey;
  label: string;
  color: string;
  icon: string;
  description: string;
}

// ── Main category metadata ───────────────────────────────────────────────────
export const COCA_MAIN_CATEGORIES: CocaMainMeta[] = [
  { key: 'SPOK', label: 'Spoken',    color: '#10B981', icon: '🗣️', description: 'TV/radio broadcasts, news anchors' },
  { key: 'FIC',  label: 'Fiction',   color: '#7C6FFF', icon: '📖', description: 'Novels, short stories, fan fiction' },
  { key: 'MAG',  label: 'Magazine',  color: '#F59E0B', icon: '📰', description: 'Magazines, periodicals' },
  { key: 'NEWS', label: 'News',      color: '#FF7A59', icon: '🗞️', description: 'Newspapers (intl, national, local)' },
  { key: 'ACAD', label: 'Academic',  color: '#1EE8B5', icon: '🎓', description: 'Peer-reviewed journals, textbooks' },
  { key: 'Web',  label: 'Web',       color: '#60A5FA', icon: '🌐', description: 'General web pages (info, instr, reviews)' },
  { key: 'Blog', label: 'Blog',      color: '#E879F9', icon: '✍️', description: 'Personal & professional blogs' },
  { key: 'Mov',  label: 'Movies',    color: '#FB7185', icon: '🎬', description: 'Movie scripts and subtitles' },
  { key: 'TV',   label: 'TV',        color: '#A78BFA', icon: '📺', description: 'TV scripts and subtitles' },
];

export const COCA_MAIN_BY_KEY: Record<CocaMainKey, CocaMainMeta> =
  Object.fromEntries(COCA_MAIN_CATEGORIES.map(c => [c.key, c])) as any;

// ── All 96 subgenres ─────────────────────────────────────────────────────────
export const COCA_SUBGENRES: CocaSubgenre[] = [
  // SPOK (9)
  { id: 101, code: 'SPOK:ABC',          main: 'SPOK', sub: 'ABC',         label: 'ABC News',          icon: '📺', description: 'ABC TV broadcasts' },
  { id: 102, code: 'SPOK:NBC',          main: 'SPOK', sub: 'NBC',         label: 'NBC News',          icon: '📺', description: 'NBC TV broadcasts' },
  { id: 103, code: 'SPOK:CBS',          main: 'SPOK', sub: 'CBS',         label: 'CBS News',          icon: '📺', description: 'CBS TV broadcasts' },
  { id: 104, code: 'SPOK:CNN',          main: 'SPOK', sub: 'CNN',         label: 'CNN',               icon: '📰', description: 'CNN news broadcasts' },
  { id: 105, code: 'SPOK:FOX',          main: 'SPOK', sub: 'FOX',         label: 'FOX News',          icon: '📰', description: 'FOX news broadcasts' },
  { id: 106, code: 'SPOK:MSNBC',        main: 'SPOK', sub: 'MSNBC',       label: 'MSNBC',             icon: '📰', description: 'MSNBC news broadcasts' },
  { id: 107, code: 'SPOK:PBS',          main: 'SPOK', sub: 'PBS',         label: 'PBS',               icon: '📺', description: 'PBS public broadcasting' },
  { id: 108, code: 'SPOK:NPR',          main: 'SPOK', sub: 'NPR',         label: 'NPR Radio',         icon: '📻', description: 'NPR public radio' },
  { id: 109, code: 'SPOK:Indep',        main: 'SPOK', sub: 'Indep',       label: 'Independent',       icon: '🎙️', description: 'Independent broadcasts' },

  // FIC (6)
  { id: 114, code: 'FIC:Gen (Book)',    main: 'FIC',  sub: 'Gen (Book)',  label: 'Books (General)',   icon: '📚', description: 'General fiction books' },
  { id: 115, code: 'FIC:Gen (Jrnl)',    main: 'FIC',  sub: 'Gen (Jrnl)',  label: 'Journal Fiction',   icon: '📓', description: 'Literary journals' },
  { id: 116, code: 'FIC:SciFi/Fant',    main: 'FIC',  sub: 'SciFi/Fant',  label: 'Sci-Fi & Fantasy',  icon: '🚀', description: 'Science fiction and fantasy' },
  { id: 117, code: 'FIC:Juvenile',      main: 'FIC',  sub: 'Juvenile',    label: "Children's Fiction", icon: '🧸', description: 'Books for young readers' },
  { id: 118, code: 'FIC:Movies',        main: 'FIC',  sub: 'Movies',      label: 'Movie Tie-ins',     icon: '🎞️', description: 'Movie-based novels' },
  { id: 119, code: 'FIC:Fan Fiction',   main: 'FIC',  sub: 'Fan Fiction', label: 'Fan Fiction',       icon: '✨', description: 'Fan-created stories' },

  // MAG (11)
  { id: 123, code: 'MAG:News/Opin',     main: 'MAG',  sub: 'News/Opin',   label: 'News & Opinion',    icon: '📰', description: 'News magazines, opinion pieces' },
  { id: 124, code: 'MAG:Financial',     main: 'MAG',  sub: 'Financial',   label: 'Financial',         icon: '💰', description: 'Forbes, Fortune, financial periodicals' },
  { id: 125, code: 'MAG:Sci/Tech',      main: 'MAG',  sub: 'Sci/Tech',    label: 'Science & Tech',    icon: '🔬', description: 'Scientific American, Wired, Popular Mechanics' },
  { id: 126, code: 'MAG:Soc/Arts',      main: 'MAG',  sub: 'Soc/Arts',    label: 'Society & Arts',    icon: '🎨', description: 'Cultural and arts magazines' },
  { id: 127, code: 'MAG:Religion',      main: 'MAG',  sub: 'Religion',    label: 'Religion',          icon: '🕊️', description: 'Religious periodicals' },
  { id: 128, code: 'MAG:Sports',        main: 'MAG',  sub: 'Sports',      label: 'Sports',            icon: '⚽', description: 'Sports Illustrated, ESPN Magazine' },
  { id: 129, code: 'MAG:Entertain',     main: 'MAG',  sub: 'Entertain',   label: 'Entertainment',     icon: '🎭', description: 'People, Entertainment Weekly' },
  { id: 130, code: 'MAG:Home/Health',   main: 'MAG',  sub: 'Home/Health', label: 'Home & Health',     icon: '🏠', description: 'Home, garden, health, wellness' },
  { id: 131, code: 'MAG:Afric-Amer',    main: 'MAG',  sub: 'Afric-Amer',  label: 'African-American',  icon: '✊', description: 'Ebony, Essence, etc.' },
  { id: 132, code: 'MAG:Children',      main: 'MAG',  sub: 'Children',    label: "Children's Magazines", icon: '🧒', description: 'Highlights, etc.' },
  { id: 133, code: 'MAG:Women/Men',     main: 'MAG',  sub: 'Women/Men',   label: 'Women / Men',       icon: '👥', description: 'Lifestyle gender-targeted magazines' },

  // NEWS (8)
  { id: 135, code: 'NEWS:Misc',         main: 'NEWS', sub: 'Misc',        label: 'News Misc',         icon: '📃', description: 'Miscellaneous news' },
  { id: 136, code: 'NEWS:News_Intl',    main: 'NEWS', sub: 'News_Intl',   label: 'International',     icon: '🌍', description: 'International news' },
  { id: 137, code: 'NEWS:News_Natl',    main: 'NEWS', sub: 'News_Natl',   label: 'National',          icon: '🏛️', description: 'National news' },
  { id: 138, code: 'NEWS:News_Local',   main: 'NEWS', sub: 'News_Local',  label: 'Local',             icon: '📍', description: 'Local news' },
  { id: 139, code: 'NEWS:Money',        main: 'NEWS', sub: 'Money',       label: 'Money & Business',  icon: '💵', description: 'Business and financial news' },
  { id: 140, code: 'NEWS:Life',         main: 'NEWS', sub: 'Life',        label: 'Lifestyle',         icon: '🌿', description: 'Life and lifestyle' },
  { id: 141, code: 'NEWS:Sports',       main: 'NEWS', sub: 'Sports',      label: 'Sports News',       icon: '🏆', description: 'Sports reporting' },
  { id: 142, code: 'NEWS:Editorial',    main: 'NEWS', sub: 'Editorial',   label: 'Editorial',         icon: '✒️', description: 'Op-eds and editorials' },

  // ACAD (10)
  { id: 144, code: 'ACAD:History',      main: 'ACAD', sub: 'History',     label: 'History',           icon: '🏛️', description: 'Historical academic writing' },
  { id: 145, code: 'ACAD:Education',    main: 'ACAD', sub: 'Education',   label: 'Education',         icon: '🎓', description: 'Education research journals' },
  { id: 146, code: 'ACAD:Geog/SocSci',  main: 'ACAD', sub: 'Geog/SocSci', label: 'Geography & Social Sciences', icon: '🗺️', description: 'Geography, sociology, anthropology' },
  { id: 147, code: 'ACAD:Law/PolSci',   main: 'ACAD', sub: 'Law/PolSci',  label: 'Law & Political Science', icon: '⚖️', description: 'Law journals, political science' },
  { id: 148, code: 'ACAD:Humanities',   main: 'ACAD', sub: 'Humanities',  label: 'Humanities',        icon: '📚', description: 'Literature, philosophy, arts' },
  { id: 149, code: 'ACAD:Phil/Rel',     main: 'ACAD', sub: 'Phil/Rel',    label: 'Philosophy & Religion', icon: '🕉️', description: 'Philosophy and religious studies' },
  { id: 150, code: 'ACAD:Sci/Tech',     main: 'ACAD', sub: 'Sci/Tech',    label: 'Science & Technology', icon: '🔬', description: 'STEM journals' },
  { id: 151, code: 'ACAD:Medicine',     main: 'ACAD', sub: 'Medicine',    label: 'Medicine',          icon: '⚕️', description: 'Medical journals' },
  { id: 152, code: 'ACAD:Misc',         main: 'ACAD', sub: 'Misc',        label: 'Academic Misc',     icon: '📑', description: 'Other academic' },
  { id: 153, code: 'ACAD:Business',     main: 'ACAD', sub: 'Business',    label: 'Business',          icon: '💼', description: 'Business research, management' },

  // Web (10)
  { id: 160, code: 'Web:Acad',          main: 'Web',  sub: 'Acad',        label: 'Web Academic',      icon: '🎓', description: 'Academic web content' },
  { id: 161, code: 'Web:Arg',           main: 'Web',  sub: 'Arg',         label: 'Web Argumentation', icon: '💬', description: 'Argumentative web content' },
  { id: 162, code: 'Web:Fic',           main: 'Web',  sub: 'Fic',         label: 'Web Fiction',       icon: '📖', description: 'Fiction on the web' },
  { id: 163, code: 'Web:Info',          main: 'Web',  sub: 'Info',        label: 'Web Information',   icon: 'ℹ️', description: 'Informational web pages' },
  { id: 164, code: 'Web:Instr',         main: 'Web',  sub: 'Instr',       label: 'Web Instructions',  icon: '📋', description: 'How-to, tutorials' },
  { id: 165, code: 'Web:Legal',         main: 'Web',  sub: 'Legal',       label: 'Web Legal',         icon: '⚖️', description: 'Legal web content' },
  { id: 166, code: 'Web:News',          main: 'Web',  sub: 'News',        label: 'Web News',          icon: '🗞️', description: 'Online news' },
  { id: 167, code: 'Web:Pers',          main: 'Web',  sub: 'Pers',        label: 'Web Personal',      icon: '👤', description: 'Personal web pages' },
  { id: 168, code: 'Web:Revw',          main: 'Web',  sub: 'Revw',        label: 'Web Reviews',       icon: '⭐', description: 'Product/service reviews' },
  { id: 169, code: 'Web:Misc',          main: 'Web',  sub: 'Misc',        label: 'Web Misc',          icon: '🌐', description: 'Other web content' },

  // Blog (11)
  { id: 171, code: 'Blog:Acad',         main: 'Blog', sub: 'Acad',        label: 'Academic Blog',     icon: '🎓', description: 'Academic blogs' },
  { id: 172, code: 'Blog:Arg',          main: 'Blog', sub: 'Arg',         label: 'Argument Blog',     icon: '💬', description: 'Argumentative blogs' },
  { id: 173, code: 'Blog:Fic',          main: 'Blog', sub: 'Fic',         label: 'Fiction Blog',      icon: '📖', description: 'Fiction blogs' },
  { id: 174, code: 'Blog:Info',         main: 'Blog', sub: 'Info',        label: 'Info Blog',         icon: 'ℹ️', description: 'Informational blogs' },
  { id: 175, code: 'Blog:Instr',        main: 'Blog', sub: 'Instr',       label: 'Tutorial Blog',     icon: '📋', description: 'How-to blogs' },
  { id: 176, code: 'Blog:Legal',        main: 'Blog', sub: 'Legal',       label: 'Legal Blog',        icon: '⚖️', description: 'Legal/law blogs' },
  { id: 177, code: 'Blog:News',         main: 'Blog', sub: 'News',        label: 'News Blog',         icon: '🗞️', description: 'News blogs' },
  { id: 178, code: 'Blog:Pers',         main: 'Blog', sub: 'Pers',        label: 'Personal Blog',     icon: '👤', description: 'Personal diaries' },
  { id: 179, code: 'Blog:Prom',         main: 'Blog', sub: 'Prom',        label: 'Promotional Blog',  icon: '📢', description: 'Marketing/promotional blogs' },
  { id: 180, code: 'Blog:Revw',         main: 'Blog', sub: 'Revw',        label: 'Review Blog',       icon: '⭐', description: 'Review blogs' },
  { id: 181, code: 'Blog:Misc',         main: 'Blog', sub: 'Misc',        label: 'Blog Misc',         icon: '✍️', description: 'Other blogs' },

  // Mov (19)
  { id: 183, code: 'Mov:Action',        main: 'Mov',  sub: 'Action',      label: 'Action Movies',     icon: '💥', description: 'Action films' },
  { id: 184, code: 'Mov:Adult',         main: 'Mov',  sub: 'Adult',       label: 'Adult Movies',      icon: '🔞', description: 'Adult content' },
  { id: 185, code: 'Mov:Adv',           main: 'Mov',  sub: 'Adv',         label: 'Adventure',         icon: '🗺️', description: 'Adventure films' },
  { id: 186, code: 'Mov:Anim',          main: 'Mov',  sub: 'Anim',        label: 'Animation',         icon: '🎨', description: 'Animated films' },
  { id: 187, code: 'Mov:Biog',          main: 'Mov',  sub: 'Biog',        label: 'Biographical',      icon: '👤', description: 'Biopics' },
  { id: 188, code: 'Mov:Comedy',        main: 'Mov',  sub: 'Comedy',      label: 'Comedy',            icon: '😄', description: 'Comedy films' },
  { id: 189, code: 'Mov:Crime',         main: 'Mov',  sub: 'Crime',       label: 'Crime',             icon: '🔫', description: 'Crime films' },
  { id: 190, code: 'Mov:Docum',         main: 'Mov',  sub: 'Docum',       label: 'Documentary',       icon: '📹', description: 'Documentaries' },
  { id: 191, code: 'Mov:Drama',         main: 'Mov',  sub: 'Drama',       label: 'Drama',             icon: '🎭', description: 'Drama films' },
  { id: 192, code: 'Mov:Fam',           main: 'Mov',  sub: 'Fam',         label: 'Family',            icon: '👨‍👩‍👧', description: 'Family films' },
  { id: 193, code: 'Mov:Fantasy',       main: 'Mov',  sub: 'Fantasy',     label: 'Fantasy',           icon: '🧙', description: 'Fantasy films' },
  { id: 194, code: 'Mov:Horror',        main: 'Mov',  sub: 'Horror',      label: 'Horror',            icon: '👻', description: 'Horror films' },
  { id: 195, code: 'Mov:Music',         main: 'Mov',  sub: 'Music',       label: 'Musical',           icon: '🎵', description: 'Musicals' },
  { id: 196, code: 'Mov:Myst',          main: 'Mov',  sub: 'Myst',        label: 'Mystery',           icon: '🔍', description: 'Mystery films' },
  { id: 197, code: 'Mov:Romance',       main: 'Mov',  sub: 'Romance',     label: 'Romance',           icon: '💘', description: 'Romance films' },
  { id: 198, code: 'Mov:Sci-Fi',        main: 'Mov',  sub: 'Sci-Fi',      label: 'Sci-Fi Films',      icon: '🚀', description: 'Science fiction films' },
  { id: 199, code: 'Mov:Short',         main: 'Mov',  sub: 'Short',       label: 'Short Films',       icon: '🎬', description: 'Short films' },
  { id: 200, code: 'Mov:Thril',         main: 'Mov',  sub: 'Thril',       label: 'Thriller',          icon: '😨', description: 'Thrillers' },
  { id: 201, code: 'Mov:N/A',           main: 'Mov',  sub: 'N/A',         label: 'Movie Misc',        icon: '🎞️', description: 'Other movies' },

  // TV (12)
  { id: 203, code: 'TV:Action',         main: 'TV',   sub: 'Action',      label: 'TV Action',         icon: '💥', description: 'Action TV shows' },
  { id: 204, code: 'TV:Adv',            main: 'TV',   sub: 'Adv',         label: 'TV Adventure',      icon: '🗺️', description: 'Adventure TV' },
  { id: 205, code: 'TV:Anim',           main: 'TV',   sub: 'Anim',        label: 'TV Animation',      icon: '🎨', description: 'Animated TV' },
  { id: 206, code: 'TV:Comedy',         main: 'TV',   sub: 'Comedy',      label: 'TV Comedy',         icon: '😄', description: 'Sitcoms' },
  { id: 207, code: 'TV:Crime',          main: 'TV',   sub: 'Crime',       label: 'TV Crime',          icon: '🔫', description: 'Crime TV' },
  { id: 208, code: 'TV:Docum',          main: 'TV',   sub: 'Docum',       label: 'TV Documentary',    icon: '📹', description: 'TV documentaries' },
  { id: 209, code: 'TV:Drama',          main: 'TV',   sub: 'Drama',       label: 'TV Drama',          icon: '🎭', description: 'TV dramas' },
  { id: 210, code: 'TV:Game',           main: 'TV',   sub: 'Game',        label: 'Game Shows',        icon: '🎮', description: 'Game shows' },
  { id: 211, code: 'TV:Horror',         main: 'TV',   sub: 'Horror',      label: 'TV Horror',         icon: '👻', description: 'Horror TV' },
  { id: 212, code: 'TV:Reality',        main: 'TV',   sub: 'Reality',     label: 'Reality TV',        icon: '📺', description: 'Reality shows' },
  { id: 213, code: 'TV:Sci-Fi',         main: 'TV',   sub: 'Sci-Fi',      label: 'TV Sci-Fi',         icon: '🚀', description: 'Sci-fi TV' },
  { id: 214, code: 'TV:Misc',           main: 'TV',   sub: 'Misc',        label: 'TV Misc',           icon: '📺', description: 'Other TV' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
export const COCA_BY_CODE: Record<string, CocaSubgenre> =
  Object.fromEntries(COCA_SUBGENRES.map(s => [s.code, s]));

export function getSubgenresByMain(main: CocaMainKey): CocaSubgenre[] {
  return COCA_SUBGENRES.filter(s => s.main === main);
}

export function findSubgenre(code: string): CocaSubgenre | undefined {
  return COCA_BY_CODE[code];
}

export const COCA_TOTAL_COUNT = COCA_SUBGENRES.length;  // 96
