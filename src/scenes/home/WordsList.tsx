import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import useColorScheme from '@/hooks/useColorScheme';
import { tagsChanged, wordRemovalChanged } from '@/slices/learning.slice';
import { State } from '@/utils/store';
import { estimateRecall } from '@/utils/recall';
import { prepareDictionary } from '@/utils/dictionary';
import { getWordTags } from '@/utils/tags';
import { Word } from '@/utils/vocabulary';
import catalog from '@/data/vocabulary.json';
import { mergedVocabulary } from '@/utils/mergedVocabulary';

const styles = StyleSheet.create({
  list: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 32, gap: 16 },
  title: { fontSize: 29, fontWeight: '700', color: colors.ink },
  text: { fontSize: 16, lineHeight: 24, color: colors.ink },
  muted: { color: colors.mutedInk, fontSize: 14, lineHeight: 21 },
  input: {
    borderWidth: 1,
    borderColor: colors.gray,
    padding: 12,
    borderRadius: 12,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  button: { backgroundColor: colors.teal, borderRadius: 12, padding: 15, alignItems: 'center' },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  wordRow: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: colors.white,
    gap: 16,
    marginBottom: 16,
  },
  wordHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  info: { flex: 1, gap: 5 },
  word: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.ink },
  translation: { color: colors.mutedInk, fontSize: 16, lineHeight: 23 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    maxWidth: '100%',
    backgroundColor: colors.tealLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tagText: { color: colors.teal, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 4,
    columnGap: 16,
  },
  action: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 6 },
  actionText: { color: colors.teal, fontSize: 14, fontWeight: '600' },
  dangerText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  badge: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' },
  badgeText: { position: 'absolute', fontSize: 10, color: colors.ink, fontWeight: '700' },
  header: { gap: 16, marginBottom: 16 },
  container: { flex: 1 },
  topButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
});

export default function WordsList() {
  const dispatch = useDispatch();
  const { isDark } = useColorScheme();
  const { progress, customTags, language, userWords } = useSelector(
    (state: State) => state.learning,
  );
  const es = language === 'es';
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [sortBy, setSortBy] = useState<'alphabet' | 'knowledge'>('alphabet');
  const [ascending, setAscending] = useState(true);
  const [removed, setRemoved] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const words = useMemo(() => mergedVocabulary(catalog, userWords), [userWords]);
  const [now, setNow] = useState(() => new Date());
  const listRef = useRef<FlatList<Word>>(null);
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const visible = useMemo(
    () =>
      prepareDictionary(
        words,
        progress,
        customTags,
        deferredQuery,
        removed,
        sortBy,
        ascending,
        now,
        language,
      ),
    [words, progress, customTags, deferredQuery, removed, sortBy, ascending, now, language],
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
      const value = estimateRecall(progress[item.id], now);
      const circumference = 2 * Math.PI * 23;
      const rowMutedStyle = [styles.muted, isDark && { color: colors.darkMuted }];
      function remove() {
        Alert.alert(
          es ? '¿Quitar palabra?' : 'Remove word from practice?',
          es
            ? `“${item.hu}” dejará de aparecer en las prácticas. Puedes restaurarla desde Mis palabras.`
            : `“${item.hu}” will no longer appear in practice. You can restore it from My words.`,
          [
            { text: es ? 'Cancelar' : 'Cancel', style: 'cancel' },
            {
              text: es ? 'Quitar palabra' : 'Remove word',
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
                {es ? item.es : item.en}
              </Text>
            </View>
            <View
              style={styles.badge}
              accessible
              accessibilityLabel={
                value === null
                  ? es
                    ? 'Sin evaluar'
                    : 'Not assessed'
                  : `${value}% ${es ? 'recuerdo estimado' : 'estimated recall'}`
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
                {value === null ? '—' : `${value}%`}
              </Text>
            </View>
          </View>
          <View style={styles.tags} accessibilityLabel={es ? 'Etiquetas' : 'Tags'}>
            {getWordTags(item, customTags[item.id]).length ? (
              getWordTags(item, customTags[item.id]).map(tag => (
                <View
                  key={tag}
                  style={[styles.tag, isDark && { backgroundColor: colors.darkCanvas }]}>
                  <Text style={[styles.tagText, isDark && { color: colors.darkTeal }]}>{tag}</Text>
                </View>
              ))
            ) : (
              <Text style={rowMutedStyle}>{es ? 'Sin etiquetas' : 'No tags'}</Text>
            )}
          </View>
          {editing === item.id ? (
            <>
              <TextInput
                accessibilityLabel={
                  es ? 'Etiquetas separadas por comas' : 'Tags separated by commas'
                }
                style={[
                  styles.input,
                  isDark && { color: colors.white, backgroundColor: colors.darkSurface },
                ]}
                value={draft}
                onChangeText={setDraft}
              />
              {button(es ? 'Guardar etiquetas' : 'Save tags', () => {
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
              {button(es ? 'Cancelar' : 'Cancel', () => setEditing(null))}
            </>
          ) : (
            <View style={[styles.actions, isDark && { borderTopColor: colors.mutedInk }]}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.action}
                onPress={() => {
                  setDraft(getWordTags(item, customTags[item.id]).join(', '));
                  setEditing(item.id);
                }}>
                <Ionicons
                  name="pencil-outline"
                  size={16}
                  color={isDark ? colors.darkTeal : colors.teal}
                />
                <Text style={[styles.actionText, isDark && { color: colors.darkTeal }]}>
                  {es ? 'Editar etiquetas' : 'Edit tags'}
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
                  {removed
                    ? es
                      ? 'Restaurar'
                      : 'Restore'
                    : es
                      ? 'Quitar de práctica'
                      : 'Remove from practice'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    },
    [progress, now, isDark, es, customTags, editing, draft, removed, dispatch],
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
              Magyar · {es ? 'Palabras' : 'Words'}
            </Text>
            <Text style={textStyle}>
              {es
                ? 'Las traducciones provienen de tus apuntes y pueden contener errores.'
                : 'Translations come from your notes and may contain errors.'}
            </Text>
            <TextInput
              style={[
                styles.input,
                isDark && { color: colors.white, backgroundColor: colors.darkSurface },
              ]}
              placeholder={es ? 'Buscar palabras o etiquetas' : 'Search words or tags'}
              placeholderTextColor={colors.gray}
              value={query}
              onChangeText={setQuery}
            />
            <Text style={mutedStyle}>
              {es
                ? 'Busca palabras, traducciones o etiquetas'
                : 'Search words, translations or tags'}
            </Text>
            <View style={styles.row}>
              {button(
                sortBy === 'alphabet'
                  ? es
                    ? 'Orden: alfabético'
                    : 'Sort: alphabetically'
                  : es
                    ? 'Orden: conocimiento'
                    : 'Sort: knowledge',
                () => {
                  setNow(new Date());
                  setSortBy(sortBy === 'alphabet' ? 'knowledge' : 'alphabet');
                },
              )}
              {button(ascending ? '↑' : '↓', () => setAscending(!ascending))}
            </View>
            {button(
              removed ? (es ? 'Ver activas' : 'Show active') : es ? 'Ver quitadas' : 'Show removed',
              () => setRemoved(!removed),
            )}
          </View>
        }
        ListEmptyComponent={
          <Text style={textStyle}>{es ? 'No se encontraron palabras.' : 'No words found.'}</Text>
        }
      />
      {showTop && (
        <TouchableOpacity
          testID="scroll-to-top"
          accessibilityRole="button"
          accessibilityLabel={es ? 'Volver arriba' : 'Back to top'}
          style={styles.topButton}
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}>
          <Ionicons name="arrow-up" size={24} color={colors.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}
