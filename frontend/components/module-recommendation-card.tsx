import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

interface ModuleRecommendation {
  rank: number;
  module_name: string;
  severity_score: number;
  target_indicators: string[];
  estimated_hours: number;
  expected_improvement: Record<string, number>;
  rationale: string;
  priority_level: string;
}

interface ModuleRecommendationCardProps {
  module: ModuleRecommendation;
  onSelect?: (module: ModuleRecommendation) => void;
}

export function ModuleRecommendationCard({ module, onSelect }: ModuleRecommendationCardProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  
  // Color coding by priority
  const getPriorityColor = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return '#ef4444'; // red-500
      case 'HIGH':
        return '#f97316'; // orange-500
      case 'MEDIUM':
        return '#eab308'; // yellow-500
      default:
        return '#22c55e'; // green-500
    }
  };
  
  const getPriorityEmoji = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return '';
      case 'HIGH':
        return '';
      case 'MEDIUM':
        return '';
      default:
        return '';
    }
  };
  
  const priorityColor = getPriorityColor(module.priority_level);
  const priorityEmoji = getPriorityEmoji(module.priority_level);

  return (
    <TouchableOpacity 
      style={[styles.card, { borderLeftColor: priorityColor }]}
      onPress={() => onSelect?.(module)}
    >
      <View style={styles.header}>
        <View style={styles.rankBadge}>
          <Text style={styles.rank}>#{module.rank}</Text>
        </View>
        <Text style={[styles.moduleName, { color: textColor }]}>
          {module.module_name}
        </Text>
        <Text style={styles.priorityBadge}>
          {priorityEmoji} {module.priority_level}
        </Text>
      </View>

      <View style={styles.severityContainer}>
        <Text style={styles.label}>Severity Score:</Text>
        <View style={styles.severityBar}>
          <View
            style={[
              styles.severityFill,
              {
                width: `${module.severity_score * 100}%`,
                backgroundColor: priorityColor,
              },
            ]}
          />
        </View>
        <Text style={styles.severityText}>
          {(module.severity_score * 100).toFixed(0)}%
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.label, { color: textColor }]}>Target Indicators:</Text>
        <View style={styles.indicatorsList}>
          {module.target_indicators.map((indicator, idx) => (
            <View key={idx} style={styles.indicatorTag}>
              <Text style={styles.indicatorText}>{indicator}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.label, { color: textColor, marginTop: 12 }]}>
          Time Estimate: {module.estimated_hours}h
        </Text>

        <Text style={[styles.label, { color: textColor, marginTop: 12 }]}>
          Why This Module:
        </Text>
        <Text style={[styles.rationale, { color: textColor }]}>
          {module.rationale}
        </Text>

        <View style={styles.improvementContainer}>
          <Text style={[styles.label, { color: textColor }]}>Expected Improvement:</Text>
          {Object.entries(module.expected_improvement).map(([indicator, improvement]) => (
            <Text key={indicator} style={[styles.improvement, { color: textColor }]}>
              • {indicator}: {(improvement * 100).toFixed(0)}% gain
            </Text>
          ))}
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.startButton, { backgroundColor: priorityColor }]}
        onPress={() => onSelect?.(module)}
      >
        <Text style={styles.buttonText}>Start Module →</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  rankBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
  },
  moduleName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  priorityBadge: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  severityContainer: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  severityBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  severityFill: {
    height: '100%',
    borderRadius: 4,
  },
  severityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  content: {
    marginBottom: 12,
  },
  indicatorsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  indicatorTag: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  indicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4f46e5',
  },
  rationale: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  improvementContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
  },
  improvement: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  startButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
