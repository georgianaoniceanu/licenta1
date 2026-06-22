import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColor } from '@/hooks/use-theme-color';

// Web-only hover handlers — onMouse* fire only on react-native-web and are
// absent from RN's Pressable types, so we attach them via an untyped spread.
const webHover = (onEnter: () => void, onLeave: () => void): any => ({
  onMouseEnter: onEnter,
  onMouseLeave: onLeave,
});

interface PhonemeCell {
  id: string;
  phoneme: string;
  errorRate: number;
  difficulty: number;
  issue: string;
  strategy: string;
  category: 'vowel' | 'consonant' | 'alophone';
}

const PHONEME_DATA: PhonemeCell[] = [
  // VOWELS - Row 1
  {
    id: 'v1',
    phoneme: '/u:/-/ʊ/',
    errorRate: 100,
    difficulty: 100,
    category: 'vowel',
    issue: 'Tense-Lax confusion - NO Romanian reaches RP standard (100% error)',
    strategy: 'Long vowel = 200ms tense, short = 100ms relaxed'
  },
  {
    id: 'v2',
    phoneme: '/i:/-/ɪ/',
    errorRate: 90,
    difficulty: 95,
    category: 'vowel',
    issue: 'Merge into intermediate, usually too relaxed',
    strategy: 'Minimal pairs: fleece/kit, keep /i:/ forward and tense'
  },
  {
    id: 'v3',
    phoneme: '/æ/-/ɑ:/',
    errorRate: 55,
    difficulty: 65,
    category: 'vowel',
    issue: '/æ/ pulled to /e/, /ɑ:/ influenced by /a/',
    strategy: 'Open wider for /æ/, further back for /ɑ:/'
  },
  {
    id: 'v4',
    phoneme: '/ʌ/',
    errorRate: 65,
    difficulty: 70,
    category: 'vowel',
    issue: 'Influenced by Romanian /a/, produced too open',
    strategy: 'More central, less open than /a/'
  },
  {
    id: 'v5',
    phoneme: '/ə/',
    errorRate: 40,
    difficulty: 45,
    category: 'vowel',
    issue: 'Distribution in unstressed syllables',
    strategy: 'Light but not completely elided'
  },

  // CONSONANTS - Row 2
  {
    id: 'c1',
    phoneme: '/ð/',
    errorRate: 95,
    difficulty: 95,
    category: 'consonant',
    issue: 'NOT in Romanian - stops to [d]: "this" → "dis"',
    strategy: 'Tongue BETWEEN teeth + add voice'
  },
  {
    id: 'c2',
    phoneme: '/θ/',
    errorRate: 90,
    difficulty: 90,
    category: 'consonant',
    issue: 'NOT in Romanian - stops to [t]: "think" → "tink"',
    strategy: 'Mirror work: tongue between teeth. Only 10% consistent success'
  },
  {
    id: 'c3',
    phoneme: '/ŋ/',
    errorRate: 50,
    difficulty: 75,
    category: 'consonant',
    issue: '50% add [g] after = "doing-g" due to L1 constraint',
    strategy: 'Train final /ŋ/ WITHOUT following consonant'
  },

  // ALLOPHONES - Row 3
  {
    id: 'a1',
    phoneme: '[ɫ] Dark L',
    errorRate: 60,
    difficulty: 70,
    category: 'alophone',
    issue: '50% NEVER produce dark L - use clear [l] instead',
    strategy: 'Position rule: clear at start, dark at end'
  },
  {
    id: 'a2',
    phoneme: '[pʰ]',
    errorRate: 70,
    difficulty: 80,
    category: 'alophone',
    issue: 'Sometimes suppress, sometimes over-aspirate',
    strategy: 'VOT training: English = 50-100ms'
  },
  {
    id: 'a3',
    phoneme: '[tʰ]',
    errorRate: 70,
    difficulty: 80,
    category: 'alophone',
    issue: '[th] produced extremely rarely (weakest)',
    strategy: 'Explicit aspiration instruction for start of word'
  },
  {
    id: 'a4',
    phoneme: '[kʰ]',
    errorRate: 70,
    difficulty: 80,
    category: 'alophone',
    issue: '70% OVER-aspirate (VOT > 40ms) - exceeds English',
    strategy: 'Show spectrograms of correct VOT'
  },
];

interface HeatmapHotspot {
  phoneme: string;
  x: number;
  y: number;
  size: number;
}

export const PhonemeHeatmapMap = () => {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const [selectedCell, setSelectedCell] = useState<PhonemeCell | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const cellSize = Math.min((screenWidth - 48) / 5, 85);

  // Get color based on error rate
  const getHeatColor = (errorRate: number) => {
    if (errorRate >= 90) return '#d62728'; // Critical red
    if (errorRate >= 75) return '#ff6b35'; // High orange
    if (errorRate >= 60) return '#ffa500'; // Medium orange
    if (errorRate >= 45) return '#ffd700'; // Warning yellow
    return '#90ee90'; // Light green
  };

  const getShadowIntensity = (errorRate: number) => {
    return Math.min(errorRate / 100, 1); // 0-1 scale
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor }]} showsVerticalScrollIndicator={false}>
      {/* Title */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>
          🗺️ Phonological Difficulty Heatmap
        </Text>
        <Text style={[styles.subtitle, { color: textColor }]}>
          Based on Măchiță (2021) - Romanian vs English Phonology
        </Text>
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendRow}>
          <View style={[styles.legendBox, { backgroundColor: '#d62728' }]} />
          <Text style={[styles.legendText, { color: textColor }]}>Critical (90-100%)</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendBox, { backgroundColor: '#ff6b35' }]} />
          <Text style={[styles.legendText, { color: textColor }]}>High (75-89%)</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendBox, { backgroundColor: '#ffa500' }]} />
          <Text style={[styles.legendText, { color: textColor }]}>Medium (60-74%)</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendBox, { backgroundColor: '#ffd700' }]} />
          <Text style={[styles.legendText, { color: textColor }]}>Warning (45-59%)</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendBox, { backgroundColor: '#90ee90' }]} />
          <Text style={[styles.legendText, { color: textColor }]}>Lower ({'<'}45%)</Text>
        </View>
      </View>

      {/* HEATMAP */}
      <View style={styles.heatmapContainer}>
        {/* VOWEL ROW */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: textColor }]}>
            📢 VOWEL SYSTEM (Tense-Lax Distinction)
          </Text>
          <View style={styles.gridRow}>
            {PHONEME_DATA.filter(p => p.category === 'vowel').map(cell => (
              <Pressable
                key={cell.id}
                onPress={() => setSelectedCell(cell)}
                {...webHover(() => setHoveredId(cell.id), () => setHoveredId(null))}
                style={[
                  styles.heatCell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: getHeatColor(cell.errorRate),
                    borderWidth: hoveredId === cell.id ? 3 : 2,
                    borderColor: hoveredId === cell.id ? '#000' : 'rgba(0,0,0,0.2)',
                    shadowOpacity: getShadowIntensity(cell.errorRate),
                  },
                ]}
              >
                <Text style={styles.cellPhone}>{cell.phoneme}</Text>
                <Text style={styles.cellPercent}>{cell.errorRate}%</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* CONSONANT ROW */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: textColor }]}>
            🔊 CONSONANTS (Missing Fricatives)
          </Text>
          <View style={styles.gridRow}>
            {PHONEME_DATA.filter(p => p.category === 'consonant').map(cell => (
              <Pressable
                key={cell.id}
                onPress={() => setSelectedCell(cell)}
                {...webHover(() => setHoveredId(cell.id), () => setHoveredId(null))}
                style={[
                  styles.heatCell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: getHeatColor(cell.errorRate),
                    borderWidth: hoveredId === cell.id ? 3 : 2,
                    borderColor: hoveredId === cell.id ? '#000' : 'rgba(0,0,0,0.2)',
                    shadowOpacity: getShadowIntensity(cell.errorRate),
                  },
                ]}
              >
                <Text style={styles.cellPhone}>{cell.phoneme}</Text>
                <Text style={styles.cellPercent}>{cell.errorRate}%</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ALLOPHONES ROW */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: textColor }]}>
            🎯 ALLOPHONES (Positional Variations)
          </Text>
          <View style={styles.gridRow}>
            {PHONEME_DATA.filter(p => p.category === 'alophone').map(cell => (
              <Pressable
                key={cell.id}
                onPress={() => setSelectedCell(cell)}
                {...webHover(() => setHoveredId(cell.id), () => setHoveredId(null))}
                style={[
                  styles.heatCell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: getHeatColor(cell.errorRate),
                    borderWidth: hoveredId === cell.id ? 3 : 2,
                    borderColor: hoveredId === cell.id ? '#000' : 'rgba(0,0,0,0.2)',
                    shadowOpacity: getShadowIntensity(cell.errorRate),
                  },
                ]}
              >
                <Text style={styles.cellPhone}>{cell.phoneme}</Text>
                <Text style={styles.cellPercent}>{cell.errorRate}%</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* DETAIL PANEL */}
      {selectedCell && (
        <Pressable
          style={styles.detailOverlay}
          onPress={() => setSelectedCell(null)}
        >
          <View style={styles.detailPanel}>
            {/* Header */}
            <LinearGradient
              colors={[getHeatColor(selectedCell.errorRate), 'rgba(0,0,0,0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.detailHeader}
            >
              <Text style={styles.detailPhoneme}>{selectedCell.phoneme}</Text>
              <Pressable
                onPress={() => setSelectedCell(null)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </LinearGradient>

            {/* Content */}
            <ScrollView style={styles.detailContent} showsVerticalScrollIndicator={false}>
              {/* Error Rate */}
              <View style={styles.statSection}>
                <Text style={styles.statLabel}>Error Rate</Text>
                <View style={styles.statBar}>
                  <View
                    style={[
                      styles.statBarFill,
                      {
                        width: `${selectedCell.errorRate}%`,
                        backgroundColor: getHeatColor(selectedCell.errorRate),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.statValue}>
                  {selectedCell.errorRate}% of Romanian speakers make this error
                </Text>
              </View>

              {/* Difficulty */}
              <View style={styles.statSection}>
                <Text style={styles.statLabel}>Difficulty Score</Text>
                <Text style={styles.statValue}>{selectedCell.difficulty}/100</Text>
              </View>

              {/* Issue */}
              <View style={styles.infoSection}>
                <Text style={styles.infoLabel}>🔍 The Problem:</Text>
                <Text style={styles.infoText}>{selectedCell.issue}</Text>
              </View>

              {/* Strategy */}
              <View style={styles.infoSection}>
                <Text style={styles.infoLabel}>💡 Correction Strategy:</Text>
                <Text style={styles.infoText}>{selectedCell.strategy}</Text>
              </View>

              {/* Category */}
              <View style={styles.infoSection}>
                <Text style={styles.infoLabel}>📁 Category:</Text>
                <Text style={styles.categoryBadge}>
                  {selectedCell.category.toUpperCase()}
                </Text>
              </View>

              {/* Source */}
              <View style={styles.sourceSection}>
                <Text style={styles.sourceText}>
                  📚 Măchiță, O.-M. (2021). The Acquisition of English Phonology by Romanian and French Learners of English
                </Text>
              </View>
            </ScrollView>
          </View>
        </Pressable>
      )}

      {/* KEY FINDINGS */}
      <View style={styles.findingsSection}>
        <Text style={[styles.sectionHeading, { color: textColor }]}>
          🎓 Key Research Findings
        </Text>

        <View style={styles.findingBox}>
          <Text style={styles.findingTitle}>1. The /u:/-/ʊ/ Crisis</Text>
          <Text style={styles.findingText}>
            100% of Romanian speakers fail this distinction. None reach RP standard. This is the MOST DIFFICULT phoneme pair.
          </Text>
        </View>

        <View style={styles.findingBox}>
          <Text style={styles.findingTitle}>2. Interdental Fricatives Don't Exist</Text>
          <Text style={styles.findingText}>
            /θ/ and /ð/ aren't in Romanian. 90% substitute with stops: think→tink, this→dis. Only 10% ever achieve correct /θ/.
          </Text>
        </View>

        <View style={styles.findingBox}>
          <Text style={styles.findingTitle}>3. Deep L1 Transfer Pattern</Text>
          <Text style={styles.findingText}>
            50% add [g] after /ŋ/: "doing-g". Romanian only has [ŋ] before /k,g/, so speakers can't suppress the habit.
          </Text>
        </View>

        <View style={styles.findingBox}>
          <Text style={styles.findingTitle}>4. Aspiration Over-Compensation</Text>
          <Text style={styles.findingText}>
            70% over-aspirate /k/ (VOT {'>'} 40ms). Yet ironically, only 30% produce aspirated /t/ correctly.
          </Text>
        </View>
      </View>

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
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
  },

  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 12,
    opacity: 0.6,
  },

  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 12,
  },

  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  legendBox: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },

  legendText: {
    fontSize: 11,
    fontWeight: '500',
  },

  heatmapContainer: {
    marginBottom: 24,
  },

  section: {
    marginBottom: 24,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },

  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },

  heatCell: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 4,
    paddingLeft: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 5,
  },

  cellPhone: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  cellPercent: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  detailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },

  detailPanel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: '80%',
    width: '100%',
  },

  detailHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  detailPhoneme: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },

  closeBtn: {
    padding: 8,
  },

  closeBtnText: {
    fontSize: 24,
    color: '#fff',
  },

  detailContent: {
    padding: 16,
  },

  statSection: {
    marginBottom: 16,
  },

  statLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },

  statBar: {
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },

  statBarFill: {
    height: '100%',
  },

  statValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },

  infoSection: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  infoLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8,
  },

  infoText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#555',
  },

  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 'bold',
    overflow: 'hidden',
  },

  sourceSection: {
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    marginTop: 12,
  },

  sourceText: {
    fontSize: 11,
    color: '#999',
    lineHeight: 16,
    fontStyle: 'italic',
  },

  findingsSection: {
    marginTop: 20,
    marginBottom: 20,
  },

  sectionHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },

  findingBox: {
    backgroundColor: '#f5f5f5',
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
    borderRadius: 6,
    marginBottom: 12,
  },

  findingTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1565c0',
    marginBottom: 8,
  },

  findingText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#555',
  },
});

export default PhonemeHeatmapMap;
