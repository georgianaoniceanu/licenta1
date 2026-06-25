import { View, Text, Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Small, consistent section marker: a vivid-purple rounded square holding a
 * compact illustration, next to the section title. Used for every section
 * except the top one (which uses SectionHero). Keeps the page calm — no large
 * illustrations floating in the middle of content.
 */
export function SectionHeader({
  art,
  title,
}: {
  art: ImageSourcePropType;
  title: string;
  /** Deprecated — kept for call-site compatibility; the marker is fixed-size. */
  size?: number;
}) {
  return (
    <View style={s.head}>
      <Image source={art} resizeMode="contain" style={s.icon} />
      <Text style={s.title}>{title}</Text>
    </View>
  );
}

/**
 * Big hero header for the first/most important section of a screen: a purple
 * gradient card with a large illustration on the left and a title + subtitle.
 */
export function SectionHero({
  art,
  title,
  subtitle,
}: {
  art: ImageSourcePropType;
  title: string;
  subtitle?: string;
}) {
  return (
    <LinearGradient
      colors={['#8B5CF6', '#6D28D9']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.hero}
    >
      <View style={s.heroIconWrap}>
        <Image source={art} resizeMode="contain" style={s.heroArt} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.heroTitle}>{title}</Text>
        {!!subtitle && <Text style={s.heroSub}>{subtitle}</Text>}
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  // Small consistent marker
  head: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 30, marginBottom: 14 },
  icon: {
    width: 160, height: 160,
    backgroundColor: 'rgba(139,92,246,0.6)',
    borderTopLeftRadius: 80, borderBottomRightRadius: 80,
    borderTopRightRadius: 32, borderBottomLeftRadius: 32,
  },
  title: {
    flex: 1, fontSize: 30, color: '#F0F6FF',
    fontFamily: 'Fredoka_700Bold', letterSpacing: 0.3,
  },

  // Hero
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 18,
    borderRadius: 24, padding: 22, marginTop: 8, marginBottom: 20,
  },
  heroIconWrap: {
    width: 156, height: 156, borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  heroArt: { width: 124, height: 124 },
  heroTitle: {
    fontSize: 25, color: '#FFFFFF',
    fontFamily: 'Fredoka_700Bold', letterSpacing: 0.3,
  },
  heroSub: {
    fontSize: 17, color: '#FFFFFF', marginTop: 6, lineHeight: 24,
    fontFamily: 'Fredoka_600SemiBold', letterSpacing: 0.4,
  },
});
