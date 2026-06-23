/**
 * Coverage Map — 3-circle Venn diagram showing the learner's
 * COCA subgenre coverage against three recommendation sources:
 *
 *   JOB    — subgenres essential for the learner's profession (O*NET → COCA)
 *   EXAM   — subgenres tied to their target exam (IELTS / Cambridge / etc.)
 *   GOAL   — subgenres aligned with their primary learning goal
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

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { palette } from '@/constants/theme';

// Theme
const BG     = palette.bg;
const CARD   = palette.card;
const TEXT   = palette.text;
const TEXT2  = palette.textSubtle;
const TEXT3  = palette.textMuted;
const BORDER = palette.border;

const C_JOB  = palette.purple;  // purple — JOB
const C_EXAM = palette.purpleSoft;  // light purple — EXAM (distinguishable from JOB)
const C_GOAL = palette.teal;  // teal — GOAL

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

// Type definitions
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

// Helpers
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
  if (sources.length === 0)             return { bucket: 'wasted', sources }; // not recommended, not covered — treat as noise
  if (isCov)                            return { bucket: 'onTrack', sources };

  if (inJob && inExam && inGoal)        return { bucket: 'urgent',     sources };
  if (inJob && inExam)                  return { bucket: 'priorityJE', sources };
  if (inJob && inGoal)                  return { bucket: 'priorityJG', sources };
  if (inExam && inGoal)                 return { bucket: 'priorityEG', sources };
  if (inJob)                            return { bucket: 'jobOnly',    sources };
  if (inExam)                           return { bucket: 'examOnly',   sources };
  return { bucket: 'goalOnly', sources };
}

// Venn diagram — three overlapping circles
function VennDiagram({
  jobCount, examCount, goalCount,
  jeCount, jgCount, egCount, allCount,
  coveredAll,
}: {
  jobCount: number; examCount: number; goalCount: number;
  jeCount: number; jgCount: number; egCount: number; allCount: number;
  coveredAll: number;
}) {
  const jobOnly  = jobCount  - jeCount - jgCount + allCount;
  const examOnly = examCount - jeCount - egCount + allCount;
  const goalOnly = goalCount - jgCount - egCount + allCount;
  const je = jeCount - allCount;
  const jg = jgCount - allCount;
  const eg = egCount - allCount;

  const circle = (c: { cx: number; cy: number }, fill: string, border: string) => (
    <View style={[styles.vennCircle, {
      left: c.cx - R, top: c.cy - R,
      width: R * 2, height: R * 2, borderRadius: R,
      backgroundColor: fill, borderColor: border,
    }]} pointerEvents="none" />
  );

  const num = (x: number, y: number, value: number) => (
    <Text style={[styles.vennCount, { left: x - 18, top: y - 12 }]}>{value}</Text>
  );

  return (
    <View>
      {/* Diagram */}
      <View style={{ width: VENN_W, height: VENN_H, alignSelf: 'center' }}>
        {circle(CC.exam, C_EXAM + '30', C_EXAM)}
        {circle(CC.goal, C_GOAL + '30', C_GOAL)}
        {circle(CC.job,  C_JOB  + '30', C_JOB)}

        {/* Labels */}
        <View style={[styles.vennPill, { left: CX - 28, top: JOB_CY - R - BAND + 2, borderColor: C_JOB }]}>
          <View style={[styles.vennPillDot, { backgroundColor: C_JOB }]} />
          <Text style={[styles.vennPillText, { color: C_JOB }]}>JOB</Text>
        </View>
        <View style={[styles.vennPill, { left: CC.exam.cx - R + 2, top: LOW_CY + R + 4, borderColor: C_EXAM }]}>
          <View style={[styles.vennPillDot, { backgroundColor: C_EXAM }]} />
          <Text style={[styles.vennPillText, { color: C_EXAM }]}>EXAM</Text>
        </View>
        <View style={[styles.vennPill, { left: CC.goal.cx + R - 54, top: LOW_CY + R + 4, borderColor: C_GOAL }]}>
          <View style={[styles.vennPillDot, { backgroundColor: C_GOAL }]} />
          <Text style={[styles.vennPillText, { color: C_GOAL }]}>GOAL</Text>
        </View>

        {/* Solo region numbers */}
        {num(CX,                         JOB_CY - R * 0.44, jobOnly)}
        {num(CC.exam.cx - R * 0.46,      LOW_CY + R * 0.30, examOnly)}
        {num(CC.goal.cx + R * 0.46,      LOW_CY + R * 0.30, goalOnly)}

        {/* Pairwise numbers */}
        {num((CX + CC.exam.cx) / 2 - R * 0.08, (JOB_CY + LOW_CY) / 2, je)}
        {num((CX + CC.goal.cx) / 2 + R * 0.08, (JOB_CY + LOW_CY) / 2, jg)}
        {num(CX,                                LOW_CY + R * 0.40, eg)}

        {/* Centre */}
        <View style={[styles.vennCenter, { left: CX - 28, top: CENTROID_Y - 20 }]}>
          <Text style={styles.vennCenterCount}>{allCount}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Feather name="check" size={9} color={C_GOAL} />
            <Text style={styles.vennCenterCovered}>{coveredAll}/{allCount}</Text>
          </View>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.vennLegend}>
        <View style={styles.vennLegendRow}>
          <LegendItem color={C_JOB}  label="JOB only"       value={jobOnly}  />
          <LegendItem color={C_EXAM} label="EXAM only"      value={examOnly} />
          <LegendItem color={C_GOAL} label="GOAL only"      value={goalOnly} />
        </View>
        <View style={styles.vennLegendRow}>
          <LegendItem color={C_JOB}  label="JOB ∩ EXAM"    value={je}       dual={C_EXAM} />
          <LegendItem color={C_JOB}  label="JOB ∩ GOAL"    value={jg}       dual={C_GOAL} />
          <LegendItem color={C_EXAM} label="EXAM ∩ GOAL"   value={eg}       dual={C_GOAL} />
        </View>
        <View style={[styles.vennLegendPriority]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ flexDirection: 'row' }}>
              <View style={[styles.vennLegendDot, { backgroundColor: C_JOB }]} />
              <View style={[styles.vennLegendDot, { backgroundColor: C_EXAM, marginLeft: -4 }]} />
              <View style={[styles.vennLegendDot, { backgroundColor: C_GOAL, marginLeft: -4 }]} />
            </View>
            <Text style={styles.vennLegendPriorityLabel}>JOB ∩ EXAM ∩ GOAL — Priority zone</Text>
          </View>
          <Text style={styles.vennLegendPriorityValue}>{allCount}</Text>
        </View>
      </View>
    </View>
  );
}

function LegendItem({ color, label, value, dual }: {
  color: string; label: string; value: number; dual?: string;
}) {
  return (
    <View style={styles.vennLegendItem}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={[styles.vennLegendDot, { backgroundColor: color }]} />
        {dual && <View style={[styles.vennLegendDot, { backgroundColor: dual, marginLeft: -4 }]} />}
      </View>
      <Text style={styles.vennLegendLabel}>{label}</Text>
      <Text style={[styles.vennLegendValue, { color }]}>{value}</Text>
    </View>
  );
}

// Main screen
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

  // Render
  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={TEXT} />
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

        {/* Venn diagram + legend */}
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
            color: coveragePct >= 70 ? '#0FBA9A' : coveragePct >= 40 ? '#8B5CF6' : '#EF4444',
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
            color="#0FBA9A"
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
          {([
            { key: 'all',      label: 'All',      icon: 'list'         as const, color: TEXT2       },
            { key: 'priority', label: 'Priority', icon: 'alert-circle' as const, color: '#EF4444'   },
            { key: 'job',      label: 'JOB',      icon: 'briefcase'    as const, color: C_JOB       },
            { key: 'exam',     label: 'EXAM',     icon: 'award'        as const, color: C_EXAM      },
            { key: 'goal',     label: 'GOAL',     icon: 'target'       as const, color: C_GOAL      },
            { key: 'done',     label: 'Done',     icon: 'check-circle' as const, color: '#0FBA9A'   },
            { key: 'wasted',   label: 'Wasted',   icon: 'trash-2'      as const, color: '#94A3B8'   },
          ] as const).map(f => {
            const active = filterBucket === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterChip,
                  active && { backgroundColor: f.color + '18', borderColor: f.color },
                ]}
                onPress={() => setFilterBucket(f.key as any)}
              >
                <Feather name={f.icon} size={11} color={active ? f.color : TEXT2} />
                <Text style={[
                  styles.filterChipText,
                  active && { color: f.color, fontWeight: '800' },
                ]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
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
                    <Feather name={sub.icon as any} size={18} color={mainColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.codeTitleRow}>
                      <Text style={styles.codeTitle}>{sub.label}</Text>
                      {isCovered ? (
                        <View style={styles.checkBadge}>
                          <Feather name="check" size={11} color="#fff" />
                        </View>
                      ) : (
                        <View style={[styles.checkBadge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Feather name="book-open" size={14} color="#1E40AF" />
            <Text style={styles.theoryTitle}>Theoretical Basis</Text>
          </View>
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

// Sub-components
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
    case 'priorityJE': return '#8B5CF6';
    case 'priorityJG': return '#0FBA9A';
    case 'priorityEG': return '#0FBA9A';
    case 'jobOnly':    return C_JOB;
    case 'examOnly':   return C_EXAM;
    case 'goalOnly':   return C_GOAL;
    case 'onTrack':    return '#0FBA9A';
    case 'wasted':     return '#94A3B8';
  }
}

// Styles
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14,
    backgroundColor: CARD,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#0F1B2D',
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
    flexDirection: 'row', alignItems: 'center', gap: 5,
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
  codeTitleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeTitle:     { fontSize: 13, fontWeight: '700', color: TEXT, flex: 1 },
  codeDesc:      { fontSize: 11, color: TEXT2, marginTop: 1 },
  codeSourcesRow:{ flexDirection: 'row', gap: 4, marginTop: 4 },
  sourceBadge:   { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  sourceBadgeText:{ fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  checkBadge: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#0FBA9A',
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 6,
  },
  wordsCountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
    backgroundColor: '#0F1B2D', marginLeft: 'auto',
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
    backgroundColor: 'rgba(139,92,246,0.08)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)',
    padding: 14, marginTop: 16,
  },
  theoryTitle: { fontSize: 13, fontWeight: '800', color: '#8B5CF6', marginBottom: 8 },
  theoryText:  { fontSize: 12, color: '#8B5CF6', lineHeight: 18 },

  // Venn
  vennWrap: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    paddingTop: 14, paddingBottom: 16,
    paddingHorizontal: 8, marginBottom: 14,
  },
  vennCircle: { position: 'absolute', borderWidth: 2 },
  vennPill: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 999, borderWidth: 1.5, backgroundColor: CARD,
    minWidth: 58, justifyContent: 'center',
  },
  vennPillDot: { width: 6, height: 6, borderRadius: 3 },
  vennPillText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  vennCount: {
    position: 'absolute', width: 36, textAlign: 'center',
    fontSize: 20, fontWeight: '900', color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 },
  },
  vennCenter: { position: 'absolute', width: 56, alignItems: 'center', gap: 2 },
  vennCenterCount: {
    fontSize: 28, fontWeight: '900', color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  vennCenterCovered: { fontSize: 11, fontWeight: '800', color: C_GOAL },

  // Legend
  vennLegend: {
    marginTop: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: BORDER,
    paddingHorizontal: 8, gap: 8,
  },
  vennLegendRow: { flexDirection: 'row', gap: 6 },
  vennLegendItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: BG, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6,
    borderWidth: 1, borderColor: BORDER,
  },
  vennLegendDot:  { width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5, borderColor: BG },
  vennLegendLabel:{ flex: 1, fontSize: 9, color: TEXT2, fontWeight: '600' },
  vennLegendValue:{ fontSize: 14, fontWeight: '900' },

  vennLegendPriority: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C_JOB + '12', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: C_JOB + '30',
  },
  vennLegendPriorityLabel: { fontSize: 11, fontWeight: '700', color: TEXT },
  vennLegendPriorityValue: { fontSize: 20, fontWeight: '900', color: C_JOB },
});
