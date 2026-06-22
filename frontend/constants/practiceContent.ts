/**
 * Local Practice Content — offline exercise bank.
 *
 * Lets the Practice Hub work without a backend (demo mode / offline):
 *   • Vocabulary cards  — Academic Word List (Coxhead 2000) word→definition MCQ
 *   • Reading passages  — CEFR-calibrated passages + comprehension questions
 *                         (Cambridge ESOL framework)
 *   • Listening lines   — sentences read aloud via Web Speech API; learner
 *                         transcribes; scored by local word-level diff
 *
 * All content is static and deterministic — no AI generation.
 */

// ── Vocabulary (Adaptive) ─────────────────────────────────────────────────────
export interface LocalVocabCard {
  word: string;
  pronunciation: string;
  definition: string;          // correct definition
  distractors: string[];       // 3 wrong definitions
  example_sentence: string;
  synonyms: string[];
  sublist: number;             // AWL sublist 1–10
  difficulty: string;          // CEFR
}

export const LOCAL_VOCAB_CARDS: LocalVocabCard[] = [
  {
    word: 'analyze', pronunciation: '/ˈæn.ə.laɪz/',
    definition: 'to examine something in detail to understand it',
    distractors: ['to copy something exactly', 'to hide information from others', 'to translate into another language'],
    example_sentence: 'Researchers analyze the data before drawing conclusions.',
    synonyms: ['examine', 'study', 'investigate'], sublist: 1, difficulty: 'B1',
  },
  {
    word: 'approach', pronunciation: '/əˈprəʊtʃ/',
    definition: 'a particular way of dealing with a problem',
    distractors: ['a final decision', 'a written agreement', 'a sudden change'],
    example_sentence: 'We need a new approach to solve this issue.',
    synonyms: ['method', 'strategy', 'technique'], sublist: 1, difficulty: 'B1',
  },
  {
    word: 'benefit', pronunciation: '/ˈben.ɪ.fɪt/',
    definition: 'an advantage or helpful effect',
    distractors: ['a serious mistake', 'a strict rule', 'a long delay'],
    example_sentence: 'Regular exercise has many health benefits.',
    synonyms: ['advantage', 'gain', 'profit'], sublist: 1, difficulty: 'A2',
  },
  {
    word: 'concept', pronunciation: '/ˈkɒn.sept/',
    definition: 'an abstract idea or general notion',
    distractors: ['a physical object', 'a spoken command', 'a small mistake'],
    example_sentence: 'The concept of gravity was explained clearly.',
    synonyms: ['idea', 'notion', 'principle'], sublist: 1, difficulty: 'B2',
  },
  {
    word: 'context', pronunciation: '/ˈkɒn.tekst/',
    definition: 'the situation in which something happens that helps explain it',
    distractors: ['the end of a story', 'a list of rules', 'a type of error'],
    example_sentence: 'You must understand the word in its context.',
    synonyms: ['setting', 'background', 'circumstances'], sublist: 1, difficulty: 'B2',
  },
  {
    word: 'derive', pronunciation: '/dɪˈraɪv/',
    definition: 'to obtain something from a source',
    distractors: ['to destroy completely', 'to refuse politely', 'to repeat loudly'],
    example_sentence: 'Many English words derive from Latin.',
    synonyms: ['obtain', 'gain', 'extract'], sublist: 1, difficulty: 'C1',
  },
  {
    word: 'establish', pronunciation: '/ɪˈstæb.lɪʃ/',
    definition: 'to set up or create something that will last',
    distractors: ['to close down a business', 'to borrow temporarily', 'to argue against'],
    example_sentence: 'The company was established in 1990.',
    synonyms: ['create', 'found', 'set up'], sublist: 1, difficulty: 'B2',
  },
  {
    word: 'evident', pronunciation: '/ˈev.ɪ.dənt/',
    definition: 'clear and easy to see or understand',
    distractors: ['secret and hidden', 'rare and unusual', 'weak and uncertain'],
    example_sentence: 'It was evident that she had been crying.',
    synonyms: ['obvious', 'clear', 'apparent'], sublist: 1, difficulty: 'B2',
  },
  {
    word: 'factor', pronunciation: '/ˈfæk.tər/',
    definition: 'one of the things that influences a result',
    distractors: ['a final answer', 'a type of machine', 'a written report'],
    example_sentence: 'Cost was an important factor in our decision.',
    synonyms: ['element', 'cause', 'influence'], sublist: 1, difficulty: 'B1',
  },
  {
    word: 'interpret', pronunciation: '/ɪnˈtɜː.prɪt/',
    definition: 'to explain or decide on the meaning of something',
    distractors: ['to ignore deliberately', 'to build from parts', 'to measure exactly'],
    example_sentence: 'How do you interpret these results?',
    synonyms: ['explain', 'understand', 'decode'], sublist: 1, difficulty: 'B2',
  },
  {
    word: 'method', pronunciation: '/ˈmeθ.əd/',
    definition: 'a planned way of doing something',
    distractors: ['a lucky accident', 'a strong feeling', 'a broken rule'],
    example_sentence: 'This method is faster than the old one.',
    synonyms: ['approach', 'technique', 'system'], sublist: 1, difficulty: 'A2',
  },
  {
    word: 'occur', pronunciation: '/əˈkɜːr/',
    definition: 'to happen, especially without being planned',
    distractors: ['to disappear suddenly', 'to refuse firmly', 'to grow slowly'],
    example_sentence: 'The accident occurred late at night.',
    synonyms: ['happen', 'take place', 'arise'], sublist: 1, difficulty: 'B1',
  },
  {
    word: 'principle', pronunciation: '/ˈprɪn.sɪ.pəl/',
    definition: 'a basic rule or belief that guides behaviour',
    distractors: ['a small detail', 'a final result', 'a temporary fix'],
    example_sentence: 'She refused to lie — it was a matter of principle.',
    synonyms: ['rule', 'standard', 'belief'], sublist: 1, difficulty: 'B2',
  },
  {
    word: 'significant', pronunciation: '/sɪɡˈnɪf.ɪ.kənt/',
    definition: 'large or important enough to have an effect',
    distractors: ['tiny and unimportant', 'completely false', 'easy to forget'],
    example_sentence: 'There was a significant rise in temperature.',
    synonyms: ['important', 'notable', 'considerable'], sublist: 1, difficulty: 'B2',
  },
  {
    word: 'structure', pronunciation: '/ˈstrʌk.tʃər/',
    definition: 'the way parts are arranged or organised',
    distractors: ['a sudden noise', 'a personal opinion', 'a quick movement'],
    example_sentence: 'The essay has a clear structure.',
    synonyms: ['organisation', 'arrangement', 'framework'], sublist: 1, difficulty: 'B1',
  },
  {
    word: 'sufficient', pronunciation: '/səˈfɪʃ.ənt/',
    definition: 'as much as is needed; enough',
    distractors: ['far too much', 'completely empty', 'slightly broken'],
    example_sentence: 'We have sufficient evidence to proceed.',
    synonyms: ['enough', 'adequate', 'ample'], sublist: 3, difficulty: 'C1',
  },
];

// ── Reading passages ─────────────────────────────────────────────────────────
export interface LocalReadingQuestion {
  type: 'literal' | 'inferential' | 'vocabulary';
  question: string;
  options: Record<'A' | 'B' | 'C' | 'D', string>;
  correct: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}
export interface LocalReadingPassage {
  cefr: string;
  title: string;
  passage: string;
  word_count: number;
  questions: LocalReadingQuestion[];
}

export const LOCAL_READING_PASSAGES: LocalReadingPassage[] = [
  {
    cefr: 'B1',
    title: 'The Return of the City Bicycle',
    word_count: 138,
    passage:
      'Over the last ten years, bicycles have become popular again in many large cities. ' +
      'For a long time, people preferred cars because they were fast and comfortable. ' +
      'However, heavy traffic now makes driving slow and stressful. Many city workers spend ' +
      'more than an hour each day stuck in their cars. As a result, they are looking for a ' +
      'better way to travel. Cycling is cheap, healthy, and good for the environment. Some ' +
      'cities have built special lanes so that cyclists feel safe. Others let people rent a ' +
      'bicycle for a small fee and leave it anywhere in the centre. Not everyone is happy with ' +
      'the change, and some drivers complain about losing road space. Still, most experts agree ' +
      'that bicycles will play an important role in the future of city transport.',
    questions: [
      {
        type: 'literal',
        question: 'Why did people prefer cars for a long time?',
        options: { A: 'They were fast and comfortable', B: 'They were cheap to buy', C: 'They were good for health', D: 'They were better for the environment' },
        correct: 'A',
        explanation: 'The passage says "people preferred cars because they were fast and comfortable."',
      },
      {
        type: 'literal',
        question: 'What have some cities built for cyclists?',
        options: { A: 'New car parks', B: 'Special lanes', C: 'Wider roads for cars', D: 'Train stations' },
        correct: 'B',
        explanation: '"Some cities have built special lanes so that cyclists feel safe."',
      },
      {
        type: 'inferential',
        question: 'Why are city workers looking for a better way to travel?',
        options: { A: 'Cars have become too expensive', B: 'They want more exercise only', C: 'Traffic makes driving slow and stressful', D: 'Bicycles are now free' },
        correct: 'C',
        explanation: 'The text links heavy traffic and time stuck in cars to the search for an alternative.',
      },
      {
        type: 'vocabulary',
        question: 'In the passage, "lanes" most nearly means:',
        options: { A: 'paths or strips of road', B: 'traffic lights', C: 'parking spaces', D: 'bridges' },
        correct: 'A',
        explanation: 'A lane is a marked strip of road, here reserved for cyclists.',
      },
      {
        type: 'inferential',
        question: 'What is the writer\'s overall attitude to city bicycles?',
        options: { A: 'Strongly negative', B: 'Generally positive', C: 'Completely neutral', D: 'Confused' },
        correct: 'B',
        explanation: 'Despite mentioning complaints, the writer ends positively about the future role of bicycles.',
      },
    ],
  },
  {
    cefr: 'B2',
    title: 'Why We Forget',
    word_count: 162,
    passage:
      'Forgetting is often seen as a failure of the mind, but scientists increasingly argue that ' +
      'it serves a useful purpose. The human brain receives an enormous amount of information ' +
      'every day, and storing all of it would be both impossible and unhelpful. By discarding ' +
      'details that are rarely used, the brain keeps the most relevant memories easy to reach. ' +
      'Researchers have found that memories which are not recalled gradually weaken, while those ' +
      'we revisit grow stronger. This explains why reviewing material at spaced intervals is far ' +
      'more effective than studying it all at once. Interestingly, a small amount of forgetting ' +
      'may even help creativity, because it allows the mind to combine ideas in new ways rather ' +
      'than repeating fixed patterns. Of course, excessive forgetting can signal illness, and ' +
      'doctors take sudden memory loss seriously. For most people, however, forgetting is not a ' +
      'flaw but a sign that the brain is working exactly as it should.',
    questions: [
      {
        type: 'inferential',
        question: 'What is the main idea of the passage?',
        options: { A: 'Forgetting is always a sign of illness', B: 'Forgetting often serves a useful purpose', C: 'The brain can store unlimited information', D: 'Creativity requires a perfect memory' },
        correct: 'B',
        explanation: 'The passage repeatedly argues forgetting is useful, not simply a failure.',
      },
      {
        type: 'literal',
        question: 'What happens to memories that are not recalled?',
        options: { A: 'They grow stronger', B: 'They stay the same', C: 'They gradually weaken', D: 'They become creative' },
        correct: 'C',
        explanation: '"memories which are not recalled gradually weaken."',
      },
      {
        type: 'literal',
        question: 'According to the text, what is more effective for studying?',
        options: { A: 'Studying everything at once', B: 'Reviewing at spaced intervals', C: 'Never reviewing material', D: 'Forgetting on purpose' },
        correct: 'B',
        explanation: 'The passage says spaced review is "far more effective than studying it all at once."',
      },
      {
        type: 'vocabulary',
        question: 'The word "discarding" is closest in meaning to:',
        options: { A: 'getting rid of', B: 'collecting', C: 'repeating', D: 'protecting' },
        correct: 'A',
        explanation: 'To discard is to throw away or remove something unwanted.',
      },
      {
        type: 'inferential',
        question: 'When do doctors become concerned about forgetting?',
        options: { A: 'When it helps creativity', B: 'When memories are reviewed', C: 'When memory loss is sudden or excessive', D: 'When students study at intervals' },
        correct: 'C',
        explanation: '"excessive forgetting can signal illness, and doctors take sudden memory loss seriously."',
      },
    ],
  },
  {
    cefr: 'C1',
    title: 'The Paradox of Choice',
    word_count: 178,
    passage:
      'Modern consumers are frequently told that more choice is always better, yet a growing body ' +
      'of research suggests the opposite may be true. When faced with an overwhelming number of ' +
      'options, people often feel anxious rather than liberated. In one well-known study, shoppers ' +
      'presented with a small selection of jams were considerably more likely to make a purchase ' +
      'than those offered an extensive range. The abundance of alternatives, paradoxically, ' +
      'discouraged commitment. Psychologists attribute this to two factors. First, evaluating ' +
      'numerous possibilities demands mental effort, which quickly becomes exhausting. Second, ' +
      'an abundance of options raises expectations, so that even a satisfactory decision can feel ' +
      'disappointing when measured against the alternatives that were rejected. The implication ' +
      'is not that choice is inherently harmful, but that its benefits diminish beyond a certain ' +
      'threshold. Designers of everything from menus to pension schemes have begun to apply this ' +
      'insight, deliberately limiting options to help people decide. In an age that celebrates ' +
      'abundance, the discipline of offering less may prove surprisingly valuable.',
    questions: [
      {
        type: 'inferential',
        question: 'What does the passage suggest about offering more choice?',
        options: { A: 'It always increases satisfaction', B: 'Its benefits decrease beyond a point', C: 'It has no effect on decisions', D: 'It is inherently harmful' },
        correct: 'B',
        explanation: 'The passage states benefits "diminish beyond a certain threshold."',
      },
      {
        type: 'literal',
        question: 'In the jam study, which shoppers were more likely to buy?',
        options: { A: 'Those offered a small selection', B: 'Those offered an extensive range', C: 'Those who came early', D: 'Those who were experts' },
        correct: 'A',
        explanation: 'Shoppers with a small selection were "more likely to make a purchase."',
      },
      {
        type: 'vocabulary',
        question: 'The word "liberated" most nearly means:',
        options: { A: 'set free', B: 'confused', C: 'tired', D: 'forced' },
        correct: 'A',
        explanation: 'Liberated means freed; here, people feel anxious rather than free.',
      },
      {
        type: 'inferential',
        question: 'Why can a satisfactory decision feel disappointing?',
        options: { A: 'Because it took little effort', B: 'Because expectations were raised by many options', C: 'Because the product was cheap', D: 'Because no alternatives existed' },
        correct: 'B',
        explanation: 'Many options raise expectations, making good choices feel worse by comparison.',
      },
      {
        type: 'literal',
        question: 'How have some designers applied this insight?',
        options: { A: 'By adding more options', B: 'By raising prices', C: 'By deliberately limiting options', D: 'By removing menus entirely' },
        correct: 'C',
        explanation: 'Designers have "deliberately limiting options to help people decide."',
      },
    ],
  },
];

// ── Grammar (Romanian L1 interference) ───────────────────────────────────────
// Error categories grounded in Neumanová (2021) error analysis + the app's
// rule-based L1 detector. Each item targets a documented Romanian→English
// transfer error.
export type GrammarCategory =
  | 'articles' | 'prepositions' | 'tense' | 'word_order'
  | 'double_negation' | 'collocations' | 'false_friends' | 'agreement';

export interface LocalGrammarItem {
  category: GrammarCategory;
  prompt: string;          // sentence with "___" for the gap
  options: string[];       // 4 choices
  correctIndex: number;
  explanation: string;     // correct rule
  l1_note: string;         // why Romanians get it wrong
  cefr: string;
}

export const GRAMMAR_CATEGORY_LABEL: Record<GrammarCategory, string> = {
  articles: 'Articles', prepositions: 'Prepositions', tense: 'Tense / Aspect',
  word_order: 'Word Order', double_negation: 'Double Negation',
  collocations: 'Collocations', false_friends: 'False Friends', agreement: 'Agreement',
};

export const LOCAL_GRAMMAR_ITEMS: LocalGrammarItem[] = [
  {
    category: 'articles',
    prompt: 'She works as ___ engineer at a tech company.',
    options: ['a', 'an', 'the', '(no article)'], correctIndex: 1,
    explanation: 'Use "an" before a vowel sound: an engineer.',
    l1_note: 'Romanian has no indefinite article before professions, so learners often drop it.',
    cefr: 'A2',
  },
  {
    category: 'articles',
    prompt: '___ Sun rises in the east.',
    options: ['A', 'An', 'The', '(no article)'], correctIndex: 2,
    explanation: 'Unique things take "the": the Sun, the Moon, the Earth.',
    l1_note: 'Romanian uses an enclitic article (soare-le), so the separate "the" is often omitted.',
    cefr: 'A2',
  },
  {
    category: 'prepositions',
    prompt: "I'm really interested ___ learning Japanese.",
    options: ['in', 'on', 'for', 'of'], correctIndex: 0,
    explanation: '"Interested in" is the fixed collocation.',
    l1_note: 'Romanian "interesat DE" leads learners to say "interested of/for".',
    cefr: 'B1',
  },
  {
    category: 'prepositions',
    prompt: 'We arrived ___ the airport two hours early.',
    options: ['to', 'at', 'in', 'on'], correctIndex: 1,
    explanation: '"Arrive at" a place (point); "arrive in" a city/country.',
    l1_note: 'Romanian "a ajunge LA" maps to "to", but English uses "at".',
    cefr: 'B1',
  },
  {
    category: 'prepositions',
    prompt: 'It depends ___ the weather.',
    options: ['of', 'on', 'from', 'by'], correctIndex: 1,
    explanation: '"Depend on" is fixed.',
    l1_note: 'Romanian "depinde DE" pushes learners toward "depend of".',
    cefr: 'B1',
  },
  {
    category: 'tense',
    prompt: 'I ___ in this city since 2019.',
    options: ['live', 'am living', 'have lived', 'lived'], correctIndex: 2,
    explanation: 'Present perfect for a state continuing up to now: "have lived since".',
    l1_note: 'Romanian uses the present ("locuiesc din 2019"), so learners say "I live since".',
    cefr: 'B1',
  },
  {
    category: 'tense',
    prompt: 'When she called, I ___ dinner.',
    options: ['cooked', 'was cooking', 'have cooked', 'cook'], correctIndex: 1,
    explanation: 'Past continuous for an action in progress interrupted by another.',
    l1_note: 'Romanian often uses the simple past for both, blurring the progressive.',
    cefr: 'B2',
  },
  {
    category: 'double_negation',
    prompt: "I ___ about the change.",
    options: ["don't know nothing", 'know nothing', "don't know anything", 'not know anything'], correctIndex: 2,
    explanation: 'English allows only one negative: "don\'t know anything" (or "know nothing").',
    l1_note: 'Romanian requires double negation ("nu știu nimic"), so learners say "don\'t know nothing".',
    cefr: 'B1',
  },
  {
    category: 'word_order',
    prompt: '___ to the gym after work?',
    options: ['How often you go', 'How often do you go', 'You go how often', 'How often go you'], correctIndex: 1,
    explanation: 'Questions need auxiliary inversion: "How often do you go?".',
    l1_note: 'Romanian forms questions by intonation/word order without "do", causing missing auxiliaries.',
    cefr: 'A2',
  },
  {
    category: 'word_order',
    prompt: 'She speaks ___.',
    options: ['very well English', 'English very well', 'well very English', 'English well very'], correctIndex: 1,
    explanation: 'Object before manner adverb: "speaks English very well".',
    l1_note: 'Romanian allows "vorbește foarte bine engleza", a different word order.',
    cefr: 'B1',
  },
  {
    category: 'collocations',
    prompt: 'You need to ___ a decision soon.',
    options: ['do', 'make', 'take', 'have'], correctIndex: 1,
    explanation: 'Fixed collocation: "make a decision".',
    l1_note: 'Romanian "a lua o decizie" (to take) pushes learners toward "take a decision".',
    cefr: 'B1',
  },
  {
    category: 'collocations',
    prompt: 'I have to ___ my homework before dinner.',
    options: ['make', 'do', 'take', 'give'], correctIndex: 1,
    explanation: '"Do homework" — "do" for tasks/duties, "make" for creating.',
    l1_note: 'Romanian "a face" covers both make and do, so learners confuse them.',
    cefr: 'A2',
  },
  {
    category: 'false_friends',
    prompt: 'I am not sure what the word means in this ___.',
    options: ['actual sentence', 'current sentence', 'present situation', 'real moment'], correctIndex: 1,
    explanation: '"Actual" in English means "real/true", not "current". Use "current".',
    l1_note: 'Romanian "actual" means "current/present" — a classic false friend.',
    cefr: 'B2',
  },
  {
    category: 'false_friends',
    prompt: 'The library was quiet, so I could ___ for my exam.',
    options: ['assist', 'attend', 'study', 'pretend'], correctIndex: 2,
    explanation: 'Use "study". "Assist" means help, not attend/study.',
    l1_note: 'Romanian "a asista" (to attend) is a false friend with English "assist" (to help).',
    cefr: 'B2',
  },
  {
    category: 'agreement',
    prompt: 'The news ___ very surprising today.',
    options: ['are', 'is', 'were', 'have been'], correctIndex: 1,
    explanation: '"News" is uncountable and takes a singular verb: "news is".',
    l1_note: 'Romanian "știrile" is plural, so learners say "news are".',
    cefr: 'B2',
  },
  {
    category: 'agreement',
    prompt: 'Each of the students ___ a laptop.',
    options: ['have', 'has', 'are having', 'were having'], correctIndex: 1,
    explanation: '"Each" is singular: "each ... has".',
    l1_note: 'Proximity to the plural "students" misleads learners into "have".',
    cefr: 'B2',
  },
];

export function pickGrammarItem(cefr?: string | null): LocalGrammarItem {
  const rank = cefrRank(cefr);
  const atOrBelow = LOCAL_GRAMMAR_ITEMS.filter(g => cefrRank(g.cefr) <= rank + 1);
  const pool = atOrBelow.length ? atOrBelow : LOCAL_GRAMMAR_ITEMS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Map a CEFR string to an index for filtering content at/below the user level. */
const CEFR_RANK: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

export function cefrRank(c?: string | null): number {
  return CEFR_RANK[(c ?? 'B1').toUpperCase()] ?? 2;
}

/** Pick a random reading passage at or near the given CEFR. */
export function pickReadingPassage(cefr?: string | null): LocalReadingPassage {
  const rank = cefrRank(cefr);
  const atOrBelow = LOCAL_READING_PASSAGES.filter(p => cefrRank(p.cefr) <= rank + 1);
  const pool = atOrBelow.length ? atOrBelow : LOCAL_READING_PASSAGES;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Build a 4-option MCQ from a vocab card (correct definition + 3 distractors, shuffled). */
export function buildVocabMCQ(card: LocalVocabCard): { options: string[]; correctIndex: number } {
  const all = [card.definition, ...card.distractors];
  // Deterministic-ish shuffle based on word length to vary position
  const offset = card.word.length % 4;
  const options = [...all.slice(offset), ...all.slice(0, offset)];
  return { options, correctIndex: options.indexOf(card.definition) };
}
