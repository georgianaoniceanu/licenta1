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
  { key: 'SPOK', label: 'Spoken',    color: '#10B981', icon: 'mic', description: 'TV/radio broadcasts, news anchors' },
  { key: 'FIC',  label: 'Fiction',   color: '#7C6FFF', icon: 'book-open', description: 'Novels, short stories, fan fiction' },
  { key: 'MAG',  label: 'Magazine',  color: '#F59E0B', icon: 'rss', description: 'Magazines, periodicals' },
  { key: 'NEWS', label: 'News',      color: '#FF7A59', icon: 'file-text', description: 'Newspapers (intl, national, local)' },
  { key: 'ACAD', label: 'Academic',  color: '#1EE8B5', icon: 'award', description: 'Peer-reviewed journals, textbooks' },
  { key: 'Web',  label: 'Web',       color: '#60A5FA', icon: 'globe', description: 'General web pages (info, instr, reviews)' },
  { key: 'Blog', label: 'Blog',      color: '#E879F9', icon: 'edit-3', description: 'Personal & professional blogs' },
  { key: 'Mov',  label: 'Movies',    color: '#FB7185', icon: 'film', description: 'Movie scripts and subtitles' },
  { key: 'TV',   label: 'TV',        color: '#A78BFA', icon: 'monitor', description: 'TV scripts and subtitles' },
];

export const COCA_MAIN_BY_KEY: Record<CocaMainKey, CocaMainMeta> =
  Object.fromEntries(COCA_MAIN_CATEGORIES.map(c => [c.key, c])) as any;

// ── All 96 subgenres ─────────────────────────────────────────────────────────
export const COCA_SUBGENRES: CocaSubgenre[] = [
  // SPOK (9)
  { id: 101, code: 'SPOK:ABC',          main: 'SPOK', sub: 'ABC',         label: 'ABC News',          icon: 'monitor', description: 'ABC TV broadcasts' },
  { id: 102, code: 'SPOK:NBC',          main: 'SPOK', sub: 'NBC',         label: 'NBC News',          icon: 'monitor', description: 'NBC TV broadcasts' },
  { id: 103, code: 'SPOK:CBS',          main: 'SPOK', sub: 'CBS',         label: 'CBS News',          icon: 'monitor', description: 'CBS TV broadcasts' },
  { id: 104, code: 'SPOK:CNN',          main: 'SPOK', sub: 'CNN',         label: 'CNN',               icon: 'rss', description: 'CNN news broadcasts' },
  { id: 105, code: 'SPOK:FOX',          main: 'SPOK', sub: 'FOX',         label: 'FOX News',          icon: 'rss', description: 'FOX news broadcasts' },
  { id: 106, code: 'SPOK:MSNBC',        main: 'SPOK', sub: 'MSNBC',       label: 'MSNBC',             icon: 'rss', description: 'MSNBC news broadcasts' },
  { id: 107, code: 'SPOK:PBS',          main: 'SPOK', sub: 'PBS',         label: 'PBS',               icon: 'monitor', description: 'PBS public broadcasting' },
  { id: 108, code: 'SPOK:NPR',          main: 'SPOK', sub: 'NPR',         label: 'NPR Radio',         icon: 'radio', description: 'NPR public radio' },
  { id: 109, code: 'SPOK:Indep',        main: 'SPOK', sub: 'Indep',       label: 'Independent',       icon: 'mic', description: 'Independent broadcasts' },

  // FIC (6)
  { id: 114, code: 'FIC:Gen (Book)',    main: 'FIC',  sub: 'Gen (Book)',  label: 'Books (General)',   icon: 'book', description: 'General fiction books' },
  { id: 115, code: 'FIC:Gen (Jrnl)',    main: 'FIC',  sub: 'Gen (Jrnl)',  label: 'Journal Fiction',   icon: 'book', description: 'Literary journals' },
  { id: 116, code: 'FIC:SciFi/Fant',    main: 'FIC',  sub: 'SciFi/Fant',  label: 'Sci-Fi & Fantasy',  icon: 'zap', description: 'Science fiction and fantasy' },
  { id: 117, code: 'FIC:Juvenile',      main: 'FIC',  sub: 'Juvenile',    label: "Children's Fiction", icon: 'heart', description: 'Books for young readers' },
  { id: 118, code: 'FIC:Movies',        main: 'FIC',  sub: 'Movies',      label: 'Movie Tie-ins',     icon: 'film', description: 'Movie-based novels' },
  { id: 119, code: 'FIC:Fan Fiction',   main: 'FIC',  sub: 'Fan Fiction', label: 'Fan Fiction',       icon: 'star', description: 'Fan-created stories' },

  // MAG (11)
  { id: 123, code: 'MAG:News/Opin',     main: 'MAG',  sub: 'News/Opin',   label: 'News & Opinion',    icon: 'rss', description: 'News magazines, opinion pieces' },
  { id: 124, code: 'MAG:Financial',     main: 'MAG',  sub: 'Financial',   label: 'Financial',         icon: 'dollar-sign', description: 'Forbes, Fortune, financial periodicals' },
  { id: 125, code: 'MAG:Sci/Tech',      main: 'MAG',  sub: 'Sci/Tech',    label: 'Science & Tech',    icon: 'activity', description: 'Scientific American, Wired, Popular Mechanics' },
  { id: 126, code: 'MAG:Soc/Arts',      main: 'MAG',  sub: 'Soc/Arts',    label: 'Society & Arts',    icon: 'pen-tool', description: 'Cultural and arts magazines' },
  { id: 127, code: 'MAG:Religion',      main: 'MAG',  sub: 'Religion',    label: 'Religion',          icon: 'feather', description: 'Religious periodicals' },
  { id: 128, code: 'MAG:Sports',        main: 'MAG',  sub: 'Sports',      label: 'Sports',            icon: 'target', description: 'Sports Illustrated, ESPN Magazine' },
  { id: 129, code: 'MAG:Entertain',     main: 'MAG',  sub: 'Entertain',   label: 'Entertainment',     icon: 'film', description: 'People, Entertainment Weekly' },
  { id: 130, code: 'MAG:Home/Health',   main: 'MAG',  sub: 'Home/Health', label: 'Home & Health',     icon: 'home', description: 'Home, garden, health, wellness' },
  { id: 131, code: 'MAG:Afric-Amer',    main: 'MAG',  sub: 'Afric-Amer',  label: 'African-American',  icon: 'shield', description: 'Ebony, Essence, etc.' },
  { id: 132, code: 'MAG:Children',      main: 'MAG',  sub: 'Children',    label: "Children's Magazines", icon: 'user', description: 'Highlights, etc.' },
  { id: 133, code: 'MAG:Women/Men',     main: 'MAG',  sub: 'Women/Men',   label: 'Women / Men',       icon: 'users', description: 'Lifestyle gender-targeted magazines' },

  // NEWS (8)
  { id: 135, code: 'NEWS:Misc',         main: 'NEWS', sub: 'Misc',        label: 'News Misc',         icon: 'file', description: 'Miscellaneous news' },
  { id: 136, code: 'NEWS:News_Intl',    main: 'NEWS', sub: 'News_Intl',   label: 'International',     icon: 'globe', description: 'International news' },
  { id: 137, code: 'NEWS:News_Natl',    main: 'NEWS', sub: 'News_Natl',   label: 'National',          icon: 'layers', description: 'National news' },
  { id: 138, code: 'NEWS:News_Local',   main: 'NEWS', sub: 'News_Local',  label: 'Local',             icon: 'map-pin', description: 'Local news' },
  { id: 139, code: 'NEWS:Money',        main: 'NEWS', sub: 'Money',       label: 'Money & Business',  icon: 'dollar-sign', description: 'Business and financial news' },
  { id: 140, code: 'NEWS:Life',         main: 'NEWS', sub: 'Life',        label: 'Lifestyle',         icon: 'sun', description: 'Life and lifestyle' },
  { id: 141, code: 'NEWS:Sports',       main: 'NEWS', sub: 'Sports',      label: 'Sports News',       icon: 'award', description: 'Sports reporting' },
  { id: 142, code: 'NEWS:Editorial',    main: 'NEWS', sub: 'Editorial',   label: 'Editorial',         icon: 'edit-2', description: 'Op-eds and editorials' },

  // ACAD (10)
  { id: 144, code: 'ACAD:History',      main: 'ACAD', sub: 'History',     label: 'History',           icon: 'layers', description: 'Historical academic writing' },
  { id: 145, code: 'ACAD:Education',    main: 'ACAD', sub: 'Education',   label: 'Education',         icon: 'award', description: 'Education research journals' },
  { id: 146, code: 'ACAD:Geog/SocSci',  main: 'ACAD', sub: 'Geog/SocSci', label: 'Geography & Social Sciences', icon: 'map', description: 'Geography, sociology, anthropology' },
  { id: 147, code: 'ACAD:Law/PolSci',   main: 'ACAD', sub: 'Law/PolSci',  label: 'Law & Political Science', icon: 'sliders', description: 'Law journals, political science' },
  { id: 148, code: 'ACAD:Humanities',   main: 'ACAD', sub: 'Humanities',  label: 'Humanities',        icon: 'book', description: 'Literature, philosophy, arts' },
  { id: 149, code: 'ACAD:Phil/Rel',     main: 'ACAD', sub: 'Phil/Rel',    label: 'Philosophy & Religion', icon: 'circle', description: 'Philosophy and religious studies' },
  { id: 150, code: 'ACAD:Sci/Tech',     main: 'ACAD', sub: 'Sci/Tech',    label: 'Science & Technology', icon: 'activity', description: 'STEM journals' },
  { id: 151, code: 'ACAD:Medicine',     main: 'ACAD', sub: 'Medicine',    label: 'Medicine',          icon: 'activity', description: 'Medical journals' },
  { id: 152, code: 'ACAD:Misc',         main: 'ACAD', sub: 'Misc',        label: 'Academic Misc',     icon: 'file-text', description: 'Other academic' },
  { id: 153, code: 'ACAD:Business',     main: 'ACAD', sub: 'Business',    label: 'Business',          icon: 'briefcase', description: 'Business research, management' },

  // Web (10)
  { id: 160, code: 'Web:Acad',          main: 'Web',  sub: 'Acad',        label: 'Web Academic',      icon: 'award', description: 'Academic web content' },
  { id: 161, code: 'Web:Arg',           main: 'Web',  sub: 'Arg',         label: 'Web Argumentation', icon: 'message-square', description: 'Argumentative web content' },
  { id: 162, code: 'Web:Fic',           main: 'Web',  sub: 'Fic',         label: 'Web Fiction',       icon: 'book-open', description: 'Fiction on the web' },
  { id: 163, code: 'Web:Info',          main: 'Web',  sub: 'Info',        label: 'Web Information',   icon: 'info', description: 'Informational web pages' },
  { id: 164, code: 'Web:Instr',         main: 'Web',  sub: 'Instr',       label: 'Web Instructions',  icon: 'clipboard', description: 'How-to, tutorials' },
  { id: 165, code: 'Web:Legal',         main: 'Web',  sub: 'Legal',       label: 'Web Legal',         icon: 'sliders', description: 'Legal web content' },
  { id: 166, code: 'Web:News',          main: 'Web',  sub: 'News',        label: 'Web News',          icon: 'file-text', description: 'Online news' },
  { id: 167, code: 'Web:Pers',          main: 'Web',  sub: 'Pers',        label: 'Web Personal',      icon: 'user', description: 'Personal web pages' },
  { id: 168, code: 'Web:Revw',          main: 'Web',  sub: 'Revw',        label: 'Web Reviews',       icon: 'star', description: 'Product/service reviews' },
  { id: 169, code: 'Web:Misc',          main: 'Web',  sub: 'Misc',        label: 'Web Misc',          icon: 'globe', description: 'Other web content' },

  // Blog (11)
  { id: 171, code: 'Blog:Acad',         main: 'Blog', sub: 'Acad',        label: 'Academic Blog',     icon: 'award', description: 'Academic blogs' },
  { id: 172, code: 'Blog:Arg',          main: 'Blog', sub: 'Arg',         label: 'Argument Blog',     icon: 'message-square', description: 'Argumentative blogs' },
  { id: 173, code: 'Blog:Fic',          main: 'Blog', sub: 'Fic',         label: 'Fiction Blog',      icon: 'book-open', description: 'Fiction blogs' },
  { id: 174, code: 'Blog:Info',         main: 'Blog', sub: 'Info',        label: 'Info Blog',         icon: 'info', description: 'Informational blogs' },
  { id: 175, code: 'Blog:Instr',        main: 'Blog', sub: 'Instr',       label: 'Tutorial Blog',     icon: 'clipboard', description: 'How-to blogs' },
  { id: 176, code: 'Blog:Legal',        main: 'Blog', sub: 'Legal',       label: 'Legal Blog',        icon: 'sliders', description: 'Legal/law blogs' },
  { id: 177, code: 'Blog:News',         main: 'Blog', sub: 'News',        label: 'News Blog',         icon: 'file-text', description: 'News blogs' },
  { id: 178, code: 'Blog:Pers',         main: 'Blog', sub: 'Pers',        label: 'Personal Blog',     icon: 'user', description: 'Personal diaries' },
  { id: 179, code: 'Blog:Prom',         main: 'Blog', sub: 'Prom',        label: 'Promotional Blog',  icon: 'volume-2', description: 'Marketing/promotional blogs' },
  { id: 180, code: 'Blog:Revw',         main: 'Blog', sub: 'Revw',        label: 'Review Blog',       icon: 'star', description: 'Review blogs' },
  { id: 181, code: 'Blog:Misc',         main: 'Blog', sub: 'Misc',        label: 'Blog Misc',         icon: 'edit-3', description: 'Other blogs' },

  // Mov (19)
  { id: 183, code: 'Mov:Action',        main: 'Mov',  sub: 'Action',      label: 'Action Movies',     icon: 'zap', description: 'Action films' },
  { id: 184, code: 'Mov:Adult',         main: 'Mov',  sub: 'Adult',       label: 'Adult Movies',      icon: 'lock', description: 'Adult content' },
  { id: 185, code: 'Mov:Adv',           main: 'Mov',  sub: 'Adv',         label: 'Adventure',         icon: 'map', description: 'Adventure films' },
  { id: 186, code: 'Mov:Anim',          main: 'Mov',  sub: 'Anim',        label: 'Animation',         icon: 'pen-tool', description: 'Animated films' },
  { id: 187, code: 'Mov:Biog',          main: 'Mov',  sub: 'Biog',        label: 'Biographical',      icon: 'user', description: 'Biopics' },
  { id: 188, code: 'Mov:Comedy',        main: 'Mov',  sub: 'Comedy',      label: 'Comedy',            icon: 'smile', description: 'Comedy films' },
  { id: 189, code: 'Mov:Crime',         main: 'Mov',  sub: 'Crime',       label: 'Crime',             icon: 'shield', description: 'Crime films' },
  { id: 190, code: 'Mov:Docum',         main: 'Mov',  sub: 'Docum',       label: 'Documentary',       icon: 'video', description: 'Documentaries' },
  { id: 191, code: 'Mov:Drama',         main: 'Mov',  sub: 'Drama',       label: 'Drama',             icon: 'film', description: 'Drama films' },
  { id: 192, code: 'Mov:Fam',           main: 'Mov',  sub: 'Fam',         label: 'Family',            icon: 'users', description: 'Family films' },
  { id: 193, code: 'Mov:Fantasy',       main: 'Mov',  sub: 'Fantasy',     label: 'Fantasy',           icon: 'star', description: 'Fantasy films' },
  { id: 194, code: 'Mov:Horror',        main: 'Mov',  sub: 'Horror',      label: 'Horror',            icon: 'cloud', description: 'Horror films' },
  { id: 195, code: 'Mov:Music',         main: 'Mov',  sub: 'Music',       label: 'Musical',           icon: 'music', description: 'Musicals' },
  { id: 196, code: 'Mov:Myst',          main: 'Mov',  sub: 'Myst',        label: 'Mystery',           icon: 'search', description: 'Mystery films' },
  { id: 197, code: 'Mov:Romance',       main: 'Mov',  sub: 'Romance',     label: 'Romance',           icon: 'heart', description: 'Romance films' },
  { id: 198, code: 'Mov:Sci-Fi',        main: 'Mov',  sub: 'Sci-Fi',      label: 'Sci-Fi Films',      icon: 'zap', description: 'Science fiction films' },
  { id: 199, code: 'Mov:Short',         main: 'Mov',  sub: 'Short',       label: 'Short Films',       icon: 'film', description: 'Short films' },
  { id: 200, code: 'Mov:Thril',         main: 'Mov',  sub: 'Thril',       label: 'Thriller',          icon: 'alert-circle', description: 'Thrillers' },
  { id: 201, code: 'Mov:N/A',           main: 'Mov',  sub: 'N/A',         label: 'Movie Misc',        icon: 'film', description: 'Other movies' },

  // TV (12)
  { id: 203, code: 'TV:Action',         main: 'TV',   sub: 'Action',      label: 'TV Action',         icon: 'zap', description: 'Action TV shows' },
  { id: 204, code: 'TV:Adv',            main: 'TV',   sub: 'Adv',         label: 'TV Adventure',      icon: 'map', description: 'Adventure TV' },
  { id: 205, code: 'TV:Anim',           main: 'TV',   sub: 'Anim',        label: 'TV Animation',      icon: 'pen-tool', description: 'Animated TV' },
  { id: 206, code: 'TV:Comedy',         main: 'TV',   sub: 'Comedy',      label: 'TV Comedy',         icon: 'smile', description: 'Sitcoms' },
  { id: 207, code: 'TV:Crime',          main: 'TV',   sub: 'Crime',       label: 'TV Crime',          icon: 'shield', description: 'Crime TV' },
  { id: 208, code: 'TV:Docum',          main: 'TV',   sub: 'Docum',       label: 'TV Documentary',    icon: 'video', description: 'TV documentaries' },
  { id: 209, code: 'TV:Drama',          main: 'TV',   sub: 'Drama',       label: 'TV Drama',          icon: 'film', description: 'TV dramas' },
  { id: 210, code: 'TV:Game',           main: 'TV',   sub: 'Game',        label: 'Game Shows',        icon: 'terminal', description: 'Game shows' },
  { id: 211, code: 'TV:Horror',         main: 'TV',   sub: 'Horror',      label: 'TV Horror',         icon: 'cloud', description: 'Horror TV' },
  { id: 212, code: 'TV:Reality',        main: 'TV',   sub: 'Reality',     label: 'Reality TV',        icon: 'monitor', description: 'Reality shows' },
  { id: 213, code: 'TV:Sci-Fi',         main: 'TV',   sub: 'Sci-Fi',      label: 'TV Sci-Fi',         icon: 'zap', description: 'Sci-fi TV' },
  { id: 214, code: 'TV:Misc',           main: 'TV',   sub: 'Misc',        label: 'TV Misc',           icon: 'monitor', description: 'Other TV' },
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
