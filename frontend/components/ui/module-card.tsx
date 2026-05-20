import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

interface ModuleCardProps {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: ImageSourcePropType;
  tag: string;
  accent: string;
  gradient: [string, string];
  onPress: () => void;
  style?: ViewStyle;
}

const ModuleCard: React.FC<ModuleCardProps> = ({
  title,
  subtitle,
  description,
  image,
  tag,
  accent,
  gradient,
  onPress,
  style,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.container, style]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBg}
      >
        {/* Accent Line */}
        <View style={[styles.accentLine, { backgroundColor: accent }]} />

        {/* Content */}
        <View style={styles.content}>
          {/* Left Side - Text */}
          <View style={styles.textSection}>
            {/* Tag */}
            <View style={[styles.tag, { backgroundColor: accent + '22' }]}>
              <Text style={[styles.tagText, { color: accent }]}>{tag}</Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Subtitle */}
            <Text style={styles.subtitle}>{subtitle}</Text>

            {/* Description */}
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>

            {/* CTA */}
            <View style={styles.ctaRow}>
              <Text style={styles.ctaText}>Explore Now</Text>
              <Text style={styles.ctaArrow}>→</Text>
            </View>
          </View>

          {/* Right Side - Image */}
          <View style={[styles.imageWrapper, { backgroundColor: accent + '15' }]}>
            <Image source={image} style={styles.image} resizeMode="contain" />
          </View>
        </View>

        {/* Overlay Effect */}
        <View style={[styles.overlay, { backgroundColor: accent + '08' }]} />
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.md,
    marginHorizontal: 0,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  gradientBg: {
    padding: Spacing.lg,
    minHeight: 200,
    justifyContent: 'space-between',
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: Spacing.sm,
  },
  textSection: {
    flex: 1,
    marginRight: Spacing.lg,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    opacity: 0.9,
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: 13,
    fontWeight: '400',
    color: '#ffffff',
    opacity: 0.8,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  ctaArrow: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: Spacing.xs,
  },
  imageWrapper: {
    width: 100,
    height: 140,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BorderRadius.lg,
  },
});

export default ModuleCard;
