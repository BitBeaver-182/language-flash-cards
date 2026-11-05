import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import useColorScheme from '@/hooks/useColorScheme';
import { State } from '@/utils/store';
import { tagsChanged, wordRemovalChanged } from '@/slices/learning.slice';
import { colors } from '@/theme';
import { prepareDictionary } from '@/utils/dictionary';
import { recentAccuracy } from '@/utils/recall';
import { getWordTags } from '@/utils/tags';
import { Word, getWordMeaning } from '@/utils/vocabulary';

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 12 },
  header: { gap: 12, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  text: { fontSize: 15, color: colors.ink, lineHeight: 20 },
  muted: { fontSize: 13, color: colors.mutedInk },
  input: {
    borderWidth: 1,
    borderColor: colors.gray,
    padding: 12,
    borderRadius: 12,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  row: { flexDirection: 'row', gap: 8 },
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  wordRow: { padding: 16, borderRadius: 14, backgroundColor: colors.white, gap: 12 },
  wordHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  info: { flex: 1, gap: 4 },
  word: { fontSize: 19, fontWeight: '700', color: colors.ink },
  translation: { fontSize: 15, color: colors.mutedInk },
  badge: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' },
  badgeText: { position: 'absolute', fontSize: 10, color: colors.ink, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: colors.canvas,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: { fontSize: 12, color: colors.teal, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: colors.canvas,
    paddingTop: 8,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, color: colors.teal, fontWeight: '600' },
  dangerText: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  topButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
});

export default function WordsList() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { isDark } = useColorScheme();
  const { progress, language, words: userWords } = useSelector((state: State) => state.learning);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [sortBy, setSortBy] = useState<'alphabet' | 'knowledge'>('alphabet');
  const [ascending, setAscending] = useState(true);
  const [removed, setRemoved] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const words = useMemo(() => Object.values(userWords), [userWords]);
  const [now, setNow] = useState(() => new Date());
  const listRef = useRef<FlatList<Word>>(null);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const visible = useMemo(
    () =>
      prepareDictionary(words, progress, deferredQuery, removed, sortBy, ascending, now, language),
    [words, progress, deferredQuery, removed, sortBy, ascending, now, language],
  );

  const textStyle = [styles.text, isDark && { color: colors.white }];
  const mutedStyle = [styles.muted, isDark && { color: colors.darkMuted }];
  const button = (label: string, onPress: () => void) => (
    <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );

  const renderItem = useCallback(
    ({ item }: { item: Word }) => {
      const accuracy = recentAccuracy(progress[item.id]);
      const value = accuracy?.percent ?? null;
      const circumference = 2 * Math.PI * 23;
      const rowMutedStyle = [styles.muted, isDark && { color: colors.darkMuted }];

      function remove() {
        Alert.alert(
          t('dictionary.removeConfirmTitle'),
          t('dictionary.removeConfirmMessage', { word: item.hu }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('dictionary.remove'),
              style: 'destructive',
              onPress: () => dispatch(wordRemovalChanged({ wordId: item.id, removed: true })),
            },
          ],
        );
      }

      return (
        <View style={[styles.wordRow, isDark && { backgroundColor: colors.darkSurface }]}>
          <View style={styles.wordHeader}>
            <View style={styles.info}>
              <Text style={[styles.word, isDark && { color: colors.white }]}>{item.hu}</Text>
              <Text style={[styles.translation, isDark && { color: colors.darkMuted }]}>
                {getWordMeaning(item, language)}
              </Text>
            </View>
            <View
              style={styles.badge}
              accessible
              accessibilityLabel={
                value === null
                  ? t('practice.notAssessed')
                  : `${value}% ${t('practice.recentAccuracy')} ${accuracy?.correct}/${accuracy?.total}`
              }>
              <Svg width={54} height={54} viewBox="0 0 54 54">
                <Circle
                  cx={27}
                  cy={27}
                  r={23}
                  stroke={isDark ? colors.mutedInk : colors.border}
                  strokeWidth={4}
                  fill="none"
                />
                {value !== null && (
                  <Circle
                    cx={27}
                    cy={27}
                    r={23}
                    stroke={colors.teal}
                    strokeWidth={4}
                    fill="none"
                    strokeDasharray={`${(circumference * value) / 100} ${circumference}`}
                    strokeLinecap="round"
                    rotation={-90}
                    origin="27, 27"
                  />
                )}
              </Svg>
              <Text style={[styles.badgeText, isDark && { color: colors.white }]}>
                {value === null ? '—' : `${value}%\n${accuracy?.correct}/${accuracy?.total}`}
              </Text>
            </View>
          </View>
          <View style={styles.tags} accessibilityLabel={t('dictionary.tags')}>
            {getWordTags(item).length ? (
              getWordTags(item).map(tag => (
                <View
                  key={tag}
                  style={[styles.tag, isDark && { backgroundColor: colors.darkCanvas }]}>
                  <Text style={[styles.tagText, isDark && { color: colors.darkTeal }]}>{tag}</Text>
                </View>
              ))
            ) : (
              <Text style={rowMutedStyle}>{t('dictionary.noTags')}</Text>
            )}
          </View>
          {editing === item.id ? (
            <>
              <TextInput
                accessibilityLabel={t('vocabulary.tagsLabel')}
                style={[
                  styles.input,
                  isDark && { color: colors.white, backgroundColor: colors.darkSurface },
                ]}
                value={draft}
                onChangeText={setDraft}
              />
              {button(t('dictionary.saveTags'), () => {
                dispatch(
                  tagsChanged({
                    wordId: item.id,
                    tags: Array.from(
                      new Set(
                        draft
                          .split(',')
                          .map(tag => tag.trim())
                          .filter(Boolean),
                      ),
                    ),
                  }),
                );
                setEditing(null);
              })}
              {button(t('common.cancel'), () => setEditing(null))}
            </>
          ) : (
            <View style={[styles.actions, isDark && { borderTopColor: colors.mutedInk }]}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.action}
                onPress={() => {
                  setDraft(getWordTags(item).join(', '));
                  setEditing(item.id);
                }}>
                <Ionicons
                  name="pencil-outline"
                  size={16}
                  color={isDark ? colors.darkTeal : colors.teal}
                />
                <Text style={[styles.actionText, isDark && { color: colors.darkTeal }]}>
                  {t('dictionary.editTags')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.action}
                onPress={() =>
                  removed
                    ? dispatch(wordRemovalChanged({ wordId: item.id, removed: false }))
                    : remove()
                }>
                <Ionicons
                  name={removed ? 'arrow-undo-outline' : 'remove-circle-outline'}
                  size={16}
                  color={
                    removed
                      ? isDark
                        ? colors.darkTeal
                        : colors.teal
                      : isDark
                        ? colors.darkDanger
                        : colors.danger
                  }
                />
                <Text
                  style={[
                    styles.dangerText,
                    isDark && { color: colors.darkDanger },
                    removed && { color: isDark ? colors.darkTeal : colors.teal },
                  ]}>
                  {removed ? t('dictionary.restore') : t('practice.removeFromPractice')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    },
    [progress, isDark, language, editing, draft, removed, dispatch, t],
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        testID="dictionary-list"
        data={visible}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        onScroll={event => setShowTop(event.nativeEvent.contentOffset.y > 500)}
        scrollEventThrottle={64}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, isDark && { color: colors.white }]}>
              Magyar · {t('vocabulary.title')}
            </Text>
            <Text style={textStyle}>{t('dictionary.translationsHint')}</Text>
            <TextInput
              style={[
                styles.input,
                isDark && { color: colors.white, backgroundColor: colors.darkSurface },
              ]}
              placeholder={t('dictionary.searchPlaceholder')}
              placeholderTextColor={colors.gray}
              value={query}
              onChangeText={setQuery}
            />
            <Text style={mutedStyle}>{t('dictionary.searchHint')}</Text>
            <View style={styles.row}>
              {button(
                sortBy === 'alphabet'
                  ? t('dictionary.sortAlphabet')
                  : t('dictionary.sortKnowledge'),
                () => {
                  setNow(new Date());
                  setSortBy(sortBy === 'alphabet' ? 'knowledge' : 'alphabet');
                },
              )}
              {button(ascending ? '↑' : '↓', () => setAscending(!ascending))}
            </View>
            {button(removed ? t('dictionary.showActive') : t('dictionary.showRemoved'), () =>
              setRemoved(!removed),
            )}
          </View>
        }
        ListEmptyComponent={<Text style={textStyle}>{t('dictionary.empty')}</Text>}
      />
      {showTop && (
        <TouchableOpacity
          testID="scroll-to-top"
          accessibilityRole="button"
          accessibilityLabel={t('dictionary.backToTop')}
          style={styles.topButton}
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}>
          <Ionicons name="arrow-up" size={24} color={colors.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}
