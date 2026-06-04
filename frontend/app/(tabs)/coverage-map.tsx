/**
 * Coverage Map — 3-circle Venn diagram showing the learner's
 * COCA subgenre coverage against three recommendation sources:
 *
 *   🔴 JOB    — subgenres essential for the learner's profession (O*NET → COCA)
 *   🔵 EXAM   — subgenres tied to their target exam (IELTS / Cambridge / etc.)
 *   🟡 GOAL   — subgenres aligned with their primary learning goal
 *
 * Theoretical basis:
 *   Biber & Conrad (2019) "Register, Genre, Style" — registers cluster around
 *     shared lexico-grammatical features. Cross-genre exposure correlates with
 *     L2 written proficiency (Biber et al. 2011, Applied Linguistics 32).
 *   Swales (1990) "Genre Analysis" — discourse communities are defined by their
 *     genre repertoire; mastery of those genres enables effective participation.
 *
 * The intersection of all three circles (JOB ∩ EXAM ∩ GOAL) is the maximum-ROI
 * study target; gaps in this region are flagged as urgent.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import {
  COCA_MAIN_BY_KEY,
  findSubgenre,
} from '@/constants/cocaSubgenres';
import {
  JOBS_BY_ID,
  type Job,
} from '@/constants/jobsDatabase';
import { getSubgenreWords } from '@/constants/cocaSubgenreWords';

// ── Theme ────────────────────────────────────────────────────────────────────
const BG     = '#F8FAFC';
const CARD   = '#FFFFFF';
const TEXT   = '#0F172A';
const TEXT2  = '#64748B';
const TEXT3  = '#94A3B8';
const BORDER = '#E5E7EB';

const C_JOB  = '#FF7A59';  // coral — JOB
const C_EXAM = '#7C6FFF';  // purple — EXAM
const C_GOAL = '#10B981';  // green — GOAL

const { width: SCREEN_W } = Dimensions.get('window');
const VENN_W = Math.min(SCREEN_W - 32, 360);
const R      = VENN_W * 0.275;         // circle radius
const SEP    = R * 0.72;               // half horizontal separation of lower circles
const VGAP   = R * 0.82;               // vertical drop from top circle to lower circles
const BAND   = 28;                     // headroom for the outside labels (top & bottom)
const CX     = VENN_W / 2;             // centre X
const JOB_CY = BAND + R;               // top (JOB) circle centre Y
const LOW_CY = JOB_CY + VGAP;          // lower (EXAM / GOAL) circle centre Y
const VENN_H = LOW_CY + R + BAND;      // total height incl. label bands
// Circle CENTRES (top: JOB, bottom-left: EXAM, bottom-right: GOAL)
const CC = {
  job:  { cx: CX,       cy: JOB_CY },
  exam: { cx: CX - SEP, cy: LOW_CY },
  goal: { cx: CX + SEP, cy: LOW_CY },
};
const CENTROID_Y = (JOB_CY + 2 * LOW_CY) / 3;   // y of the triple-overlap region

// Map exam target → recommended COCA subgenres
const EXAM_COVERAGE: Record<string, string[]> = {
  ielts_academic:  ['ACAD:Sci/Tech', 'ACAD:Humanities', 'ACAD:Education', 'ACAD:Geog/SocSci', 'NEWS:Editorial', 'MAG:News/Opin', 'Web:Acad'],
  ielts_general:   ['NEWS:Life', 'NEWS:News_Natl', 'MAG:Home/Health', 'Blog:Pers', 'Web:Info', 'NEWS:Money'],
  cambridge_fce:   ['ACAD:Humanities', 'NEWS:News_Natl', 'MAG:News/Opin', 'NEWS:Life', 'NEWS:Editorial', 'Web:Info'],
  cambridge_cae:   ['ACAD:Humanities', 'ACAD:Sci/Tech', 'NEWS:Editorial', 'MAG:News/Opin', 'NEWS:News_Intl', 'Web:Acad', 'Blog:Arg'],
  cambridge_cpe:   ['FIC:Gen (Book)', 'ACAD:Humanities', 'ACAD:Phil/Rel', 'NEWS:Editorial', 'MAG:News/Opin', 'ACAD:History', 'Web:Acad'],
  cambridge_pet:   ['NEWS:News_Natl', 'NEWS:Life', 'MAG:Home/Health', 'Blog:Pers', 'Web:Info', 'SPOK:NPR'],
  toefl_ibt:       ['ACAD:Sci/Tech', 'ACAD:Education', 'ACAD:Humanities', 'NEWS:News_Natl', 'Web:Acad', 'MAG:News/Opin'],
  pte_core:        ['NEWS:News_Natl', 'NEWS:News_Local', 'Blog:Info', 'Web:Info', 'MAG:Soc/Arts', 'SPOK:CNN'],
  general:         ['NEWS:News_Natl', 'NEWS:Life', 'MAG:News/Opin', 'Web:Info', 'Blog:Info'],
};

// Map primary goal → recommended COCA subgenres
const GOAL_COVERAGE: Record<string, string[]> = {
  vocabulary:    ['ACAD:Sci/Tech', 'ACAD:Humanities', 'MAG:Sci/Tech', 'MAG:News/Opin', 'FIC:Gen (Book)', 'NEWS:Editorial', 'Web:Acad'],
  pronunciation: ['SPOK:CNN', 'SPOK:NPR', 'SPOK:ABC', 'TV:Drama', 'Mov:Drama', 'TV:Reality', 'NEWS:News_Natl'],
  grammar:       ['ACAD:Humanities', 'ACAD:Education', 'NEWS:Editorial', 'MAG:News/Opin', 'FIC:Gen (Book)', 'Web:Acad'],
  fluency:       ['SPOK:CNN', 'SPOK:NPR', 'TV:Comedy', 'TV:Drama', 'Mov:Comedy', 'Blog:Pers'],
  complexity:    ['ACAD:Phil/Rel', 'ACAD:Humanities', 'ACAD:Law/PolSci', 'NEWS:Editorial', 'FIC:Gen (Book)', 'Web:Acad'],
  coherence:     ['ACAD:Humanities', 'NEWS:Editorial', 'MAG:News/Opin', 'Web:Acad', 'Blog:Arg', 'ACAD:Education'],
};

// ── Type definitions ────────────────────────────────────────────────────────
type Bucket =
  | 'urgent'       // in JOB ∩ EXAM ∩ GOAL but not covered
  | 'priorityJE'   // in JOB ∩ EXAM, not covered
  | 'priorityJG'   // in JOB ∩ GOAL, not covered
  | 'priorityEG'   // in EXAM ∩ GOAL, not covered
  | 'jobOnly'      // in JOB only, not covered
  | 'examOnly'     // in EXAM only, not covered
  | 'goalOnly'     // in GOAL only, not covered
  | 'onTrack'      // in intersection AND covered
  | 'wasted';      // covered but in none of the 3

// Filter chips operate on *circle membership* (matching the JOB/EXAM/GOAL
// badges on each card), not on the mutually-exclusive buckets above — so
// tapping "JOB" shows every subgenre in the JOB circle, covered or not.
type FilterKey = 'all' | 'priority' | 'job' | 'exam' | 'goal' | 'done' | 'wasted';

interface CoverageState {
  jobId: string | null;
  examTarget: string;
  primaryGoal: string;
  covered: string[];        // codes user has covered
  jobCodes: string[];
  examCodes: string[];
  goalCodes: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function classifySubgenre(
  code: string,
  st: CoverageState,
): { bucket: Bucket; sources: Array<'JOB' | 'EXAM' | 'GOAL'> } {
  const inJob  = st.jobCodes.includes(code);
  const inExam = st.examCodes.includes(code);
  const inGoal = st.goalCodes.includes(code);
  const isCov  = st.covered.includes(code);

  const sources: Array<'JOB' | 'EXAM' | 'GOAL'> = [];
  if (inJob)  sources.push('JOB');
  if (inExam) sources.push('EXAM');
  if (inGoal) sources.push('GOAL');

  if (sources.length === 0 && isCov)   return { bucket: 'wasted', sources };
  if (sources.length === 0)             return { bucket: 'onTrack', sources }; // not recommended, not covered = ignored
  if (isCov)                            return { bucket: 'onTrack', sources };

  if (inJob && inExam && inGoal)        return { bucket: 'urgent',     sources };
  if (inJob && inExam)                  return { bucket: 'priorityJE', sources };
  if (inJob && inGoal)                  return { bucket: 'priorityJG', sources };
  if (inExam && inGoal)                 return { bucket: 'priorityEG', sources };
  if (inJob)                            return { bucket: 'jobOnly',    sources };
  if (inExam)                           return { bucket: 'examOnly',   sources };
  return { bucket: 'goalOnly', sources };
}

// ── Venn diagram component (three circles via View + borderRadius) ───────────
function VennDiagram({
  jobCount, examCount, goalCount,
  jeCount, jgCount, egCount, allCount,
  coveredAll, coveredJE, coveredJG, coveredEG,
}: {
  jobCount: number; examCount: number; goalCount: number;
  jeCount: number; jgCount: number; egCount: number; allCount: number;
  coveredAll: number; coveredJE: number; coveredJG: number; coveredEG: number;
}) {
  // Region counts
  const jobOnly  = jobCount  - jeCount - jgCount + allCount;
  const examOnly = examCount - jeCount - egCount + allCount;
  const goalOnly = goalCount - jgCount - egCount + allCount;
  const je = jeCount - allCount;
  const jg = jgCount - allCount;
  const eg = egCount - allCount;

  const circle = (c: { cx: number; cy: number }, fill: string, border: string) => (
    <View
      style={[styles.vennCircle, {
        left: c.cx - R, top: c.cy - R,
        width: R * 2, height: R * 2, borderRadius: R,
        backgroundColor: fill, borderColor: border,
      }]}
      pointerEvents="none"
    />
  );

  // Centred number bubble at an (x,y) point
  const num = (x: number, y: number, value: number, color = '#1E293B', big = false) => (
    <Text style={[
      big ? styles.vennCountBig : styles.vennCount,
      { left: x - 18, top: y - (big ? 13 : 11), color },
    ]}>
      {value}
    </Text>
  );

  return (
    <View style={{ width: VENN_W, height: VENN_H, alignSelf: 'center' }}>
      {circle(CC.exam, C_EXAM + '33', C_EXAM)}
      {circle(CC.goal, C_GOAL + '33', C_GOAL)}
      {circle(CC.job,  C_JOB  + '33', C_JOB)}

      {/* ── Outside labels (pills) ─────────────────────────────────── */}
      <View style={[styles.vennPill, { left: CX - 28, top: JOB_CY - R - BAND + 2, borderColor: C_JOB }]}>
        <Text style={[styles.vennPillText, { color: C_JOB }]}>JOB</Text>
      </View>
      <View style={[styles.vennPill, { left: CC.exam.cx - R + 2, top: LOW_CY + R + 4, borderColor: C_EXAM }]}>
        <Text style={[styles.vennPillText, { color: C_EXAM }]}>EXAM</Text>
      </View>
      <View style={[styles.vennPill, { left: CC.goal.cx + R - 50, top: LOW_CY + R + 4, borderColor: C_GOAL }]}>
        <Text style={[styles.vennPillText, { color: C_GOAL }]}>GOAL</Text>
      </View>

      {/* ── Region counts ──────────────────────────────────────────── */}
      {num(CX,            JOB_CY - R * 0.42, jobOnly,  C_JOB)}
      {num(CC.exam.cx - R * 0.46, LOW_CY + R * 0.30, examOnly, C_EXAM)}
      {num(CC.goal.cx + R * 0.46, LOW_CY + R * 0.30, goalOnly, C_GOAL)}

      {/* Pairwise lens counts */}
      {num((CX + CC.exam.cx) / 2 - R * 0.10, (JOB_CY + LOW_CY) / 2, je, '#6D5BD0')}
      {num((CX + CC.goal.cx) / 2 + R * 0.10, (JOB_CY + LOW_CY) / 2, jg, '#0E9F6E')}
      {num(CX,            LOW_CY + R * 0.40, eg, '#3B6FB0')}

      {/* ── Centre (all-three) — the sweet spot ────────────────────── */}
      <View style={[styles.vennCenter, { left: CX - 28, top: CENTROID_Y - 18 }]}>
        <Text style={styles.vennCenterCount}>{allCount}</Text>
        <Text style={styles.vennCenterCovered}>✓ {coveredAll}/{allCount}</Text>
      </View>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function CoverageMapScreen() {
  const router = useRouter();
  const [state, setState] = useState<CoverageState>({
    jobId: null, examTarget: 'general', primaryGoal: 'vocabulary',
    covered: [], jobCodes: [], examCodes: [], goalCodes: [],
  });
  const [filterBucket, setFilterBucket] = useState<FilterKey>('all');
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [rJob, rExam, rGoal, rGenre] = await Promise.all([
      AsyncStorage.getItem('userJob'),
      AsyncStorage.getItem('userTargetExam'),
      AsyncStorage.getItem('userPrimaryGoal'),
      AsyncStorage.getItem('vf_genre_sessions'),
    ]);

    const examTarget = rExam || 'general';
    const primaryGoal = rGoal || 'vocabulary';
    const jobId = rJob;

    const job: Job | undefined = jobId ? JOBS_BY_ID[jobId] : undefined;
    const jobCodes = job ? [...job.essential, ...job.important] : [];
    const examCodes = EXAM_COVERAGE[examTarget] || EXAM_COVERAGE.general;
    const goalCodes = GOAL_COVERAGE[primaryGoal] || GOAL_COVERAGE.vocabulary;

    const sessions: any[] = rGenre ? JSON.parse(rGenre) : [];
    const covered: string[] = Array.from(new Set(
      sessions
        .map(s => s.dominant_subcategory)
        .filter((c): c is string => typeof c === 'string')
    ));

    setState({ jobId, examTarget, primaryGoal, covered, jobCodes, examCodes, goalCodes });
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const job = state.jobId ? JOBS_BY_ID[state.jobId] : null;

  // Compute set sizes
  const universe = new Set([...state.jobCodes, ...state.examCodes, ...state.goalCodes]);
  const allCodes = Array.from(universe);

  const inJE = allCodes.filter(c => state.jobCodes.includes(c) && state.examCodes.includes(c));
  const inJG = allCodes.filter(c => state.jobCodes.includes(c) && state.goalCodes.includes(c));
  const inEG = allCodes.filter(c => state.examCodes.includes(c) && state.goalCodes.includes(c));
  const inAll3 = allCodes.filter(c => state.jobCodes.includes(c) && state.examCodes.includes(c) && state.goalCodes.includes(c));

  const coveredCount = (codes: string[]) => codes.filter(c => state.covered.includes(c)).length;

  // Categorise each code in universe
  const buckets: Record<Bucket, string[]> = {
    urgent: [], priorityJE: [], priorityJG: [], priorityEG: [],
    jobOnly: [], examOnly: [], goalOnly: [],
    onTrack: [], wasted: [],
  };

  allCodes.forEach(code => {
    const { bucket } = classifySubgenre(code, state);
    buckets[bucket].push(code);
  });

  // Wasted = covered but not in any recommendation set
  buckets.wasted = state.covered.filter(c => !universe.has(c));

  // On track = covered AND in one of the recommendation sets
  buckets.onTrack = state.covered.filter(c => universe.has(c));

  // Priority gaps = un-covered subgenres that appear in 2+ of the 3 circles.
  // (The strict "all-3" centre is rare; "2+ circles" is the meaningful,
  //  high-ROI signal — it is almost always non-zero once a job is set.)
  const priorityGapCount =
    buckets.urgent.length + buckets.priorityJE.length +
    buckets.priorityJG.length + buckets.priorityEG.length;

  const totalRecommended = universe.size;
  const totalCovered     = buckets.onTrack.length;
  const coveragePct      = totalRecommended > 0
    ? Math.round(100 * totalCovered / totalRecommended)
    : 0;

  // Filtered codes for display — JOB/EXAM/GOAL filter by circle membership
  // (so they match the badges on each card), the rest by status.
  const priorityCodes = [
    ...buckets.urgent, ...buckets.priorityJE,
    ...buckets.priorityJG, ...buckets.priorityEG,
  ];
  const displayedCodes: string[] = (() => {
    switch (filterBucket) {
      case 'all':      return [...allCodes].sort();
      case 'priority': return priorityCodes;
      case 'job':      return allCodes.filter(c => state.jobCodes.includes(c));
      case 'exam':     return allCodes.filter(c => state.examCodes.includes(c));
      case 'goal':     return allCodes.filter(c => state.goalCodes.includes(c));
      case 'done':     return buckets.onTrack;
      case 'wasted':   return buckets.wasted;
      default:         return [...allCodes].sort();
    }
  })();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={TEXT} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Coverage Map</Text>
          <Text style={styles.headerSub}>Your COCA subgenre exposure vs. recommendations</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile summary card */}
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>JOB</Text>
            <Text style={styles.profileVal} numberOfLines={1}>
              {job?.title ?? '— (not set)'}
            </Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>EXAM</Text>
            <Text style={styles.profileVal}>
              {state.examTarget.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>GOAL</Text>
            <Text style={styles.profileVal}>
              {state.primaryGoal.charAt(0).toUpperCase() + state.primaryGoal.slice(1)}
            </Text>
          </View>
        </View>

        {/* Venn diagram */}
        <View style={styles.vennWrap}>
          <VennDiagram
            jobCount={state.jobCodes.length}
            examCount={state.examCodes.length}
            goalCount={state.goalCodes.length}
            jeCount={inJE.length}
            jgCount={inJG.length}
            egCount={inEG.length}
            allCount={inAll3.length}
            coveredAll={coveredCount(inAll3)}
            coveredJE={coveredCount(inJE)}
            coveredJG={coveredCount(inJG)}
            coveredEG={coveredCount(inEG)}
          />
        </View>

        {/* Overall coverage strip */}
        <View style={styles.coverageStrip}>
          <View style={{ flex: 1 }}>
            <Text style={styles.coverageLabel}>Overall Coverage</Text>
            <Text style={styles.coverageVal}>
              {totalCovered} / {totalRecommended} recommended subgenres
            </Text>
          </View>
          <Text style={[styles.coveragePct, {
            color: coveragePct >= 70 ? '#10B981' : coveragePct >= 40 ? '#F59E0B' : '#EF4444',
          }]}>
            {coveragePct}%
          </Text>
        </View>

        {/* Critical insights */}
        <View style={styles.insightsRow}>
          <InsightCard
            icon="alert-triangle"
            color="#EF4444"
            count={priorityGapCount}
            label="PRIORITY"
            sub="In 2+ of your circles — do these first"
          />
          <InsightCard
            icon="check-circle"
            color="#10B981"
            count={buckets.onTrack.length}
            label="ON TRACK"
            sub="Already covered"
          />
          <InsightCard
            icon="trending-down"
            color="#94A3B8"
            count={buckets.wasted.length}
            label="OUT OF SCOPE"
            sub="Covered but irrelevant"
          />
        </View>

        {/* Filter chips */}
        <Text style={styles.sectionTitle}>Breakdown</Text>
        <View style={styles.filterRow}>
          {[
            { key: 'all',      label: 'All',         color: TEXT2 },
            { key: 'priority', label: '🔥 Priority', color: '#EF4444' },
            { key: 'job',      label: 'JOB',         color: C_JOB },
            { key: 'exam',     label: 'EXAM',        color: C_EXAM },
            { key: 'goal',     label: 'GOAL',        color: C_GOAL },
            { key: 'done',     label: '✓ Done',      color: '#10B981' },
            { key: 'wasted',   label: '🗑 Wasted',   color: '#94A3B8' },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterChip,
                filterBucket === f.key && { backgroundColor: f.color + '18', borderColor: f.color },
              ]}
              onPress={() => setFilterBucket(f.key as any)}
            >
              <Text style={[
                styles.filterChipText,
                filterBucket === f.key && { color: f.color, fontWeight: '800' },
              ]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Code list */}
        <View style={styles.codesList}>
          {displayedCodes.length === 0 && (
            <Text style={styles.emptyText}>
              {filterBucket === 'all'
                ? 'No data yet — complete onboarding to see your map.'
                : 'No subgenres in this bucket.'}
            </Text>
          )}
          {displayedCodes.map(code => {
            const sub = findSubgenre(code);
            if (!sub) return null;
            const { bucket, sources } = classifySubgenre(code, state);
            const isCovered = state.covered.includes(code);
            const mainColor = COCA_MAIN_BY_KEY[sub.main]?.color ?? TEXT2;
            const words = getSubgenreWords(code);
            const isOpen = expandedCode === code;

            return (
              <View key={code}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setExpandedCode(isOpen ? null : code)}
                  style={[
                    styles.codeCard,
                    { borderLeftColor: bucketColor(bucket) },
                    isOpen && { borderColor: mainColor, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
                  ]}
                >
                  <View style={[styles.codeBadge, { backgroundColor: mainColor + '20' }]}>
                    <Text style={[styles.codeBadgeText, { color: mainColor }]}>
                      {sub.icon}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.codeTitleRow}>
                      <Text style={styles.codeTitle}>{sub.label}</Text>
                      {isCovered ? (
                        <View style={styles.checkBadge}>
                          <Feather name="check" size={11} color="#fff" />
                        </View>
                      ) : (
                        <View style={[styles.checkBadge, { backgroundColor: '#E2E8F0' }]}>
                          <Feather name="x" size={11} color="#94A3B8" />
                        </View>
                      )}
                    </View>
                    <Text style={styles.codeDesc} numberOfLines={1}>{sub.description}</Text>
                    <View style={styles.codeSourcesRow}>
                      {sources.map(s => (
                        <View key={s} style={[styles.sourceBadge, {
                          backgroundColor: s === 'JOB' ? C_JOB + '20' : s === 'EXAM' ? C_EXAM + '20' : C_GOAL + '20',
                        }]}>
                          <Text style={[styles.sourceBadgeText, {
                            color: s === 'JOB' ? C_JOB : s === 'EXAM' ? C_EXAM : C_GOAL,
                          }]}>
                            {s}
                          </Text>
                        </View>
                      ))}
                      {words.length > 0 && (
                        <View style={styles.wordsCountBadge}>
                          <Feather name="book-open" size={9} color={mainColor} />
                          <Text style={[styles.wordsCountText, { color: mainColor }]}>
                            {words.length} words
                          </Text>
                          <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={12} color={mainColor} />
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Expanded: distinctive words to practise for this domain */}
                {isOpen && (
                  <View style={[styles.wordsPanel, { borderColor: mainColor }]}>
                    <Text style={styles.wordsPanelTitle}>
                      Key vocabulary for {sub.label}
                    </Text>
                    <Text style={styles.wordsPanelHint}>
                      Words most characteristic of this register (COCA keyness).
                    </Text>
                    {words.length === 0 ? (
                      <Text style={styles.wordsEmpty}>No word data for this subgenre.</Text>
                    ) : (
                      <View style={styles.wordsWrap}>
                        {words.map((w, i) => (
                          <View key={w + i} style={[styles.wordChip, { backgroundColor: mainColor + '12', borderColor: mainColor + '33' }]}>
                            <Text style={[styles.wordChipText, { color: mainColor }]}>{w}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <TouchableOpacity
                      style={[styles.practiceBtn, { backgroundColor: mainColor }]}
                      activeOpacity={0.85}
                      onPress={() => router.push('/(tabs)/vocabulary')}
                    >
                      <Feather name="play" size={13} color="#fff" />
                      <Text style={styles.practiceBtnText}>Practise these words</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Theory note */}
        <View style={styles.theoryCard}>
          <Text style={styles.theoryTitle}>📚 Theoretical Basis</Text>
          <Text style={styles.theoryText}>
            <Text style={{ fontWeight: '800' }}>Biber & Conrad (2019)</Text> — registers cluster around
            shared lexico-grammatical features. Cross-genre exposure correlates significantly with L2 written
            proficiency (Biber et al. 2011, <Text style={{ fontStyle: 'italic' }}>Applied Linguistics 32</Text>).
          </Text>
          <Text style={[styles.theoryText, { marginTop: 6 }]}>
            <Text style={{ fontWeight: '800' }}>Swales (1990)</Text> — discourse communities are defined by
            their genre repertoire. Mastery of those genres enables effective professional participation.
          </Text>
          <Text style={[styles.theoryText, { marginTop: 6 }]}>
            Coverage map plots all <Text style={{ fontWeight: '800' }}>96 COCA subgenres</Text> (Davies 2008)
            against three recommendation sources. O*NET-SOC 2018 occupational taxonomy is used for job → register mapping.
          </Text>
          <Text style={[styles.theoryText, { marginTop: 6 }]}>
            Per-domain word lists are the most <Text style={{ fontWeight: '800' }}>distinctive content words</Text> for
            each register, ranked by <Text style={{ fontStyle: 'italic' }}>keyness</Text> (Scott 1997) over the
            COCA 60k-lemma × 96-subgenre frequency matrix — not raw frequency, so they reflect what makes each
            register characteristic.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────
function InsightCard({
  icon, color, count, label, sub,
}: { icon: any; color: string; count: number; label: string; sub: string }) {
  return (
    <View style={[styles.insightCard, { borderColor: color + '30', backgroundColor: color + '08' }]}>
      <Feather name={icon} size={18} color={color} />
      <Text style={[styles.insightCount, { color }]}>{count}</Text>
      <Text style={[styles.insightLabel, { color }]}>{label}</Text>
      <Text style={styles.insightSub} numberOfLines={2}>{sub}</Text>
    </View>
  );
}

function bucketColor(b: Bucket): string {
  switch (b) {
    case 'urgent':     return '#EF4444';
    case 'priorityJE': return '#7C3AED';
    case 'priorityJG': return '#059669';
    case 'priorityEG': return '#0F766E';
    case 'jobOnly':    return C_JOB;
    case 'examOnly':   return C_EXAM;
    case 'goalOnly':   return C_GOAL;
    case 'onTrack':    return '#10B981';
    case 'wasted':     return '#94A3B8';
  }
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    backgroundColor: CARD,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: TEXT, letterSpacing: -0.3 },
  headerSub:   { fontSize: 12, color: TEXT2, marginTop: 1 },

  scroll: { padding: 16 },

  // Profile summary
  profileCard: {
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    padding: 14, marginBottom: 14, gap: 8,
  },
  profileRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileLabel: { fontSize: 10, fontWeight: '800', color: TEXT2, letterSpacing: 1.2, width: 44 },
  profileVal:   { fontSize: 13, fontWeight: '700', color: TEXT, flex: 1 },

  // Venn
  vennWrap: {
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    paddingVertical: 14, marginBottom: 14,
  },
  vennCircle: {
    position: 'absolute',
    borderWidth: 2,
  },
  vennPill: {
    position: 'absolute',
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 999, borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    minWidth: 56, alignItems: 'center',
    shadowColor: '#0F172A', shadowOpacity: 0.10,
    shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  vennPillText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  vennCount: {
    position: 'absolute', width: 36, textAlign: 'center',
    fontSize: 17, fontWeight: '900',
    textShadowColor: 'rgba(255,255,255,0.95)',
    textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 },
  },
  vennCountBig: {
    position: 'absolute', width: 36, textAlign: 'center',
    fontSize: 22, fontWeight: '900',
    textShadowColor: 'rgba(255,255,255,0.95)',
    textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 },
  },
  vennCenter: {
    position: 'absolute', width: 56, alignItems: 'center',
  },
  vennCenterCount: {
    fontSize: 22, fontWeight: '900', color: '#0F172A',
    textShadowColor: '#fff', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4,
  },
  vennCenterCovered: {
    fontSize: 10, fontWeight: '800', color: '#10B981',
    textShadowColor: '#fff', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4,
  },

  // Coverage strip
  coverageStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    padding: 14, marginBottom: 14,
  },
  coverageLabel: { fontSize: 11, fontWeight: '800', color: TEXT2, letterSpacing: 0.8 },
  coverageVal:   { fontSize: 13, fontWeight: '700', color: TEXT, marginTop: 2 },
  coveragePct:   { fontSize: 32, fontWeight: '900' },

  // Insights row
  insightsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  insightCard: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    padding: 10, alignItems: 'center', gap: 2,
  },
  insightCount: { fontSize: 22, fontWeight: '900', marginTop: 4 },
  insightLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  insightSub:   { fontSize: 9, color: TEXT2, textAlign: 'center', lineHeight: 12, marginTop: 2 },

  // Section title
  sectionTitle: { fontSize: 14, fontWeight: '800', color: TEXT, marginBottom: 10 },

  // Filter chips
  filterRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
    borderColor: BORDER, backgroundColor: CARD,
  },
  filterChipText: { fontSize: 11, fontWeight: '700', color: TEXT2 },

  // Code list
  codesList: { gap: 8 },
  codeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER,
    borderLeftWidth: 3,
    padding: 10,
  },
  codeBadge: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  codeBadgeText: { fontSize: 18 },
  codeTitleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeTitle:     { fontSize: 13, fontWeight: '700', color: TEXT, flex: 1 },
  codeDesc:      { fontSize: 11, color: TEXT2, marginTop: 1 },
  codeSourcesRow:{ flexDirection: 'row', gap: 4, marginTop: 4 },
  sourceBadge:   { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  sourceBadgeText:{ fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  checkBadge: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#10B981',
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 6,
  },
  wordsCountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
    backgroundColor: '#F1F5F9', marginLeft: 'auto',
  },
  wordsCountText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },

  // Expanded words panel
  wordsPanel: {
    backgroundColor: CARD,
    borderWidth: 1, borderTopWidth: 0,
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    padding: 12, marginTop: -1, marginBottom: 2,
  },
  wordsPanelTitle: { fontSize: 12, fontWeight: '800', color: TEXT },
  wordsPanelHint:  { fontSize: 10, color: TEXT2, marginTop: 1, marginBottom: 8 },
  wordsEmpty:      { fontSize: 11, color: TEXT3, fontStyle: 'italic' },
  wordsWrap:       { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  wordChip: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1,
  },
  wordChipText: { fontSize: 11, fontWeight: '700' },
  practiceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 9, paddingVertical: 9, marginTop: 10,
  },
  practiceBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  emptyText: {
    fontSize: 12, color: TEXT3,
    textAlign: 'center', padding: 24,
  },

  // Theory card
  theoryCard: {
    backgroundColor: '#EFF6FF', borderRadius: 14,
    borderWidth: 1, borderColor: '#BFDBFE',
    padding: 14, marginTop: 16,
  },
  theoryTitle: { fontSize: 13, fontWeight: '800', color: '#1E40AF', marginBottom: 8 },
  theoryText:  { fontSize: 12, color: '#1D4ED8', lineHeight: 18 },
});
