import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ModuleRecommendationCard } from './module-recommendation-card';
import { FeedbackPanel } from './feedback-panel';

interface AssessmentIndicators {
  mtld: number;
  awl_percent: number;
  mls: number;
  mlt: number;
  mlc: number;
  wcr: number;
  pronunciation: number;
  fluency_wpm: number;
  micro_fluency: number;
  coherence: number;
}

interface AssessmentDashboardProps {
  userId: string;
  indicators: AssessmentIndicators;
  cefrLevel: 'A2' | 'B1' | 'B2' | 'C1';
  targetTest: 'IELTS' | 'TOEFL_IBT' | 'Cambridge_CAE' | 'Cambridge_CPE' | 'APTIS';
  domain?: 'narration' | 'description' | 'argumentation' | 'conversation' | 'academic' | 'technical';
  apiBaseUrl?: string;
}

export function AssessmentDashboard({
  userId,
  indicators,
  cefrLevel,
  targetTest,
  domain = 'description',
  apiBaseUrl = 'http://localhost:8000',
}: AssessmentDashboardProps) {
  const [recommendations, setRecommendations] = useState<any>(null);
  const [feedback, setFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'modules' | 'feedback'>('modules');

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    fetchAssessmentData();
  }, [userId, indicators, cefrLevel, targetTest, domain]);

  const fetchAssessmentData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const headers = {
        'Content-Type': 'application/json',
        'user-id': userId,
      };

      // Fetch recommendations
      const recRes = await fetch(`${apiBaseUrl}/assessment/recommend`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mtld: indicators.mtld,
          awl_percent: indicators.awl_percent,
          mls: indicators.mls,
          mlt: indicators.mlt,
          mlc: indicators.mlc,
          wcr: indicators.wcr,
          pronunciation: indicators.pronunciation,
          fluency_wpm: indicators.fluency_wpm,
          micro_fluency: indicators.micro_fluency,
          coherence: indicators.coherence,
          cefr_level: cefrLevel,
          target_test: targetTest,
          domain: domain,  // NEW: add domain parameter
          limit: 5,
        }),
      });

      if (!recRes.ok) throw new Error('Failed to fetch recommendations');
      const recData = await recRes.json();
      setRecommendations(recData);

      // Fetch feedback
      const fbRes = await fetch(`${apiBaseUrl}/assessment/feedback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mtld: indicators.mtld,
          awl_percent: indicators.awl_percent,
          mls: indicators.mls,
          mlt: indicators.mlt,
          mlc: indicators.mlc,
          wcr: indicators.wcr,
          pronunciation: indicators.pronunciation,
          fluency_wpm: indicators.fluency_wpm,
          micro_fluency: indicators.micro_fluency,
          coherence: indicators.coherence,
          cefr_level: cefrLevel,
          target_test: targetTest,
          domain: domain,  // NEW: add domain parameter
        }),
      });

      if (!fbRes.ok) throw new Error('Failed to fetch feedback');
      const fbData = await fbRes.json();
      setFeedback(fbData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      Alert.alert('Error', 'Failed to load assessment data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
        <Text style={[styles.loadingText, { color: textColor }]}>
          Analyzing your assessment...
        </Text>
      </View>
    );
  }

  if (error || !recommendations || !feedback) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <Text style={[styles.errorText, { color: textColor }]}>
          {error || 'Failed to load assessment data'}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { borderColor: tintColor }]}
          onPress={fetchAssessmentData}
        >
          <Text style={[styles.retryText, { color: tintColor }]}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>Your Assessment</Text>
        <Text style={[styles.subtitle, { color: textColor }]}>
          {cefrLevel} • {targetTest}
        </Text>
      </View>

      {/* Summary Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Recommendations</Text>
          <Text style={[styles.statValue, { color: tintColor }]}>
            {recommendations.recommendations.length}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Critical Gaps</Text>
          <Text style={[styles.statValue, { color: '#ef4444' }]}>
            {recommendations.critical_gaps.length}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Study Time</Text>
          <Text style={[styles.statValue, { color: tintColor }]}>
            {recommendations.recommendations
              .reduce((sum: number, r: any) => sum + r.estimated_hours, 0)
              .toFixed(0)}h
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'modules' && [styles.tabActive, { borderBottomColor: tintColor }],
          ]}
          onPress={() => setActiveTab('modules')}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'modules' && { color: tintColor, fontWeight: '700' },
            ]}
          >
            Modules ({recommendations.recommendations.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'feedback' && [styles.tabActive, { borderBottomColor: tintColor }],
          ]}
          onPress={() => setActiveTab('feedback')}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'feedback' && { color: tintColor, fontWeight: '700' },
            ]}
          >
            Feedback (5)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'modules' ? (
          <View>
            {/* Critical Gaps Warning */}
            {recommendations.critical_gaps.length > 0 && (
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>Areas Needing Immediate Focus:</Text>
                {recommendations.critical_gaps.slice(0, 3).map((gap: any, idx: number) => (
                  <Text key={idx} style={styles.warningItem}>
                    • {gap.indicator}: {(gap.severity * 100).toFixed(0)}% severity
                  </Text>
                ))}
              </View>
            )}

            {/* Recommended Modules */}
            {recommendations.recommendations.map((module: any, idx: number) => (
              <ModuleRecommendationCard
                key={idx}
                module={module}
                onSelect={(mod) => {
                  Alert.alert(
                    `${mod.module_name}`,
                    `Ready to start this ${mod.estimated_hours}h module?\n\nYou'll focus on: ${mod.target_indicators.join(', ')}`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Start Now',
                        onPress: () => {
                          // Navigate to module or trigger start action
                          Alert.alert('Starting', `${mod.module_name} module started!`);
                        },
                      },
                    ]
                  );
                }}
              />
            ))}
          </View>
        ) : (
          <View>
            {/* Feedback Panels */}
            {Object.entries(feedback.feedback_by_indicator).map(([indicator, fb]: [string, any]) => (
              <FeedbackPanel key={indicator} feedback={fb} expanded={false} />
            ))}

            {/* Overall Diagnosis */}
            <View style={styles.diagnosisBox}>
              <Text style={[styles.diagnosisTitle, { color: textColor }]}>
                Overall Diagnosis
              </Text>
              <Text style={[styles.diagnosisText, { color: textColor }]}>
                {feedback.overall_diagnosis}
              </Text>
              <Text style={[styles.diagnosisSubtitle, { color: textColor }]}>
                Focus on these indicators first:
              </Text>
              {feedback.priority_order.map((indicator: string, idx: number) => (
                <Text key={idx} style={[styles.priorityItem, { color: textColor }]}>
                  {idx + 1}. {indicator}
                </Text>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={fetchAssessmentData}
        >
          <Text style={styles.secondaryButtonText}>Refresh</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: tintColor }]}
          onPress={() => {
            Alert.alert('Export', 'Download your full assessment report?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Download', onPress: () => {} },
            ]);
          }}
        >
          <Text style={styles.primaryButtonText}>Export Report</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 16,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomWidth: 3,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  warningBox: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 8,
  },
  warningItem: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
    marginBottom: 4,
  },
  diagnosisBox: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 4,
    borderLeftColor: '#0284c7',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  diagnosisTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  diagnosisText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  diagnosisSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  priorityItem: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
  },
});
