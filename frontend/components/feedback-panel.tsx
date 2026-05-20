import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

interface LearnerExample {
  text: string;
  issue_description: string;
  correct_version: string;
}

interface PracticeSuggestion {
  module: string;
  activity: string;
  duration_minutes: number;
  notes: string;
}

interface IndicatorFeedback {
  indicator: string;
  learner_score: number;
  target_score: number;
  cefr_level: string;
  severity: string;
  diagnosis: string;
  learner_examples: LearnerExample[];
  test_specific_insight: string;
  strategy: string;
  timeline_weeks: number;
  practice_suggestions: PracticeSuggestion[];
  expected_improvement: string;
  markdown_output: string;
}

interface FeedbackPanelProps {
  feedback: IndicatorFeedback;
  expanded?: boolean;
}

export function FeedbackPanel({ feedback, expanded = false }: FeedbackPanelProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');

  const getSeverityStyles = (severity: string) => {
    if (severity.includes('CRITICAL') || severity.includes('🔴')) {
      return {
        background: '#fee2e2',
        border: '#dc2626',
        text: '#7f1d1d',
        badge: '🔴',
      };
    }
    if (severity.includes('HIGH') || severity.includes('🟡')) {
      return {
        background: '#fef3c7',
        border: '#f59e0b',
        text: '#92400e',
        badge: '🟡',
      };
    }
    return {
      background: '#d1fae5',
      border: '#10b981',
      text: '#065f46',
      badge: '🟢',
    };
  };

  const severityStyles = getSeverityStyles(feedback.severity);

  return (
    <View
      style={[
        styles.container,
        {
          borderLeftColor: severityStyles.border,
          borderLeftWidth: 4,
        },
      ]}
    >
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View style={styles.headerContent}>
          <Text style={[styles.badge, { color: severityStyles.text }]}>
            {severityStyles.badge} {feedback.indicator}
          </Text>
          <View style={styles.scoreContainer}>
            <Text style={[styles.scoreLabel, { color: textColor }]}>
              {feedback.learner_score.toFixed(2)} / {feedback.target_score.toFixed(2)}
            </Text>
            <View style={styles.scoreBar}>
              <View
                style={[
                  styles.scoreFill,
                  {
                    width: `${(feedback.learner_score / feedback.target_score) * 100}%`,
                    backgroundColor: severityStyles.border,
                  },
                ]}
              />
            </View>
          </View>
        </View>
        <Text style={styles.expandIcon}>{isExpanded ? '−' : '+'}</Text>
      </TouchableOpacity>

      {/* Expanded Content */}
      {isExpanded && (
        <ScrollView style={styles.expandedContent} scrollEnabled={false}>
          {/* Severity Badge */}
          <View
            style={[
              styles.severityBadge,
              { backgroundColor: severityStyles.background },
            ]}
          >
            <Text style={[styles.severity, { color: severityStyles.text }]}>
              {feedback.severity}
            </Text>
          </View>

          {/* Diagnosis */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Diagnosis</Text>
            <Text style={[styles.sectionContent, { color: textColor }]}>
              {feedback.diagnosis}
            </Text>
          </View>

          {/* Learner Examples */}
          {feedback.learner_examples.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                Examples from Your Work
              </Text>
              {feedback.learner_examples.map((example, idx) => (
                <View key={idx} style={styles.example}>
                  <View style={styles.exampleRow}>
                    <Text style={styles.exampleLabel}>Your text:</Text>
                    <Text style={[styles.exampleText, styles.incorrect]}>
                      "{example.text}"
                    </Text>
                  </View>
                  <Text style={[styles.exampleNote, { color: textColor }]}>
                    Issue: {example.issue_description}
                  </Text>
                  <View style={styles.exampleRow}>
                    <Text style={styles.exampleLabel}>Correct:</Text>
                    <Text style={[styles.exampleText, styles.correct]}>
                      "{example.correct_version}"
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Test-Specific Insight */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              {feedback.cefr_level} Level - {feedback.indicator} Requirement
            </Text>
            <View style={[styles.insight, { borderLeftColor: tintColor }]}>
              <Text style={[styles.insightText, { color: textColor }]}>
                {feedback.test_specific_insight}
              </Text>
            </View>
          </View>

          {/* Strategy */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Improvement Strategy ({feedback.timeline_weeks} weeks)
            </Text>
            <Text style={[styles.sectionContent, { color: textColor }]}>
              {feedback.strategy}
            </Text>
            <Text
              style={[
                styles.expectedImprovement,
                { color: severityStyles.border, marginTop: 8 },
              ]}
            >
              Expected: {feedback.expected_improvement}
            </Text>
          </View>

          {/* Practice Suggestions */}
          {feedback.practice_suggestions.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                Recommended Exercises
              </Text>
              {feedback.practice_suggestions.map((suggestion, idx) => (
                <View key={idx} style={[styles.suggestion, { borderLeftColor: tintColor }]}>
                  <View style={styles.suggestionHeader}>
                    <Text style={[styles.suggestionModule, { color: tintColor }]}>
                      {suggestion.module}
                    </Text>
                    <Text style={styles.suggestionTime}>
                      {suggestion.duration_minutes} min
                    </Text>
                  </View>
                  <Text style={[styles.suggestionActivity, { color: textColor }]}>
                    {suggestion.activity}
                  </Text>
                  {suggestion.notes && (
                    <Text style={[styles.suggestionNote, { color: textColor }]}>
                      {suggestion.notes}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Full Markdown Output */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.downloadButton, { borderColor: tintColor }]}
            >
              <Text style={[styles.downloadText, { color: tintColor }]}>
                📄 Full Report (Markdown)
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  headerContent: {
    flex: 1,
    gap: 8,
  },
  badge: {
    fontSize: 16,
    fontWeight: '700',
  },
  scoreContainer: {
    gap: 6,
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  scoreBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
  },
  expandIcon: {
    fontSize: 24,
    fontWeight: '300',
    color: '#9ca3af',
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    maxHeight: 2000, // Prevent infinite scroll
  },
  severityBadge: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  severity: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    fontSize: 13,
    lineHeight: 20,
  },
  example: {
    backgroundColor: '#f9fafb',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  exampleRow: {
    marginBottom: 6,
  },
  exampleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 3,
  },
  exampleText: {
    fontSize: 13,
    lineHeight: 18,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  incorrect: {
    backgroundColor: '#fee2e2',
    color: '#7f1d1d',
    fontStyle: 'italic',
  },
  correct: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    fontWeight: '500',
  },
  exampleNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginVertical: 4,
  },
  insight: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 3,
    borderRadius: 6,
  },
  insightText: {
    fontSize: 13,
    lineHeight: 20,
  },
  expectedImprovement: {
    fontSize: 14,
    fontWeight: '700',
  },
  suggestion: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderLeftWidth: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  suggestionModule: {
    fontSize: 13,
    fontWeight: '700',
  },
  suggestionTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  suggestionActivity: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  suggestionNote: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#6b7280',
  },
  downloadButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  downloadText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
