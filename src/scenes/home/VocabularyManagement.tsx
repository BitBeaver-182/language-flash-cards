import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { colors } from '@/theme';
import useColorScheme from '@/hooks/useColorScheme';
import { isIos } from '@/utils/deviceInfo';
import { State } from '@/utils/store';
import { vocabularyImported } from '@/slices/learning.slice';
import { normalizeWordKey } from '@/utils/vocabularyModel';
import { exportVocabularyCsv, importVocabularyCsv } from '@/utils/vocabularyCsv';
import { exportVocabularyFileAsync, pickVocabularyFileAsync } from '@/services';
import { getWordTags } from '@/utils/tags';
import { Word } from '@/utils/vocabulary';
import { Ionicons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';

function createWordId(): string {
  return randomUUID();
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { fontSize: 20, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 14, lineHeight: 21, color: colors.mutedInk },
  button: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  buttonText: { fontSize: 16, fontWeight: '600', color: colors.ink },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  content: { padding: 24, gap: 14 },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.gray,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  primary: {
    backgroundColor: colors.teal,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  cancel: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: colors.teal, fontSize: 16, fontWeight: '600' },
  choices: { gap: 8 },
  choice: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selected: { borderColor: colors.teal, backgroundColor: colors.tealLight },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.tealLight,
  },
});

export default function VocabularyManagement() {
  const dispatch = useDispatch();
  const { isDark } = useColorScheme();
  const { progress, language, words: userWords } = useSelector((state: State) => state.learning);
  const words = useMemo(() => Object.values(userWords), [userWords]);
  const es = language === 'es';
  const [visible, setVisible] = useState(false);
  const [hu, setHu] = useState('');
  const [en, setEn] = useState('');
  const [spanish, setSpanish] = useState('');
  const [tags, setTags] = useState('');
  const [match, setMatch] = useState<Word | null>(null);
  const [step, setStep] = useState(0);
  const [englishMeanings, setEnglishMeanings] = useState<string[]>([]);
  const [spanishMeanings, setSpanishMeanings] = useState<string[]>([]);
  const [englishOptions, setEnglishOptions] = useState<string[]>([]);
  const [spanishOptions, setSpanishOptions] = useState<string[]>([]);
  const [mergeTags, setMergeTags] = useState<string[]>([]);
  const [customMeaning, setCustomMeaning] = useState('');
  const textColor = isDark ? colors.white : colors.ink;
  function close() {
    setVisible(false);
    setHu('');
    setEn('');
    setSpanish('');
    setTags('');
    setMatch(null);
    setStep(0);
    setCustomMeaning('');
  }
  function save() {
    if (!hu.trim() || !en.trim() || !spanish.trim()) {
      Alert.alert(es ? 'Completa los tres idiomas' : 'Fill in all three languages');
      return;
    }
    const existing = words.find(word => normalizeWordKey(word.hu) === normalizeWordKey(hu));
    if (existing) {
      const unique = (values: string[]) =>
        Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
      setMatch(existing);
      const english = unique([...existing.en.split('\n'), en]);
      const spanishValues = unique([...existing.es.split('\n'), spanish]);
      setEnglishMeanings(english);
      setEnglishOptions(english);
      setSpanishMeanings(spanishValues);
      setSpanishOptions(spanishValues);
      setMergeTags(unique([...getWordTags(existing), ...tags.split(',')]));
      setStep(1);
      return;
    }
    dispatch(
      vocabularyImported([
        {
          id: createWordId(),
          hu: hu.trim(),
          en: en.trim(),
          es: spanish.trim(),
          tags: tags
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean),
          removed: false,
        },
      ]),
    );
    close();
  }
  function finishMerge() {
    if (!match || !englishMeanings.length || !spanishMeanings.length) {
      Alert.alert(es ? 'Selecciona al menos un significado' : 'Select at least one meaning');
      return;
    }
    dispatch(
      vocabularyImported([
        {
          id: match.id,
          hu: match.hu,
          en: englishMeanings.join('\n'),
          es: spanishMeanings.join('\n'),
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
      Alert.alert(
        es ? 'No se pudo exportar' : 'Could not export',
        es ? 'Inténtalo de nuevo.' : 'Please try again.',
      );
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
        throw new Error(
          es
            ? 'El archivo contiene palabras duplicadas. Añádelas individualmente para combinarlas.'
            : 'The file contains duplicate words. Add them individually to merge them.',
        );
      }
      Alert.alert(
        es ? 'Importar vocabulario' : 'Import vocabulary',
        es
          ? `Se actualizarán ${rows.length} entradas. Tu progreso se conserva usando los IDs.`
          : `${rows.length} entries will be added or updated. Existing progress is kept by ID.`,
        [
          { text: es ? 'Cancelar' : 'Cancel', style: 'cancel' },
          { text: es ? 'Importar' : 'Import', onPress: () => dispatch(vocabularyImported(rows)) },
        ],
      );
    } catch (error) {
      Alert.alert(
        es ? 'No se pudo importar' : 'Could not import',
        error instanceof Error
          ? error.message
          : es
            ? 'Comprueba el archivo CSV.'
            : 'Check the CSV file.',
      );
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
      <Text style={[styles.heading, { color: textColor }]}>
        {es ? 'Vocabulario' : 'Vocabulary'}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        style={buttonStyle}
        testID="add-word"
        onPress={() => setVisible(true)}>
        <Text style={[styles.buttonText, { color: textColor }]}>
          {es ? 'Añadir palabra' : 'Add word'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        style={buttonStyle}
        onPress={() => {
          void exportCsv();
        }}>
        <Text style={[styles.buttonText, { color: textColor }]}>
          {es ? 'Exportar CSV' : 'Export CSV'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        style={buttonStyle}
        onPress={() => {
          void importCsv();
        }}>
        <Text style={[styles.buttonText, { color: textColor }]}>
          {es ? 'Importar CSV' : 'Import CSV'}
        </Text>
      </TouchableOpacity>
      <Text style={[styles.hint, isDark && { color: colors.darkMuted }]}>
        {es
          ? 'Para editar en Excel: exporta, conserva la columna id y separa las etiquetas con |. Guarda como CSV UTF-8 y vuelve a importar.'
          : 'For Excel: export, keep the id column, and separate tags with |. Save as CSV UTF-8, then import.'}
      </Text>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={isIos ? 'padding' : 'height'}>
          <View
            style={[styles.sheet, isDark && { backgroundColor: colors.darkSurface }]}
            accessibilityViewIsModal>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              {step === 0 ? (
                <>
                  <Text accessibilityRole="header" style={[styles.heading, { color: textColor }]}>
                    {es ? 'Nueva palabra' : 'New word'}
                  </Text>
                  <Text style={[styles.hint, isDark && { color: colors.darkMuted }]}>
                    {es
                      ? 'Añade la palabra y sus traducciones.'
                      : 'Add the word and its translations.'}
                  </Text>
                  <Text style={[styles.label, { color: textColor }]}>
                    {es ? 'Húngaro' : 'Hungarian'}
                  </Text>
                  <TextInput
                    testID="add-word-hungarian"
                    accessibilityLabel="Hungarian"
                    style={inputStyle}
                    value={hu}
                    onChangeText={setHu}
                  />
                  <Text style={[styles.label, { color: textColor }]}>English</Text>
                  <TextInput
                    testID="add-word-english"
                    accessibilityLabel="English"
                    style={inputStyle}
                    value={en}
                    onChangeText={setEn}
                  />
                  <Text style={[styles.label, { color: textColor }]}>Español</Text>
                  <TextInput
                    testID="add-word-spanish"
                    accessibilityLabel="Español"
                    style={inputStyle}
                    value={spanish}
                    onChangeText={setSpanish}
                  />
                  <Text style={[styles.label, { color: textColor }]}>
                    {es ? 'Etiquetas (opcional)' : 'Tags (optional)'}
                  </Text>
                  <TextInput
                    accessibilityLabel={
                      es ? 'Etiquetas separadas por comas' : 'Tags separated by commas'
                    }
                    style={inputStyle}
                    value={tags}
                    onChangeText={setTags}
                    placeholder={es ? 'Separadas por comas' : 'Separated by commas'}
                    placeholderTextColor={colors.gray}
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.primary}
                    testID="save-word"
                    onPress={save}>
                    <Text style={styles.primaryText}>{es ? 'Guardar palabra' : 'Save word'}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text accessibilityRole="header" style={[styles.heading, { color: textColor }]}>
                    {step === 1
                      ? es
                        ? 'Revisa los significados en inglés'
                        : 'Review English meanings'
                      : step === 2
                        ? es
                          ? 'Revisa los significados en español'
                          : 'Review Spanish meanings'
                        : es
                          ? 'Revisa las etiquetas'
                          : 'Review tags'}
                  </Text>
                  <Text style={[styles.hint, isDark && { color: colors.darkMuted }]}>
                    {match?.hu} · {step} / 3
                  </Text>
                  {step < 3 ? (
                    <>
                      <Text style={[styles.hint, isDark && { color: colors.darkMuted }]}>
                        {es
                          ? 'Selecciona todos los significados que quieras conservar.'
                          : 'Select every meaning you want to keep.'}
                      </Text>
                      <View style={styles.choices}>
                        {(step === 1 ? englishOptions : spanishOptions).map(value => {
                          const selected = (
                            step === 1 ? englishMeanings : spanishMeanings
                          ).includes(value);
                          const setter = step === 1 ? setEnglishMeanings : setSpanishMeanings;
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
                                setter(current =>
                                  selected
                                    ? current.filter(item => item !== value)
                                    : [...current, value],
                                )
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
                        accessibilityLabel={es ? 'Otro significado' : 'Custom meaning'}
                        value={customMeaning}
                        onChangeText={setCustomMeaning}
                        style={inputStyle}
                        placeholder={es ? 'Escribe otro significado' : 'Write another meaning'}
                        placeholderTextColor={colors.gray}
                      />
                      <TouchableOpacity
                        accessibilityRole="button"
                        style={buttonStyle}
                        onPress={() => {
                          const value = customMeaning.trim();
                          if (!value) return;
                          const options = step === 1 ? setEnglishOptions : setSpanishOptions;
                          const meanings = step === 1 ? setEnglishMeanings : setSpanishMeanings;
                          options(current => Array.from(new Set([...current, value])));
                          meanings(current => Array.from(new Set([...current, value])));
                          setCustomMeaning('');
                        }}>
                        <Text style={[styles.buttonText, { color: textColor }]}>
                          {es ? 'Añadir significado' : 'Add meaning'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.hint, isDark && { color: colors.darkMuted }]}>
                        {es
                          ? 'Quita las etiquetas que no quieras conservar.'
                          : 'Remove tags you do not want to keep.'}
                      </Text>
                      <View style={styles.pills}>
                        {mergeTags.map(tag => (
                          <TouchableOpacity
                            key={tag}
                            accessibilityRole="button"
                            accessibilityLabel={es ? `Quitar etiqueta ${tag}` : `Remove tag ${tag}`}
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
                    testID={step === 3 ? 'merge-word' : 'merge-next'}
                    accessibilityRole="button"
                    style={styles.primary}
                    onPress={() => {
                      if (step === 3) finishMerge();
                      else if (!(step === 1 ? englishMeanings : spanishMeanings).length)
                        Alert.alert(
                          es ? 'Selecciona al menos un significado' : 'Select at least one meaning',
                        );
                      else {
                        setCustomMeaning('');
                        setStep(step + 1);
                      }
                    }}>
                    <Text style={styles.primaryText}>
                      {step === 3
                        ? es
                          ? 'Combinar palabra'
                          : 'Merge word'
                        : es
                          ? 'Siguiente'
                          : 'Next'}
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
                      {es ? 'Atrás' : 'Back'}
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
                  {es ? 'Cancelar' : 'Cancel'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
