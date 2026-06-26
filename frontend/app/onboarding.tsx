/**
 * Onboarding Screen — 6-step learner profiling wizard
 *
 * Research Foundation:
 * Step 1 — CEFR Self-Assessment
 *   Present-Thomas, Weltens & de Jong (2013): self-assessment is a valid
 *   learner-centred proficiency classification method. "Can-do" descriptors
 *   from the CEFR Global Scale (Council of Europe, 2001/2020).
 *
 * Step 2 — Primary Goal (CAF dimensions)
 *   Pallotti (2015): Complexity, Accuracy, Fluency are the three independent
 *   dimensions of L2 proficiency. Kolahi Ahari et al. (2025): lexical diversity,
 *   sophistication, syntactic complexity, cohesion explain 34% of proficiency.
 *
 * Step 3 — Domain Focus
 *   Dimova (2022) / Fulcher (2003): task domain (narration, argumentation,
 *   conversation, academic) determines which linguistic features are critical.
 *
 * Step 4 — Target Exam
 *   Zechner et al. (2009) TOEFL iBT; IELTS Guide (IDP); English Profile (EVP).
 *   Exam choice shifts indicator weights for personalised feedback.
 *
 * Step 5 — Perceived Weak Areas (Dual Diagnosis seed)
 *   Alderson (2005): diagnostic tests identify SPECIFIC weaknesses, not global.
 *   User selections → pain_points for AssessmentWorkflowEngine.run_dual_diagnosis().
 *
 * Step 6 — Study Intensity
 *   Skehan (1998): time on task and motivation significantly affect development
 *   rate (high motivation → 1.40× faster CEFR progression).
 */

import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  StatusBar,
  ActivityIndicator,
  Modal,
  Pressable,
  Image,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, palette } from '@/constants/theme';
import { API_URL } from '@/constants/api';
import { getFreshToken } from '@/utils/auth';
import { INDUSTRIES, jobsByIndustry, type Industry } from '@/constants/jobsDatabase';
import { Illustrations } from '@/constants/illustrations';

const STEP_ART = [
  Illustrations.obLevel, Illustrations.obJob, Illustrations.obGoal,
  Illustrations.obDomain, Illustrations.obWeak, Illustrations.obTime,
];

// QUESTION DATA  (mirrors backend onboarding.py)

const CEFR_OPTIONS = [
  { value: 'A1', label: 'A1 — Beginner',        description: 'I can use very basic phrases and introduce myself.' },
  { value: 'A2', label: 'A2 — Elementary',       description: 'I understand common expressions and communicate in simple tasks.' },
  { value: 'B1', label: 'B1 — Intermediate',     description: 'I handle most travel situations and describe experiences.' },
  { value: 'B2', label: 'B2 — Upper-Intermediate', description: 'I follow complex texts and interact fluently with native speakers.' },
  { value: 'C1', label: 'C1 — Advanced',         description: 'I express myself fluently for academic and professional purposes.' },
  { value: 'C2', label: 'C2 — Proficient',       description: 'I understand virtually everything and express myself precisely.' },
];

const GOAL_OPTIONS = [
  { value: 'vocabulary',   label: 'Vocabulary Range',       icon: 'book-open', description: 'Use a wider variety of words; avoid repetition.' },
  { value: 'pronunciation', label: 'Pronunciation',          icon: 'mic', description: 'Produce sounds more clearly and accurately.' },
  { value: 'grammar',      label: 'Grammar Accuracy',        icon: 'edit-2', description: 'Fewer errors in verb tenses and sentence structure.' },
  { value: 'fluency',      label: 'Fluency',                 icon: 'zap', description: 'Speak more smoothly, with fewer pauses and hesitations.' },
  { value: 'complexity',   label: 'Sentence Complexity',     icon: 'link', description: 'Build longer, more varied sentences.' },
  { value: 'coherence',    label: 'Discourse & Coherence',   icon: 'grid', description: 'Connect ideas clearly using transitions.' },
];

const DOMAIN_OPTIONS = [
  { value: 'conversation',   label: 'Everyday Conversation', icon: 'message-circle', description: 'Casual talk, quick responses, turn-taking.' },
  { value: 'narration',      label: 'Storytelling',           icon: 'book', description: 'Telling stories, describing past events.' },
  { value: 'description',    label: 'Descriptions',           icon: 'image', description: 'Describing people, places, objects in detail.' },
  { value: 'argumentation',  label: 'Arguments & Opinions',   icon: 'message-square', description: 'Presenting views, persuading, debating.' },
  { value: 'academic',       label: 'Academic / Professional',icon: 'award', description: 'Presentations, formal writing, academic English.' },
  { value: 'technical',      label: 'Technical / Specialized',icon: 'search', description: 'Domain-specific: medical, IT, legal, etc.' },
];

const EXAM_OPTIONS = [
  { value: 'general',        label: 'General Improvement',   icon: 'globe', description: 'No specific exam — improve overall English.' },
  { value: 'ielts_academic', label: 'IELTS Academic',        icon: 'file-text', description: 'Lexical Resource, Coherence, Grammar, Pronunciation.' },
  { value: 'ielts_general',  label: 'IELTS General',         icon: 'file-text', description: 'IELTS for migration and workplace purposes.' },
  { value: 'toefl_ibt',      label: 'TOEFL iBT',             icon: 'book', description: 'Language Use, Organization, Delivery, Vocabulary.' },
  { value: 'cambridge_fce',  label: 'Cambridge B2 First',    icon: 'award', description: 'FCE — B2 level Cambridge certificate.' },
  { value: 'cambridge_cae',  label: 'Cambridge C1 Advanced', icon: 'award', description: 'CAE — C1 level Cambridge certificate.' },
  { value: 'cambridge_cpe',  label: 'Cambridge C2 Proficiency', icon: 'award', description: 'CPE — highest Cambridge certificate.' },
  { value: 'pte_core',       label: 'PTE Core',              icon: 'globe', description: 'Pearson Test of English — Core (Canada immigration).' },
];

const WEAK_AREA_OPTIONS = [
  { value: 'vocabulary',        label: 'Vocabulary Range',         icon: 'book-open', description: 'I tend to repeat the same words.' },
  { value: 'word_choice',       label: 'Word Sophistication',      icon: 'star', description: 'I use simple words instead of more precise ones.' },
  { value: 'pronunciation',     label: 'Pronunciation',            icon: 'mic', description: 'My sounds are sometimes unclear or incorrect.' },
  { value: 'fluency',           label: 'Fluency / Hesitations',    icon: 'pause-circle', description: 'I pause a lot or use fillers (um, uh).' },
  { value: 'grammar',           label: 'Grammar Accuracy',         icon: 'edit-2', description: 'I make errors in tenses or sentence structure.' },
  { value: 'sentence_length',   label: 'Short/Simple Sentences',   icon: 'align-left', description: 'My sentences are short; I struggle to combine ideas.' },
  { value: 'complex_structures', label: 'Complex Structures',      icon: 'link', description: 'I rarely use subordinate clauses.' },
  { value: 'coherence',         label: 'Connecting Ideas',         icon: 'grid', description: "My ideas don't flow; I lack transitions." },
];

const STUDY_TIME_OPTIONS = [
  { value: 10,  label: '10 min / day', icon: 'zap', description: 'Quick daily practice — maintains momentum.' },
  { value: 20,  label: '20 min / day', icon: 'target', description: 'Recommended minimum for steady progress.' },
  { value: 30,  label: '30 min / day', icon: 'zap', description: 'Good balance — covers all key modules.' },
  { value: 60,  label: '60+ min / day', icon: 'zap', description: 'Intensive — fastest CEFR progression.' },
];

const STEPS = [
  { key: 'self_assessed_cefr',    title: 'Current Level',      subtitle: 'Choose the description that best matches you.' },
  { key: 'profession',            title: 'Profession',         subtitle: 'What do you do? Recommendations depend on your job context.' },
  { key: 'primary_goal',          title: 'Learning Goal',      subtitle: 'Pick the area you most want to improve.' },
  { key: 'target_domain',         title: 'Your Context',       subtitle: 'Which context will you use English in most?' },
  { key: 'target_exam',           title: 'Target Exam',        subtitle: 'Are you preparing for a specific exam?' },
  { key: 'perceived_weak_areas',  title: 'Weak Areas',         subtitle: 'Where do you feel you struggle most? (up to 3)' },
  { key: 'daily_study_minutes',   title: 'Study Time',         subtitle: 'How much time can you study each day?' },
];

// COMPONENT

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [industryPickerOpen, setIndustryPickerOpen] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [answers, setAnswers] = useState<{
    self_assessed_cefr: string;
    profession: string;          // job id (e.g. "software-engineer")
    industry: string;            // industry key (e.g. "tech")
    primary_goal: string;
    target_domain: string;
    target_exam: string;
    perceived_weak_areas: string[];
    daily_study_minutes: number;
  }>({
    self_assessed_cefr: '',
    profession: '',
    industry: '',
    primary_goal: '',
    target_domain: '',
    target_exam: '',
    perceived_weak_areas: [],
    daily_study_minutes: 0,
  });

  // Animate step transition
  const transitionStep = (nextStep: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setCurrentStep(nextStep);
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };

  const selectSingle = (key: string, value: string | number) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const toggleWeakArea = (value: string) => {
    setAnswers(prev => {
      const current = prev.perceived_weak_areas;
      if (current.includes(value)) {
        return { ...prev, perceived_weak_areas: current.filter(v => v !== value) };
      }
      if (current.length >= 3) return prev; // max 3
      return { ...prev, perceived_weak_areas: [...current, value] };
    });
  };

  const isCurrentStepComplete = () => {
    const step = STEPS[currentStep];
    if (step.key === 'perceived_weak_areas') return answers.perceived_weak_areas.length > 0;
    if (step.key === 'daily_study_minutes') return answers.daily_study_minutes > 0;
    if (step.key === 'profession') return !!answers.profession;
    return !!answers[step.key as keyof typeof answers];
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      transitionStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) transitionStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const token = await getFreshToken();
      if (!token) throw new Error('No auth token');

      const response = await fetch(`${API_URL}/auth/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(answers),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`HTTP ${response.status} — ${err || 'no body'}`);
      }

      // Confirm the server actually persisted it (not just returned 200)
      const saved = await response.json().catch(() => null);
      if (!saved || saved.status !== 'completed') {
        throw new Error(`Server did not confirm save: ${JSON.stringify(saved)}`);
      }

      await AsyncStorage.multiSet([
        ['onboardingCompleted', 'true'],
        ['userTargetExam',      answers.target_exam],
        ['userPrimaryGoal',     answers.primary_goal],
        ['userJob',             answers.profession],
        ['userIndustry',        answers.industry],
        ['userCurrentCEFR',     answers.self_assessed_cefr],
        ['userDomain',          answers.target_domain],
        ['userWeaknesses',      JSON.stringify(answers.perceived_weak_areas)],
        ['userIntensity',       String(answers.daily_study_minutes)],
      ]);
      router.replace('/initial_diagnostic');
    } catch (error: any) {
      console.error('Onboarding submit error:', error);
      // Make the failure VISIBLE instead of pretending it saved. The local
      // cache is still written so the app stays usable, but the user (and we)
      // now see the real reason the server save failed.
      Alert.alert(
        'Onboarding not saved on the server',
        `Your answers are kept on this device, but saving to your account failed:\n\n${error?.message || error}\n\nBackend: ${API_URL}`,
        [{ text: 'Continue anyway', onPress: () => router.replace('/initial_diagnostic') }],
      );
      await AsyncStorage.multiSet([
        ['onboardingCompleted', 'true'],
        ['userTargetExam',      answers.target_exam],
        ['userPrimaryGoal',     answers.primary_goal],
        ['userJob',             answers.profession],
        ['userIndustry',        answers.industry],
        ['userCurrentCEFR',     answers.self_assessed_cefr],
        ['userDomain',          answers.target_domain],
        ['userWeaknesses',      JSON.stringify(answers.perceived_weak_areas)],
        ['userIntensity',       String(answers.daily_study_minutes)],
      ]);
    } finally {
      setSaving(false);
    }
  };

  const step = STEPS[currentStep];
  const progress = (currentStep + 1) / STEPS.length;

  // RENDER STEP OPTIONS

  const renderOptions = () => {
    switch (step.key) {
      case 'self_assessed_cefr':
        return CEFR_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.optionCard, answers.self_assessed_cefr === opt.value && styles.optionCardSelected]}
            onPress={() => selectSingle('self_assessed_cefr', opt.value)}
            activeOpacity={0.75}
          >
            <View style={styles.optionRow}>
              <View style={[styles.cefBadge, answers.self_assessed_cefr === opt.value && styles.cefBadgeSelected]}>
                <Text style={[styles.cefBadgeText, answers.self_assessed_cefr === opt.value && styles.cefBadgeTextSelected]}>
                  {opt.value}
                </Text>
              </View>
              <View style={styles.optionTextBlock}>
                <Text style={[styles.optionLabel, answers.self_assessed_cefr === opt.value && styles.optionLabelSelected]}>
                  {opt.label.split(' — ')[1]}
                </Text>
                <Text style={styles.optionDesc}>{opt.description}</Text>
              </View>
              {answers.self_assessed_cefr === opt.value && (
                <View style={styles.checkCircle}><Feather name="check" size={12} color="#fff" /></View>
              )}
            </View>
          </TouchableOpacity>
        ));

      case 'profession': {
        const availableJobs = answers.industry
          ? jobsByIndustry(answers.industry as Industry)
          : [];
        const selectedInd = INDUSTRIES.find(i => i.key === answers.industry);
        return (
          <View>
            <Text style={styles.subStepLabel}>1. Choose your industry</Text>

            {/* Spinner / dropdown trigger */}
            <TouchableOpacity
              style={[
                styles.dropdownTrigger,
                selectedInd && { borderColor: selectedInd.color + '70' },
              ]}
              onPress={() => setIndustryPickerOpen(true)}
              activeOpacity={0.8}
            >
              {selectedInd ? (
                <>
                  <Feather name={selectedInd.icon as any} size={20} color={TINT} />
                  <Text style={styles.dropdownValue}>{selectedInd.label}</Text>
                </>
              ) : (
                <Text style={styles.dropdownPlaceholder}>Select your industry…</Text>
              )}
              <Text style={styles.dropdownChevron}>▾</Text>
            </TouchableOpacity>

            {/* Industry picker (spinner-style modal) */}
            <Modal
              visible={industryPickerOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setIndustryPickerOpen(false)}
            >
              <Pressable style={styles.pickerOverlay} onPress={() => setIndustryPickerOpen(false)}>
                <Pressable style={styles.pickerSheet} onPress={() => {}}>
                  <View style={styles.pickerHandle} />
                  <Text style={styles.pickerTitle}>Select your industry</Text>
                  <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                    {INDUSTRIES.map(ind => {
                      const selected = answers.industry === ind.key;
                      return (
                        <TouchableOpacity
                          key={ind.key}
                          style={[styles.pickerItem, selected && { backgroundColor: ind.color + '12' }]}
                          onPress={() => {
                            setAnswers(prev => ({ ...prev, industry: ind.key, profession: '' }));
                            setIndustryPickerOpen(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Feather name={ind.icon as any} size={20} color={TINT} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.pickerItemLabel, selected && { color: ind.color, fontWeight: '800' }]}>
                              {ind.label}
                            </Text>
                            <Text style={styles.pickerItemDesc} numberOfLines={1}>{ind.description}</Text>
                          </View>
                          {selected && <Feather name="check" size={14} color={ind.color} />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </Pressable>
              </Pressable>
            </Modal>

            {answers.industry && (
              <>
                <Text style={[styles.subStepLabel, { marginTop: 16 }]}>
                  2. Pick your role
                </Text>
                {availableJobs.map(job => {
                  const selected = answers.profession === job.id;
                  return (
                    <TouchableOpacity
                      key={job.id}
                      style={[styles.jobRow, selected && styles.jobRowSelected]}
                      onPress={() => selectSingle('profession', job.id)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[
                          styles.jobTitle,
                          selected && { color: Colors.light.tint, fontWeight: '800' },
                        ]}>
                          {job.title}
                        </Text>
                        <Text style={styles.jobDesc} numberOfLines={1}>
                          {job.description}
                        </Text>
                        <Text style={styles.jobSoc}>SOC {job.socCode}</Text>
                      </View>
                      {selected && (
                        <View style={styles.checkCircle}><Feather name="check" size={12} color="#fff" /></View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {!answers.industry && (
              <Text style={styles.profPlaceholder}>
                Select an industry above to see available roles.
              </Text>
            )}
          </View>
        );
      }

      case 'primary_goal':
        return (
          <View style={styles.gridTwo}>
            {GOAL_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.gridCard, answers.primary_goal === opt.value && styles.gridCardSelected]}
                onPress={() => selectSingle('primary_goal', opt.value)}
                activeOpacity={0.75}
              >
                <Feather name={opt.icon as any} size={22} color={TINT} />
                <Text style={[styles.gridLabel, answers.primary_goal === opt.value && styles.gridLabelSelected]}>
                  {opt.label}
                </Text>
                <Text style={styles.gridDesc}>{opt.description}</Text>
                {answers.primary_goal === opt.value && (
                  <View style={styles.gridCheck}><Feather name="check" size={12} color="#fff" /></View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'target_domain':
        return (
          <View style={styles.gridTwo}>
            {DOMAIN_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.gridCard, answers.target_domain === opt.value && styles.gridCardSelected]}
                onPress={() => selectSingle('target_domain', opt.value)}
                activeOpacity={0.75}
              >
                <Feather name={opt.icon as any} size={22} color={TINT} />
                <Text style={[styles.gridLabel, answers.target_domain === opt.value && styles.gridLabelSelected]}>
                  {opt.label}
                </Text>
                <Text style={styles.gridDesc}>{opt.description}</Text>
                {answers.target_domain === opt.value && (
                  <View style={styles.gridCheck}><Feather name="check" size={12} color="#fff" /></View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'target_exam':
        return EXAM_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.optionCard, answers.target_exam === opt.value && styles.optionCardSelected]}
            onPress={() => selectSingle('target_exam', opt.value)}
            activeOpacity={0.75}
          >
            <View style={styles.optionRow}>
              <Feather name={opt.icon as any} size={20} color={TINT} />
              <View style={styles.optionTextBlock}>
                <Text style={[styles.optionLabel, answers.target_exam === opt.value && styles.optionLabelSelected]}>
                  {opt.label}
                </Text>
                <Text style={styles.optionDesc}>{opt.description}</Text>
              </View>
              {answers.target_exam === opt.value && (
                <View style={styles.checkCircle}><Feather name="check" size={12} color="#fff" /></View>
              )}
            </View>
          </TouchableOpacity>
        ));

      case 'perceived_weak_areas':
        return (
          <>
            <Text style={styles.multiHint}>
              Select up to 3 — these seed your personal Dual Diagnosis
            </Text>
            {WEAK_AREA_OPTIONS.map(opt => {
              const selected = answers.perceived_weak_areas.includes(opt.value);
              const disabled = !selected && answers.perceived_weak_areas.length >= 3;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionCard,
                    selected && styles.optionCardSelected,
                    disabled && styles.optionCardDisabled,
                  ]}
                  onPress={() => !disabled && toggleWeakArea(opt.value)}
                  activeOpacity={disabled ? 1 : 0.75}
                >
                  <View style={styles.optionRow}>
                    <Feather name={opt.icon as any} size={20} color={TINT} />
                    <View style={styles.optionTextBlock}>
                      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.optionDesc}>{opt.description}</Text>
                    </View>
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                      {selected && <Feather name="check" size={12} color="#fff" />}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        );

      case 'daily_study_minutes':
        return STUDY_TIME_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.optionCard, answers.daily_study_minutes === opt.value && styles.optionCardSelected]}
            onPress={() => selectSingle('daily_study_minutes', opt.value)}
            activeOpacity={0.75}
          >
            <View style={styles.optionRow}>
              <Feather name={opt.icon as any} size={20} color={TINT} />
              <View style={styles.optionTextBlock}>
                <Text style={[styles.optionLabel, answers.daily_study_minutes === opt.value && styles.optionLabelSelected]}>
                  {opt.label}
                </Text>
                <Text style={styles.optionDesc}>{opt.description}</Text>
              </View>
              {answers.daily_study_minutes === opt.value && (
                <View style={styles.checkCircle}><Feather name="check" size={12} color="#fff" /></View>
              )}
            </View>
          </TouchableOpacity>
        ));

      default:
        return null;
    }
  };

  // RENDER

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.progressBarBg}>
          <Animated.View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.stepCounter}>{currentStep + 1} / {STEPS.length}</Text>
      </View>

      {/* Content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title block */}
          <View style={styles.titleBlock}>
            {STEP_ART[currentStep] && (
              <Image source={STEP_ART[currentStep]} style={styles.stepArt} resizeMode="contain" />
            )}
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
          </View>

          {/* Options */}
          {renderOptions()}

          {/* Bottom padding for buttons */}
          <View style={{ height: 120 }} />
        </ScrollView>
      </Animated.View>

      {/* Navigation buttons */}
      <View style={styles.navRow}>
        {currentStep > 0 ? (
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.8}>
            <Feather name="chevron-left" size={18} color={TINT} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}

        <TouchableOpacity
          style={[styles.nextBtn, !isCurrentStepComplete() && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!isCurrentStepComplete() || saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextBtnText}>
              {currentStep === STEPS.length - 1 ? 'Start Learning' : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// STYLES

// VocaFlow brand palette (light theme) — matches login & rest of app
const TINT = palette.teal;
const TINT_LIGHT = 'rgba(15,186,154,0.12)';
const CARD = palette.card;
const BORDER = palette.border;
const BG = palette.bg;
const TEXT = palette.text;
const TEXT_MUTED = palette.textMuted;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: BORDER,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: TINT,
    borderRadius: 2,
  },
  stepCounter: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'right',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  titleBlock: {
    marginBottom: Spacing.xl,
  },
  stepArt: { width: '74%', height: 140, alignSelf: 'center', marginBottom: Spacing.md },
  stepTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },

  // List options (CEFR, Exam, Study Time, Weak Areas)
  optionCard: {
    backgroundColor: CARD,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  optionCardSelected: {
    borderColor: TINT,
    backgroundColor: TINT_LIGHT,
  },
  optionCardDisabled: {
    opacity: 0.4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  optionTextBlock: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: TINT,
  },
  optionDesc: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 17,
  },

  // CEFR badge
  cefBadge: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cefBadgeSelected: {
    backgroundColor: TINT,
  },
  cefBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  cefBadgeTextSelected: {
    color: '#fff',
  },

  // Checkmarks
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: TINT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: TINT,
    borderColor: TINT,
  },

  examIcon: {
    fontSize: 24,
    width: 36,
    textAlign: 'center',
  },

  // Multi-select hint
  multiHint: {
    fontSize: 12,
    color: TINT,
    fontWeight: '500',
    marginBottom: Spacing.md,
  },

  // Grid options (Goal, Domain)
  gridTwo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  gridCard: {
    width: '48%',
    backgroundColor: CARD,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: Spacing.md,
    minHeight: 110,
    position: 'relative',
  },
  gridCardSelected: {
    borderColor: TINT,
    backgroundColor: TINT_LIGHT,
  },
  gridIcon: {
    fontSize: 26,
    marginBottom: Spacing.sm,
  },
  gridLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  gridLabelSelected: {
    color: TINT,
  },
  gridDesc: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    lineHeight: 15,
  },
  gridCheck: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: TINT,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Bottom nav
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Colors.light.background,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  backBtn: {
    flexDirection: 'row',
    gap: 2,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: TINT,
    backgroundColor: CARD,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: TINT,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  nextBtn: {
    backgroundColor: TINT,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    minWidth: 140,
    alignItems: 'center',
    shadowColor: TINT,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  nextBtnDisabled: {
    backgroundColor: BORDER,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Profession step
  subStepLabel: {
    fontSize: 12, fontWeight: '800',
    color: Colors.light.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  industryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  industryChip: {
    width: '31.5%',
    aspectRatio: 1.15,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BORDER,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  industryIcon: { fontSize: 22 },
  industryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    lineHeight: 13,
  },

  // Industry dropdown / spinner
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  dropdownIcon: { fontSize: 22 },
  dropdownValue: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.light.text },
  dropdownPlaceholder: { flex: 1, fontSize: 15, color: Colors.light.textLight },
  dropdownChevron: { fontSize: 16, color: Colors.light.textSecondary, fontWeight: '700' },

  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6,13,26,0.45)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  pickerHandle: {
    alignSelf: 'center',
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.light.border,
    marginBottom: 12,
  },
  pickerTitle: {
    fontSize: 17, fontWeight: '800', color: Colors.light.text,
    marginBottom: 10, paddingHorizontal: 4,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  pickerItemIcon: { fontSize: 24, width: 30, textAlign: 'center' },
  pickerItemLabel: { fontSize: 15, fontWeight: '700', color: Colors.light.text },
  pickerItemDesc: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },
  pickerCheck: { fontSize: 18, fontWeight: '900' },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  jobRowSelected: {
    borderColor: Colors.light.tint,
    backgroundColor: Colors.light.tint + '10',
  },
  jobTitle: { fontSize: 14, fontWeight: '700', color: Colors.light.text },
  jobDesc:  { fontSize: 11, color: Colors.light.textSecondary, marginTop: 2 },
  jobSoc:   { fontSize: 9, color: Colors.light.textLight, marginTop: 4, fontStyle: 'italic' },
  profPlaceholder: {
    fontSize: 13, color: Colors.light.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 24,
  },
});
