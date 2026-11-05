import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Ionicons } from '@expo/vector-icons';
import useColorScheme from '@/hooks/useColorScheme';
import { DataPersistKeys, useDataPersist } from '@/hooks/useDataPersist';
import { State } from '@/utils/store';
import {
  backupRestored,
  LEARNING_STATE_VERSION,
  vocabularyImported,
} from '@/slices/learning.slice';
import { exportVocabularyCsv, importVocabularyCsv } from '@/utils/vocabularyCsv';
import {
  BackupError,
  exportVocabularyFileAsync,
  pickVocabularyFileAsync,
  exportBackupFileAsync,
  pickBackupFileAsync,
  parseBackupPackage,
} from '@/services';
import { colors } from '@/theme';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { getWordTags } from '@/utils/tags';
import { Word } from '@/utils/vocabulary';
import { createWordId, normalizeWordKey } from '@/utils/vocabularyModel';

const isIos = Platform.OS === 'ios';

const LANGUAGE_TEST_IDS: Record<string, string> = {
  en: 'english',
  es: 'spanish',
  sk: 'slovak',
};

const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { fontSize: 18, fontWeight: '700' },
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 13, color: colors.mutedInk, lineHeight: 18 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  content: { padding: 20, gap: 12 },
  label: { fontSize: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.gray,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  primary: {
    backgroundColor: colors.teal,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  cancel: { padding: 12, alignItems: 'center' },
  cancelText: { color: colors.teal, fontSize: 15, fontWeight: '600' },
  choices: { gap: 8 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { borderColor: colors.teal, backgroundColor: colors.canvas },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.teal,
    backgroundColor: colors.canvas,
  },
});

function languageName(code: string, key: 'label' | 'nativeName' = 'nativeName'): string {
  return SUPPORTED_LANGUAGES.find(language => language.code === code)?.[key] ?? code.toUpperCase();
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

function backupErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof BackupError) return t(`backup.errors.${error.code}`);
  return t('backup.restoreFailed');
}

export default function VocabularyManagement() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { isDark } = useColorScheme();
  const persistence = useDataPersist();
  const learning = useSelector((state: State) => state.learning);
  const { progress, words: userWords } = learning;
  const words = useMemo(() => Object.values(userWords), [userWords]);
  const languageCodes = useMemo(() => {
    const codes = new Set<string>(SUPPORTED_LANGUAGES.map(language => language.code));
    for (const word of words) {
      if (word.en) codes.add('en');
      if (word.es) codes.add('es');
      for (const code of Object.keys(word.translations ?? {})) codes.add(code);
    }
    return Array.from(codes);
  }, [words]);
  const [visible, setVisible] = useState(false);
  const [hu, setHu] = useState('');
  const [meanings, setMeanings] = useState<Record<string, string>>({});
  const [tags, setTags] = useState('');
  const [match, setMatch] = useState<Word | null>(null);
  const [step, setStep] = useState(0);
  const [mergeLanguages, setMergeLanguages] = useState<string[]>([]);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [mergeTags, setMergeTags] = useState<string[]>([]);
  const [customMeaning, setCustomMeaning] = useState('');
  const textColor = isDark ? colors.white : colors.ink;
  const tagStep = mergeLanguages.length + 1;
  const reviewLanguage = step > 0 && step <= mergeLanguages.length ? mergeLanguages[step - 1] : '';

  function close() {
    setVisible(false);
    setHu('');
    setMeanings({});
    setTags('');
    setMatch(null);
    setStep(0);
    setMergeLanguages([]);
    setSelections({});
    setOptions({});
    setCustomMeaning('');
  }

  function existingMeaning(word: Word, code: string): string {
    return (
      word.translations?.[code] ?? (code === 'en' ? word.en : code === 'es' ? word.es : '') ?? ''
    );
  }

  function save() {
    const huValue = hu.trim();
    const entered = languageCodes.reduce<Record<string, string>>((result, code) => {
      const value = (meanings[code] ?? '').trim();
      if (value) result[code] = value;
      return result;
    }, {});
    if (!huValue || Object.keys(entered).length === 0) {
      Alert.alert(t('vocabulary.addWord'), t('vocabulary.fillRequired'));
      return;
    }
    const existing = words.find(word => normalizeWordKey(word.hu) === normalizeWordKey(huValue));
    if (existing) {
      const candidates = languageCodes.filter(code =>
        Boolean((entered[code] ?? '').trim() || existingMeaning(existing, code).trim()),
      );
      const nextOptions: Record<string, string[]> = {};
      const nextSelections: Record<string, string[]> = {};
      for (const code of candidates) {
        const values = uniqueValues([
          ...existingMeaning(existing, code).split('\n'),
          entered[code] ?? '',
        ]);
        nextOptions[code] = values;
        nextSelections[code] = values;
      }
      setMatch(existing);
      setMergeLanguages(candidates);
      setOptions(nextOptions);
      setSelections(nextSelections);
      setMergeTags(uniqueValues([...getWordTags(existing), ...tags.split(',')]));
      setStep(1);
      return;
    }
    dispatch(
      vocabularyImported([
        {
          id: createWordId(),
          hu: huValue,
          en: entered.en ?? '',
          es: entered.es ?? '',
          translations: entered,
          tags: uniqueValues(tags.split(',')),
          removed: false,
        },
      ]),
    );
    close();
  }

  function finishMerge() {
    const hasSelection = mergeLanguages.some(code => (selections[code] ?? []).length > 0);
    if (!match || !hasSelection) {
      Alert.alert(t('vocabulary.selectMeaning'));
      return;
    }
    const translations: Record<string, string> = { ...(match.translations ?? {}) };
    for (const code of mergeLanguages) {
      const values = selections[code] ?? [];
      if (values.length) translations[code] = values.join('\n');
      else delete translations[code];
    }
    dispatch(
      vocabularyImported([
        {
          id: match.id,
          hu: match.hu,
          en: translations.en ?? '',
          es: translations.es ?? '',
          translations,
          tags: mergeTags,
          removed: Boolean(progress[match.id]?.removed),
        },
      ]),
    );
    close();
  }

  async function exportCsv() {
    try {
      await exportVocabularyFileAsync(exportVocabularyCsv(words, progress));
    } catch {
      Alert.alert(t('vocabulary.exportCsv'), t('vocabulary.exportFailed'));
    }
  }

  async function importCsv() {
    try {
      const csv = await pickVocabularyFileAsync();
      if (csv === null) return;
      const rows = importVocabularyCsv(csv).map(row => ({
        ...row,
        id: row.id || createWordId(),
      }));
      const replacedIds = new Set(rows.map(row => row.id));
      const candidates = [
        ...words.filter(word => !replacedIds.has(word.id)),
        ...rows.map(row => ({ ...row, eligible: true })),
      ];
      if (new Set(candidates.map(word => normalizeWordKey(word.hu))).size !== candidates.length) {
        throw new Error(t('vocabulary.duplicateWords'));
      }
      Alert.alert(
        t('vocabulary.importCsv'),
        t('vocabulary.importConfirm', { count: rows.length }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('vocabulary.importCsv'), onPress: () => dispatch(vocabularyImported(rows)) },
        ],
      );
    } catch (error) {
      Alert.alert(
        t('vocabulary.importFailed'),
        error instanceof Error ? error.message : t('vocabulary.checkCsv'),
      );
    }
  }

  async function exportBackup() {
    try {
      await exportBackupFileAsync(learning, t('backup.shareTitle'));
    } catch (error) {
      Alert.alert(t('backup.title'), backupErrorMessage(error, t));
    }
  }

  async function restoreBackup() {
    try {
      const json = await pickBackupFileAsync();
      if (!json) return;
      const restoredState = parseBackupPackage(json);
      Alert.alert(t('backup.confirmRestoreTitle'), t('backup.confirmRestoreMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('backup.restore'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await persistence.setPersistData(DataPersistKeys.LEARNING, {
                  version: LEARNING_STATE_VERSION,
                  data: restoredState,
                });
                dispatch(backupRestored(restoredState));
                Alert.alert(t('backup.title'), t('backup.restoreSuccess'));
              } catch {
                Alert.alert(t('backup.title'), t('backup.restoreFailed'));
              }
            })();
          },
        },
      ]);
    } catch (error) {
      Alert.alert(t('backup.title'), backupErrorMessage(error, t));
    }
  }

  const buttonStyle = [
    styles.button,
    isDark && { backgroundColor: colors.darkSurface, borderColor: colors.mutedInk },
  ];
  const inputStyle = [
    styles.input,
    isDark && { backgroundColor: colors.darkCanvas, color: colors.white },
  ];

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: textColor }]}>{t('vocabulary.title')}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        style={buttonStyle}
        testID="add-word"
        onPress={() => setVisible(true)}>
        <Text style={[styles.buttonText, { color: textColor }]}>{t('vocabulary.addWord')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        style={buttonStyle}
        onPress={() => {
          void exportCsv();
        }}>
        <Text style={[styles.buttonText, { color: textColor }]}>{t('vocabulary.exportCsv')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        style={buttonStyle}
        onPress={() => {
          void importCsv();
        }}>
        <Text style={[styles.buttonText, { color: textColor }]}>{t('vocabulary.importCsv')}</Text>
      </TouchableOpacity>
      <Text style={[styles.hint, isDark && { color: colors.darkMuted }]}>
        {t('vocabulary.csvHint')}
      </Text>

      {/* Backup and Restore Section */}
      <Text style={[styles.heading, { color: textColor, marginTop: 12 }]}>{t('backup.title')}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        style={buttonStyle}
        testID="export-backup"
        onPress={() => {
          void exportBackup();
        }}>
        <Text style={[styles.buttonText, { color: textColor }]}>{t('backup.create')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        style={buttonStyle}
        testID="restore-backup"
        onPress={() => {
          void restoreBackup();
        }}>
        <Text style={[styles.buttonText, { color: textColor }]}>{t('backup.restore')}</Text>
      </TouchableOpacity>
      <Text style={[styles.hint, isDark && { color: colors.darkMuted }]}>{t('backup.hint')}</Text>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={isIos ? 'padding' : 'height'}>
          <View
            style={[styles.sheet, isDark && { backgroundColor: colors.darkSurface }]}
            accessibilityViewIsModal>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              {step === 0 ? (
                <>
                  <Text accessibilityRole="header" style={[styles.heading, { color: textColor }]}>
                    {t('vocabulary.newWord')}
                  </Text>
                  <Text style={[styles.hint, isDark && { color: colors.darkMuted }]}>
                    {t('vocabulary.addWordHint')}
                  </Text>
                  <Text style={[styles.label, { color: textColor }]}>
                    {t('vocabulary.hungarianLabel')}
                  </Text>
                  <TextInput
                    testID="add-word-hungarian"
                    accessibilityLabel={t('vocabulary.hungarianLabel')}
                    style={inputStyle}
                    value={hu}
                    onChangeText={setHu}
                  />
                  {languageCodes.map(code => (
                    <View key={code}>
                      <Text style={[styles.label, { color: textColor }]}>{languageName(code)}</Text>
                      <TextInput
                        testID={`add-word-${LANGUAGE_TEST_IDS[code] ?? code}`}
                        accessibilityLabel={languageName(code)}
                        style={inputStyle}
                        value={meanings[code] ?? ''}
                        onChangeText={value =>
                          setMeanings(current => ({ ...current, [code]: value }))
                        }
                      />
                    </View>
                  ))}
                  <Text style={[styles.label, { color: textColor }]}>
                    {t('vocabulary.tagsOptional')}
                  </Text>
                  <TextInput
                    accessibilityLabel={t('vocabulary.tagsLabel')}
                    style={inputStyle}
                    value={tags}
                    onChangeText={setTags}
                    placeholder={t('vocabulary.tagsPlaceholder')}
                    placeholderTextColor={colors.gray}
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.primary}
                    testID="save-word"
                    onPress={save}>
                    <Text style={styles.primaryText}>{t('vocabulary.saveWord')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text accessibilityRole="header" style={[styles.heading, { color: textColor }]}>
                    {step <= mergeLanguages.length
                      ? t('vocabulary.reviewLanguage', {
                          language: t(`vocabulary.languageNames.${reviewLanguage}`, {
                            defaultValue: languageName(reviewLanguage, 'label'),
                          }),
                        })
                      : t('vocabulary.reviewTags')}
                  </Text>
                  <Text style={[styles.hint, isDark && { color: colors.darkMuted }]}>
                    {match?.hu} · {step} / {tagStep}
                  </Text>
                  {step < tagStep ? (
                    <>
                      <Text style={[styles.hint, isDark && { color: colors.darkMuted }]}>
                        {t('vocabulary.selectMeaningsHint')}
                      </Text>
                      <View style={styles.choices}>
                        {(options[reviewLanguage] ?? []).map(value => {
                          const selected = (selections[reviewLanguage] ?? []).includes(value);
                          return (
                            <TouchableOpacity
                              key={value}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: selected }}
                              style={[
                                styles.choice,
                                selected && styles.selected,
                                isDark && {
                                  backgroundColor: selected
                                    ? colors.darkCanvas
                                    : colors.darkSurface,
                                },
                              ]}
                              onPress={() =>
                                setSelections(current => {
                                  const list = current[reviewLanguage] ?? [];
                                  return {
                                    ...current,
                                    [reviewLanguage]: selected
                                      ? list.filter(item => item !== value)
                                      : [...list, value],
                                  };
                                })
                              }>
                              <Ionicons
                                name={selected ? 'checkbox' : 'square-outline'}
                                size={22}
                                color={isDark ? colors.darkTeal : colors.teal}
                              />
                              <Text style={[styles.buttonText, { color: textColor }]}>{value}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <TextInput
                        accessibilityLabel={t('vocabulary.customMeaningPlaceholder')}
                        value={customMeaning}
                        onChangeText={setCustomMeaning}
                        style={inputStyle}
                        placeholder={t('vocabulary.customMeaningPlaceholder')}
                        placeholderTextColor={colors.gray}
                      />
                      <TouchableOpacity
                        accessibilityRole="button"
                        style={buttonStyle}
                        onPress={() => {
                          const value = customMeaning.trim();
                          if (!value) return;
                          setOptions(current => ({
                            ...current,
                            [reviewLanguage]: Array.from(
                              new Set([...(current[reviewLanguage] ?? []), value]),
                            ),
                          }));
                          setSelections(current => ({
                            ...current,
                            [reviewLanguage]: Array.from(
                              new Set([...(current[reviewLanguage] ?? []), value]),
                            ),
                          }));
                          setCustomMeaning('');
                        }}>
                        <Text style={[styles.buttonText, { color: textColor }]}>
                          {t('vocabulary.addMeaning')}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.hint, isDark && { color: colors.darkMuted }]}>
                        {t('vocabulary.removeTagsHint')}
                      </Text>
                      <View style={styles.pills}>
                        {mergeTags.map(tag => (
                          <TouchableOpacity
                            key={tag}
                            accessibilityRole="button"
                            accessibilityLabel={t('vocabulary.removeTag', { tag })}
                            style={styles.pill}
                            onPress={() =>
                              setMergeTags(current => current.filter(value => value !== tag))
                            }>
                            <Text style={{ color: colors.teal }}>{tag}</Text>
                            <Ionicons name="close" size={16} color={colors.teal} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                  <TouchableOpacity
                    testID={step === tagStep ? 'merge-word' : 'merge-next'}
                    accessibilityRole="button"
                    style={styles.primary}
                    onPress={() => {
                      if (step === tagStep) finishMerge();
                      else if (!(selections[reviewLanguage] ?? []).length)
                        Alert.alert(t('vocabulary.selectMeaning'));
                      else {
                        setCustomMeaning('');
                        setStep(step + 1);
                      }
                    }}>
                    <Text style={styles.primaryText}>
                      {step === tagStep ? t('vocabulary.mergeWord') : t('vocabulary.next')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.cancel}
                    onPress={() => {
                      setCustomMeaning('');
                      setStep(step - 1);
                    }}>
                    <Text style={[styles.cancelText, isDark && { color: colors.darkTeal }]}>
                      {t('vocabulary.back')}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                testID="cancel-word"
                accessibilityRole="button"
                style={styles.cancel}
                onPress={close}>
                <Text style={[styles.cancelText, isDark && { color: colors.darkTeal }]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
