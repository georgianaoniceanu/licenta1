import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

interface PhonemeDetail {
  phoneme: string;
  errorRate: number;
  difficulty: number;
  issue: string;
  strategy: string;
}

export const RomanianPhonemeHeatmap = () => {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const [selectedPhoneme, setSelectedPhoneme] = useState<PhonemeDetail | null>(null);

  // Data from Măchiță (2021)
  const phonemeData: PhonemeDetail[] = [
    {
      phoneme: '/u:/ vs /ʊ/',
      errorRate: 100,
      difficulty: 100,
      issue: 'Romanian lacks tense-lax distinction - /u:/ = 100% error rate',
      strategy: 'Visual mouth position, duration contrast (200ms vs 100ms), spectrograms'
    },
    {
      phoneme: '/ð/',
      errorRate: 95,
      difficulty: 95,
      issue: 'Interdental fricative not in Romanian - substitute [d]',
      strategy: 'Explicit instruction: place tongue BETWEEN teeth, add voice'
    },
    {
      phoneme: '/θ/',
      errorRate: 90,
      difficulty: 90,
      issue: 'Interdental fricative not in Romanian - substitute [t]',
      strategy: 'Mirror work: tongue between teeth, only 10% achieve consistent production'
    },
    {
      phoneme: '/i:/ vs /ɪ/',
      errorRate: 90,
      difficulty: 95,
      issue: 'Tense-lax confusion - merge into intermediate category',
      strategy: 'Contrast drilling: fleece/kit, keep /i:/ tense and forward'
    },
    {
      phoneme: '/ŋ/',
      errorRate: 50,
      difficulty: 75,
      issue: '50% of speakers add [g] or [k] after - "doing-g"',
      strategy: 'Break distributive constraint: /ŋ/ can end words WITHOUT /g/'
    },
    {
      phoneme: '[ɫ] Dark L',
      errorRate: 60,
      difficulty: 70,
      issue: '50% never produce dark L correctly - use clear [l] instead',
      strategy: 'Positional rule: clear L at start, dark L at end'
    },
    {
      phoneme: '[kʰ] Aspiration',
      errorRate: 70,
      difficulty: 80,
      issue: '70% over-aspirate - exceed English norms (VOT > 40ms)',
      strategy: 'VOT training: show spectrograms, English norms = 50-100ms'
    },
    {
      phoneme: '/ʌ/',
      errorRate: 65,
      difficulty: 70,
      issue: 'Influenced by Romanian /a/ - produced too open',
      strategy: 'More central, less open than /a/'
    },
    {
      phoneme: '/æ/ vs /ɑ:/',
      errorRate: 55,
      difficulty: 65,
      issue: '/æ/ pulled toward Romanian /e/, /ɑ:/ like Romanian /a/',
      strategy: 'Open mouth wider for /æ/, further back for /ɑ:/'
    },
    {
      phoneme: '[pʰ] Aspiration',
      errorRate: 70,
      difficulty: 80,
      issue: 'Sometimes suppress, sometimes over-aspirate',
      strategy: 'VOT training for initial /p/'
    },
    {
      phoneme: '[tʰ] Aspiration',
      errorRate: 70,
      difficulty: 80,
      issue: '[th] produced extremely rarely - weakest realization',
      strategy: 'Explicit aspiration instruction for /t/ at word start'
    },
    {
      phoneme: '/ə/',
      errorRate: 40,
      difficulty: 45,
      issue: 'Distribution issues in unstressed syllables',
      strategy: 'Keep unstressed syllables light but not completely elided'
    }
  ];

  // Sort by error rate (highest first)
  const sortedPhonemes = [...phonemeData].sort((a, b) => b.errorRate - a.errorRate);

  const getDifficultyColor = (errorRate: number) => {
    if (errorRate >= 90) return '#d62728'; // Red - critical
    if (errorRate >= 70) return '#ff7f0e'; // Orange - high
    if (errorRate >= 50) return '#ffdd57'; // Yellow - medium
    return '#2ca02c'; // Green - lower
  };

  const getDifficultyLabel = (errorRate: number) => {
    if (errorRate >= 90) return 'CRITICAL';
    if (errorRate >= 70) return 'HIGH';
    if (errorRate >= 50) return 'MEDIUM';
    return 'LOWER';
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>
          Romanian Phonological Patterns
        </Text>
        <Text style={[styles.subtitle, { color: textColor }]}>
          Based on Măchiță (2021) - English Phonology Research
        </Text>
      </View>

      {/* Summary Stats */}
      <View style={styles.statsContainer}>
        <View style={[styles.statBox, { borderLeftColor: '#d62728' }]}>
          <Text style={styles.statLabel}>CRITICAL</Text>
          <Text style={styles.statValue}>4</Text>
          <Text style={styles.statDesc}>90%+ error rate</Text>
        </View>
        <View style={[styles.statBox, { borderLeftColor: '#ff7f0e' }]}>
          <Text style={styles.statLabel}>HIGH</Text>
          <Text style={styles.statValue}>5</Text>
          <Text style={styles.statDesc}>70-89% error rate</Text>
        </View>
        <View style={[styles.statBox, { borderLeftColor: '#ffdd57' }]}>
          <Text style={styles.statLabel}>MEDIUM</Text>
          <Text style={styles.statValue}>2</Text>
          <Text style={styles.statDesc}>50-69% error rate</Text>
        </View>
        <View style={[styles.statBox, { borderLeftColor: '#2ca02c' }]}>
          <Text style={styles.statLabel}>LOWER</Text>
          <Text style={styles.statValue}>1</Text>
          <Text style={styles.statDesc}>Below 50% errors</Text>
        </View>
      </View>

      {/* Heatmap Grid */}
      <View style={styles.heatmapSection}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Phoneme Difficulty Grid
        </Text>

        {sortedPhonemes.map((phoneme, index) => (
          <Pressable
            key={index}
            onPress={() => setSelectedPhoneme(phoneme)}
            style={styles.phonemeRow}
          >
            <View style={styles.phonemeContent}>
              {/* Phoneme Name */}
              <Text style={[styles.phonemeName, { color: textColor }]}>
                {phoneme.phoneme}
              </Text>

              {/* Difficulty Bar */}
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${phoneme.errorRate}%`,
                      backgroundColor: getDifficultyColor(phoneme.errorRate)
                    }
                  ]}
                >
                  <Text style={styles.barText}>{phoneme.errorRate}%</Text>
                </View>
              </View>

              {/* Labels */}
              <View style={styles.labelsRow}>
                <Text style={[styles.label, { color: textColor }]}>
                  {getDifficultyLabel(phoneme.errorRate)}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Detail Panel */}
      {selectedPhoneme && (
        <View style={styles.detailPanel}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>{selectedPhoneme.phoneme}</Text>
            <Pressable onPress={() => setSelectedPhoneme(null)}>
              <Text style={styles.closeButton}></Text>
            </Pressable>
          </View>

          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Error Rate:</Text>
            <Text style={styles.detailValue}>{selectedPhoneme.errorRate}% of Romanian speakers</Text>

            <Text style={[styles.detailLabel, { marginTop: 12 }]}>Issue:</Text>
            <Text style={[styles.detailValue, { fontSize: 13, lineHeight: 20 }]}>
              {selectedPhoneme.issue}
            </Text>

            <Text style={[styles.detailLabel, { marginTop: 12 }]}>Correction Strategy:</Text>
            <Text style={[styles.detailValue, { fontSize: 13, lineHeight: 20 }]}>
              {selectedPhoneme.strategy}
            </Text>

            <View style={styles.sourceNote}>
              <Text style={styles.sourceText}>
                Source: Măchiță, O.-M. (2021). The Acquisition of English Phonology by Romanian and French Learners of English. University of Bucharest.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Research Insights */}
      <View style={styles.insightsSection}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Key Research Findings
        </Text>

        <View style={styles.insightBox}>
          <Text style={styles.insightHeading}>Vowel System (Tense-Lax)</Text>
          <Text style={styles.insightText}>
            Romanian lacks the tense-lax distinction found in English. Speakers merge /i:/ and /ɪ/, and critically, /u:/ and /ʊ/ - with NO Romanian reaching RP standard pronunciation.
          </Text>
        </View>

        <View style={styles.insightBox}>
          <Text style={styles.insightHeading}>Missing Consonants</Text>
          <Text style={styles.insightText}>
            Interdental fricatives /θ/ and /ð/ don't exist in Romanian. Speakers use STOPPING: /θ/→[t] and /ð/→[d] (think→tink, this→dis). Only 10% consistently produce /θ/ correctly.
          </Text>
        </View>

        <View style={styles.insightBox}>
          <Text style={styles.insightHeading}>Alophone Constraints</Text>
          <Text style={styles.insightText}>
            50% of Romanian speakers add [g] after /ŋ/ (saying "doing-g") because Romanian treats [ŋ] as only appearing before /k,g/. This deep L1 pattern is hard to break.
          </Text>
        </View>

        <View style={styles.insightBox}>
          <Text style={styles.insightHeading}>Over-Aspiration Issue</Text>
          <Text style={styles.insightText}>
            70% of Romanian speakers over-aspirate /k/, exceeding English norms (VOT {'>'} 40ms). Meanwhile, aspirated [th] is produced extremely rarely.
          </Text>
        </View>
      </View>

      {/* Spacer */}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },

  header: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 13,
    opacity: 0.7,
  },

  statsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
    justifyContent: 'space-between',
  },

  statBox: {
    flex: 1,
    padding: 12,
    borderLeftWidth: 4,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },

  statLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    opacity: 0.7,
    marginBottom: 4,
  },

  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  statDesc: {
    fontSize: 10,
    opacity: 0.6,
  },

  heatmapSection: {
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },

  phonemeRow: {
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f9f9f9',
  },

  phonemeContent: {
    padding: 12,
  },

  phonemeName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },

  barContainer: {
    height: 24,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },

  bar: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 8,
  },

  barText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  label: {
    fontSize: 10,
    fontWeight: 'bold',
    opacity: 0.7,
  },

  detailPanel: {
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    marginBottom: 24,
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: '#ff7f0e',
  },

  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ffe0b2',
  },

  detailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e65100',
  },

  closeButton: {
    fontSize: 20,
    color: '#e65100',
  },

  detailContent: {
    padding: 16,
  },

  detailLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
  },

  detailValue: {
    fontSize: 14,
    color: '#333',
    marginTop: 6,
  },

  sourceNote: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 4,
  },

  sourceText: {
    fontSize: 11,
    color: '#666',
    lineHeight: 18,
  },

  insightsSection: {
    marginBottom: 24,
  },

  insightBox: {
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },

  insightHeading: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1976d2',
  },

  insightText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#555',
  },
});

export default RomanianPhonemeHeatmap;
