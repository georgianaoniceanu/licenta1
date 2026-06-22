/**
 * SavedSessions — a reusable "previously practised" list for a module.
 *
 * Reads an array of session objects from an AsyncStorage key, renders them as
 * tappable cards (label + score + date). Tapping a card expands an inline,
 * module-specific detail panel (provided via `renderDetail`).
 *
 * Used by Accent DNA, Vocabulary and Shadow so each demo user opens a module
 * already showing the words/phrases they practised, with results on tap.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

type Props<T> = {
  storageKey: string;
  title: string;
  accent: string;
  getLabel: (s: T) => string;
  getScore: (s: T) => number | undefined;
  getTs?: (s: T) => number | undefined;
  getMeta?: (s: T) => string | undefined;   // small line under the label
  renderDetail?: (s: T) => React.ReactNode;  // inline expand (default behaviour)
  onPress?: (s: T) => void;                  // if set, tapping opens this instead of expanding
  emptyHint?: string;
  maxInitial?: number;
};

function scoreColor(v: number) {
  if (v >= 80) return '#22c55e';
  if (v >= 60) return '#f59e0b';
  return '#f87171';
}

function timeAgo(ts?: number) {
  if (!ts) return '';
  const d = Math.floor((Date.now() - ts) / 86_400_000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export default function SavedSessions<T>({
  storageKey, title, accent,
  getLabel, getScore, getTs, getMeta, renderDetail, onPress,
  emptyHint, maxInitial = 4,
}: Props<T>) {
  const [sessions, setSessions] = useState<T[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const arr = raw ? JSON.parse(raw) : [];
      setSessions(Array.isArray(arr) ? arr : []);
    } catch {
      setSessions([]);
    }
    setOpen(null);
  }, [storageKey]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (sessions.length === 0) {
    if (!emptyHint) return null;
    return (
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: accent }]}>{title}</Text>
        <Text style={styles.empty}>{emptyHint}</Text>
      </View>
    );
  }

  const visible = showAll ? sessions : sessions.slice(0, maxInitial);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: accent }]}>{title}</Text>
        <View style={[styles.countPill, { backgroundColor: accent + '18' }]}>
          <Text style={[styles.countText, { color: accent }]}>{sessions.length}</Text>
        </View>
      </View>

      {visible.map((s, i) => {
        const score = getScore(s);
        const isOpen = open === i;
        const sc = typeof score === 'number' ? score : undefined;
        const col = sc !== undefined ? scoreColor(sc) : Colors.light.textSecondary;
        const meta = getMeta?.(s);
        return (
          <View key={i} style={[styles.card, isOpen && { borderColor: accent }]}>
            <TouchableOpacity
              style={styles.cardHead}
              activeOpacity={0.7}
              onPress={() => (onPress ? onPress(s) : setOpen(isOpen ? null : i))}
            >
              {sc !== undefined && (
                <View style={[styles.scoreBubble, { borderColor: col, backgroundColor: col + '15' }]}>
                  <Text style={[styles.scoreBubbleText, { color: col }]}>{sc}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel} numberOfLines={isOpen ? undefined : 1}>
                  {getLabel(s)}
                </Text>
                <View style={styles.metaRow}>
                  {!!meta && <Text style={styles.metaText}>{meta}</Text>}
                  {!!getTs && <Text style={styles.dateText}>{timeAgo(getTs(s))}</Text>}
                </View>
              </View>
              <Feather
                name={onPress ? 'chevron-right' : isOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={Colors.light.textSecondary}
              />
            </TouchableOpacity>

            {!onPress && isOpen && renderDetail && <View style={styles.detail}>{renderDetail(s)}</View>}
          </View>
        );
      })}

      {sessions.length > maxInitial && (
        <TouchableOpacity onPress={() => setShowAll(v => !v)} style={styles.moreBtn} activeOpacity={0.7}>
          <Text style={[styles.moreText, { color: accent }]}>
            {showAll ? 'Show less' : `Show all ${sessions.length}`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 20, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  countPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  countText: { fontSize: 11, fontWeight: '800' },
  empty: { color: Colors.light.textSecondary, fontSize: 12, fontStyle: 'italic' },

  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  scoreBubble: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreBubbleText: { fontSize: 13, fontWeight: '800' },
  cardLabel: { color: Colors.light.text, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  metaText: { color: Colors.light.textSecondary, fontSize: 11, fontWeight: '600' },
  dateText: { color: Colors.light.textLight ?? Colors.light.textSecondary, fontSize: 11 },

  detail: {
    borderTopWidth: 1, borderTopColor: Colors.light.border,
    padding: 12, gap: 10, backgroundColor: Colors.light.background,
  },

  moreBtn: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 16 },
  moreText: { fontSize: 12, fontWeight: '700' },
});
