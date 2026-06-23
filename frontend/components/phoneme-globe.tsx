import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  PanResponder,
  Animated,
  Dimensions,
} from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

interface Phoneme {
  id: string;
  name: string;
  errorRate: number;
  difficulty: number;
  issue: string;
  strategy: string;
  angle: number;
  row: number;
}

const PHONEMES: Phoneme[] = [
  // Top row (critical)
  {
    id: 'p1',
    name: '/u:/-/ʊ/',
    errorRate: 100,
    difficulty: 100,
    issue: 'Tense-Lax confusion - No Romanian reaches RP standard',
    strategy: 'Keep /u:/ tense (200ms), /ʊ/ lax (100ms)',
    angle: 0,
    row: 0,
  },
  {
    id: 'p2',
    name: '/i:/-/ɪ/',
    errorRate: 90,
    difficulty: 95,
    issue: 'Merge into intermediate, usually too relaxed',
    strategy: 'Minimal pairs: fleece/kit, keep /i:/ forward and tense',
    angle: 60,
    row: 0,
  },
  {
    id: 'p3',
    name: '/ð/',
    errorRate: 95,
    difficulty: 95,
    issue: 'NOT in Romanian - stops to [d]',
    strategy: 'Tongue BETWEEN teeth + add voice',
    angle: 120,
    row: 0,
  },
  {
    id: 'p4',
    name: '/θ/',
    errorRate: 90,
    difficulty: 90,
    issue: 'NOT in Romanian - stops to [t]',
    strategy: 'Mirror work: tongue between teeth',
    angle: 180,
    row: 0,
  },
  {
    id: 'p5',
    name: '/æ/-/ɑ:/',
    errorRate: 55,
    difficulty: 65,
    issue: '/æ/ pulled to /e/, /ɑ:/ influenced by /a/',
    strategy: 'Open wider for /æ/, further back for /ɑ:/',
    angle: 240,
    row: 0,
  },
  {
    id: 'p6',
    name: '/ʌ/',
    errorRate: 65,
    difficulty: 70,
    issue: 'Influenced by Romanian /a/, produced too open',
    strategy: 'More central, less open than /a/',
    angle: 300,
    row: 0,
  },

  // Middle row
  {
    id: 'p7',
    name: '[ɫ] Dark L',
    errorRate: 60,
    difficulty: 70,
    issue: '50% NEVER produce dark L - use clear [l]',
    strategy: 'Position rule: clear at start, dark at end',
    angle: 30,
    row: 1,
  },
  {
    id: 'p8',
    name: '/ŋ/',
    errorRate: 50,
    difficulty: 75,
    issue: 'Deep L1 pattern: 50% add [g] after = "doing-g"',
    strategy: 'Train final /ŋ/ WITHOUT following consonant',
    angle: 150,
    row: 1,
  },
  {
    id: 'p9',
    name: '[kʰ]',
    errorRate: 70,
    difficulty: 80,
    issue: '70% OVER-aspirate (VOT > 40ms)',
    strategy: 'Show spectrograms of correct VOT',
    angle: 270,
    row: 1,
  },

  // Bottom row
  {
    id: 'p10',
    name: '/ə/',
    errorRate: 40,
    difficulty: 45,
    issue: 'Distribution in unstressed syllables',
    strategy: 'Light but not completely elided',
    angle: 90,
    row: 2,
  },
  {
    id: 'p11',
    name: '[pʰ]',
    errorRate: 70,
    difficulty: 80,
    issue: 'Sometimes suppress, sometimes over-aspirate',
    strategy: 'VOT training: English = 50-100ms',
    angle: 210,
    row: 2,
  },
  {
    id: 'p12',
    name: '[tʰ]',
    errorRate: 70,
    difficulty: 80,
    issue: '[th] produced extremely rarely (weakest)',
    strategy: 'Explicit aspiration instruction for start of word',
    angle: 330,
    row: 2,
  },
];

const getPhonemeColor = (errorRate: number) => {
  if (errorRate >= 90) return '#d62728';
  if (errorRate >= 75) return '#ff6b35';
  if (errorRate >= 60) return '#ffa500';
  if (errorRate >= 45) return '#ffd700';
  return '#90ee90';
};

export const PhonemeGlobe = () => {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const [selectedPhoneme, setSelectedPhoneme] = useState<Phoneme | null>(null);
  const [rotation, setRotation] = useState(0);
  const rotationAnim = useRef(new Animated.Value(0)).current;

  const { width } = Dimensions.get('window');
  const globeRadius = (width - 60) / 2;
  const centerX = width / 2 - 20;
  const centerY = 280;

  // Pan responder for rotation
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (e, { dx }) => {
        const newRotation = rotation + dx * 0.5;
        setRotation(newRotation);
      },
    })
  ).current;

  // Calculate phoneme positions on globe
  const getPhonemePosition = (phoneme: Phoneme) => {
    const radians = ((phoneme.angle + rotation) * Math.PI) / 180;
    const rowOffset = (phoneme.row - 1) * 60;
    const x = Math.cos(radians) * (globeRadius - rowOffset);
    const y = Math.sin(radians) * (globeRadius - rowOffset) * 0.6;
    const z = Math.sin(radians) * 30;

    return {
      left: centerX + x - 25,
      top: centerY + y - 25,
      zIndex: Math.round(z + 100),
      opacity: 0.5 + Math.cos(radians) * 0.5,
    };
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>Phoneme Globe</Text>
        <Text style={[styles.subtitle, { color: textColor }]}>
          Swipe to rotate • Tap to learn
        </Text>
      </View>

      {/* Globe Container */}
      <View
        style={[styles.globeContainer, { height: centerY * 2 + 60 }]}
        {...panResponder.panHandlers}
      >
        {/* Rotating phoneme nodes */}
        {PHONEMES.map((phoneme) => {
          const position = getPhonemePosition(phoneme);
          return (
            <Pressable
              key={phoneme.id}
              onPress={() => setSelectedPhoneme(phoneme)}
              style={[
                styles.phonemeNode,
                {
                  left: position.left,
                  top: position.top,
                  zIndex: position.zIndex,
                  backgroundColor: getPhonemeColor(phoneme.errorRate),
                  opacity: position.opacity,
                },
              ]}
            >
              <Text style={styles.phonemeLabel}>{phoneme.name}</Text>
              <Text style={styles.phonemeRate}>{phoneme.errorRate}%</Text>
            </Pressable>
          );
        })}

        {/* Center indicator */}
        <View
          style={[
            styles.centerPoint,
            { left: centerX - 8, top: centerY - 8 },
          ]}
        />
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.colorBox, { backgroundColor: '#d62728' }]} />
          <Text style={[styles.legendText, { color: textColor }]}>Critical (90-100%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.colorBox, { backgroundColor: '#ff6b35' }]} />
          <Text style={[styles.legendText, { color: textColor }]}>High (75-89%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.colorBox, { backgroundColor: '#ffa500' }]} />
          <Text style={[styles.legendText, { color: textColor }]}>Medium (60-74%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.colorBox, { backgroundColor: '#ffd700' }]} />
          <Text style={[styles.legendText, { color: textColor }]}>Warning (45-59%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.colorBox, { backgroundColor: '#90ee90' }]} />
          <Text style={[styles.legendText, { color: textColor }]}>Lower ({'<'}45%)</Text>
        </View>
      </View>

      {/* Detail Panel */}
      {selectedPhoneme && (
        <View style={styles.detailPanel}>
          <View style={[styles.detailHeader, { backgroundColor: getPhonemeColor(selectedPhoneme.errorRate) }]}>
            <Text style={styles.detailPhoneme}>{selectedPhoneme.name}</Text>
            <Pressable onPress={() => setSelectedPhoneme(null)}>
              <Text style={styles.closeBtn}></Text>
            </Pressable>
          </View>

          <View style={styles.detailContent}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Error Rate</Text>
              <Text style={styles.statValue}>
                {selectedPhoneme.errorRate}%
              </Text>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Difficulty</Text>
              <Text style={styles.statValue}>
                {selectedPhoneme.difficulty}/100
              </Text>
            </View>

            <Text style={styles.sectionTitle}>The Problem</Text>
            <Text style={styles.sectionText}>{selectedPhoneme.issue}</Text>

            <Text style={styles.sectionTitle}>Strategy</Text>
            <Text style={styles.sectionText}>{selectedPhoneme.strategy}</Text>

            <Text style={styles.sourceText}>
              Măchiță, O.-M. (2021)
            </Text>
          </View>
        </View>
      )}

      {/* Info */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>About This Globe</Text>
        <Text style={styles.infoText}>
          This interactive globe shows the 12 most critical phonemes for Romanian speakers learning English, arranged by difficulty. The size and color intensity reflect the error rate from research data (Măchiță, 2021).
        </Text>
        <Text style={styles.infoText}>
          Rotate the globe by swiping left and right. Tap any phoneme to see detailed correction strategies.
        </Text>
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
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

  globeContainer: {
    position: 'relative',
    marginVertical: 20,
    marginHorizontal: -10,
    paddingHorizontal: 10,
  },

  phonemeNode: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },

  phonemeLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center',
  },

  phonemeRate: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  centerPoint: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2196f3',
    opacity: 0.5,
  },

  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 8,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  colorBox: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },

  legendText: {
    fontSize: 11,
    fontWeight: '500',
  },

  detailPanel: {
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
  },

  detailHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  detailPhoneme: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },

  closeBtn: {
    fontSize: 24,
    color: '#fff',
  },

  detailContent: {
    padding: 16,
  },

  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },

  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
  },

  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
    color: '#000000',
  },

  sectionText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
    color: '#1a1a1a',
  },

  sourceText: {
    fontSize: 10,
    marginTop: 12,
    fontStyle: 'italic',
    opacity: 0.7,
    color: '#333333',
  },

  infoBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },

  infoText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
    color: '#1a1a1a',
  },
});

export default PhonemeGlobe;
