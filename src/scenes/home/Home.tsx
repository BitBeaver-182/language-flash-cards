import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Alert,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { colors } from '@/theme';
import useColorScheme from '@/hooks/useColorScheme';
import { useLearningPersistence } from '@/hooks/useLearningPersistence';
import {
  languageChanged,
  dailyGoalChanged,
  remindersChanged,
  remindersEnabledChanged,
  reviewRecorded,
  sessionCompleted,
  wordRemovalChanged,
  SessionAnswer,
} from '@/slices/learning.slice';
import { syncRemindersAsync } from '@/services/reminders.service';
import { State } from '@/utils/store';
import { estimateRecall } from '@/utils/recall';
import { selectWords } from '@/utils/session';
import { makeChoices } from '@/utils/choices';
import { getReminderMinutes } from '@/utils/reminderSchedule';
import { getWeekProgress, summarizeSessions } from '@/utils/sessionHistory';
import { getWordTags } from '@/utils/tags';
import { Word } from '@/utils/vocabulary';
import { sentences } from '@/data/sentences';
import WordsList from './WordsList';
import VocabularyManagement from './VocabularyManagement';

function createSessionId() {
  return `${Date.now()}-${Math.random()}`;
}
const visuals: Record<string, string> = {
  alma: '🍎',
  macska: '🐈',
  ház: '🏠',
  kávé: '☕',
  könyv: '📖',
  autó: '🚗',
  virág: '🌷',
  nap: '☀️',
  hold: '🌙',
  víz: '💧',
  sör: '🍺',
  kenyér: '🍞',
};
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 32, gap: 16 },
  title: { fontSize: 29, fontWeight: '700', color: colors.ink },
  text: { fontSize: 16, lineHeight: 24, color: colors.ink },
  muted: { color: colors.mutedInk, fontSize: 14, lineHeight: 21 },
  card: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: colors.white,
    gap: 14,
    minHeight: 180,
    justifyContent: 'center',
  },
  word: { fontSize: 32, fontWeight: '700', color: colors.ink },
  button: {
    backgroundColor: colors.teal,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.gray,
    padding: 12,
    borderRadius: 12,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  nav: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingBottom: 4,
  },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 6, gap: 3 },
  navText: { fontSize: 12, color: colors.mutedInk },
  navActive: { color: colors.teal, fontWeight: '700' },
  wordRow: { padding: 16, borderRadius: 14, backgroundColor: colors.white, gap: 12 },
  wordHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  wordInfo: { flex: 1, gap: 4 },
  listTitle: { fontSize: 19, fontWeight: '700', color: colors.ink },
  dangerAction: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 16, minHeight: 48 },
  dangerText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 15,
    backgroundColor: colors.white,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: colors.white,
  },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: colors.ink },
  badge: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' },
  badgeText: { position: 'absolute', fontSize: 10, color: colors.ink, fontWeight: '700' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  day: { flex: 1, alignItems: 'center', gap: 6 },
  dayMark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  dayDone: { backgroundColor: colors.teal },
  dayToday: { borderWidth: 2, borderColor: colors.teal },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});

function MasteryBadge({
  value,
  es,
  dark,
  score = false,
}: {
  value: number | null;
  es: boolean;
  dark: boolean;
  score?: boolean;
}) {
  const label = value === null ? (es ? 'Sin evaluar' : 'Not assessed') : `${value}%`;
  const circumference = 2 * Math.PI * 23;
  return (
    <View
      style={styles.badge}
      accessible
      accessibilityLabel={
        value === null
          ? label
          : `${label} ${score ? (es ? 'respuestas correctas' : 'correct answers') : es ? 'recuerdo estimado' : 'estimated recall'}`
      }>
      <Svg width={54} height={54} viewBox="0 0 54 54">
        <Circle
          cx={27}
          cy={27}
          r={23}
          stroke={dark ? colors.mutedInk : colors.border}
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
      <Text style={[styles.badgeText, dark && { color: colors.white }]}>
        {value === null ? '—' : label}
      </Text>
    </View>
  );
}

export default function Home() {
  const ready = useLearningPersistence();
  const { isDark } = useColorScheme();
  const dispatch = useDispatch();
  const {
    progress,
    language,
    reminders,
    remindersEnabled,
    sessions,
    dailyGoal,
    words: userWords,
  } = useSelector((state: State) => state.learning);
  const [page, setPage] = useState<
    'home' | 'practice' | 'topics' | 'history' | 'session-detail' | 'words' | 'settings'
  >('home');
  const [queue, setQueue] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [choiceResult, setChoiceResult] = useState<boolean | null>(null);
  const [choiceAnswer, setChoiceAnswer] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [topic, setTopic] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [status, setStatus] = useState('');
  const [today, setToday] = useState(() => new Date());
  const lastNotification = useRef('');
  const [sessionStats, setSessionStats] = useState<{
    id: string;
    correct: number;
    total: number;
    topic: string;
    answers: SessionAnswer[];
  }>({ id: '', correct: 0, total: 0, topic: '', answers: [] });
  const es = language === 'es';
  const words = useMemo(() => Object.values(userWords), [userWords]);
  const textStyle = [styles.text, isDark && { color: colors.white }];
  const availableTags = useMemo(
    () => Array.from(new Set(words.flatMap(item => item.tags))).sort((a, b) => a.localeCompare(b)),
    [words],
  );
  const todaySummary = summarizeSessions(sessions, today);
  const week = getWeekProgress(sessions, today, dailyGoal);
  const word = queue[index];
  const sentence =
    word && index % 3 === 2 && progress[word.id]?.reviews > 0
      ? sentences.find(item => item.target === word.hu.toLocaleLowerCase())
      : undefined;
  const choices = useMemo(() => {
    if (!word || index % 3 !== 1) return [];
    const candidates = words.filter(item => item.tags.some(itemTag => word.tags.includes(itemTag)));
    const result = makeChoices(word, candidates, language);
    return result.length ? [...result.slice(1), result[0]] : [];
  }, [word, index, language, words]);
  useEffect(() => {
    if (ready) void syncRemindersAsync(reminders).then(setStatus);
  }, [ready, reminders]);
  useEffect(() => {
    if (!ready) return;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setToday(new Date());
        void syncRemindersAsync(reminders).then(setStatus);
      }
    });
    return () => subscription.remove();
  }, [ready, reminders]);
  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    function openNotification(response: Notifications.NotificationResponse) {
      const notification = response.notification;
      const key = `${notification.request.identifier}:${notification.date}`;
      if (
        notification.request.identifier.startsWith('hungarian-recall-') &&
        lastNotification.current !== key
      ) {
        lastNotification.current = key;
        setQueue(selectWords(words, progress, new Date()));
        setSessionStats({
          id: createSessionId(),
          correct: 0,
          total: 0,
          topic: '',
          answers: [],
        });
        setIndex(0);
        setRevealed(false);
        setChoiceResult(null);
        setPage('practice');
      }
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(openNotification);
    void Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) openNotification(response);
    });
    return () => subscription.remove();
  }, [progress, words]);

  function button(label: string, onPress: () => void, testID?: string) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        testID={testID}
        style={styles.button}
        onPress={onPress}>
        <Text style={styles.buttonText}>{label}</Text>
      </TouchableOpacity>
    );
  }
  function start() {
    const pool = topic ? words.filter(item => getWordTags(item).includes(topic)) : words;
    setQueue(selectWords(pool, progress, new Date()));
    setSessionStats({ id: createSessionId(), correct: 0, total: 0, topic, answers: [] });
    setIndex(0);
    setRevealed(false);
    setChoiceResult(null);
    setPage('practice');
  }
  function confirmRemoval(target: Word, onConfirm: () => void) {
    Alert.alert(
      es ? '¿Quitar palabra?' : 'Remove word from practice?',
      es
        ? `“${target.hu}” dejará de aparecer en las prácticas. Puedes restaurarla desde Mis palabras.`
        : `“${target.hu}” will no longer appear in practice. You can restore it from My words.`,
      [
        { text: es ? 'Cancelar' : 'Cancel', style: 'cancel' },
        { text: es ? 'Quitar palabra' : 'Remove word', style: 'destructive', onPress: onConfirm },
      ],
    );
  }
  function answer(correct: boolean, mode: 'recall' | 'recognition' = 'recall') {
    if (!word) return;
    dispatch(
      reviewRecorded({
        wordId: word.id,
        result: correct ? 'correct' : 'incorrect',
        mode,
        at: new Date().toISOString(),
      }),
    );
    const nextStats = {
      ...sessionStats,
      total: sessionStats.total + 1,
      correct: sessionStats.correct + (correct ? 1 : 0),
      answers: [
        ...sessionStats.answers,
        {
          wordId: word.id,
          kind: sentence
            ? ('sentence' as const)
            : word.hu.trim().split(/\s+/).length > 1
              ? ('phrase' as const)
              : ('word' as const),
          prompt: sentence ? `${sentence.before}______${sentence.after}` : word.hu,
          expected: sentence ? word.hu : word[language],
          answer: mode === 'recognition' ? choiceAnswer : correct ? 'remembered' : 'forgot',
          correct,
        },
      ],
    };
    setSessionStats(nextStats);
    if (index + 1 >= queue.length) finishSession(nextStats);
    setRevealed(false);
    setChoiceResult(null);
    setIndex(index + 1);
  }
  function finishSession(session = sessionStats) {
    if (session.total > 0) {
      const completedAt = new Date();
      setToday(completedAt);
      dispatch(sessionCompleted({ ...session, completedAt: completedAt.toISOString() }));
    }
  }
  if (!ready)
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.text}>Loading…</Text>
      </SafeAreaView>
    );
  return (
    <SafeAreaView
      testID="home-screen"
      style={[styles.root, isDark && { backgroundColor: colors.darkCanvas }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {page === 'words' ? (
        <WordsList />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, isDark && { color: colors.white }]}>
            Magyar · {es ? 'Palabras' : 'Words'}
          </Text>
          {page === 'home' && (
            <>
              <View style={[styles.wordRow, isDark && { backgroundColor: colors.darkSurface }]}>
                <Text style={[styles.sectionTitle, isDark && { color: colors.white }]}>
                  {es ? 'Esta semana' : 'This week'}
                </Text>
                <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                  {es ? 'Objetivo diario: ' : 'Daily goal: '}
                  {dailyGoal}{' '}
                  {es
                    ? dailyGoal === 1
                      ? 'sesión'
                      : 'sesiones'
                    : dailyGoal === 1
                      ? 'session'
                      : 'sessions'}
                </Text>
                <View style={styles.weekRow}>
                  {week.map(day => (
                    <View
                      key={day.date.toISOString()}
                      style={styles.day}
                      accessible
                      accessibilityLabel={`${day.date.toLocaleDateString(es ? 'es' : 'en', { weekday: 'long' })}: ${day.count} ${es ? 'sesiones' : 'sessions'}`}>
                      <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                        {day.date
                          .toLocaleDateString(es ? 'es' : 'en', { weekday: 'short' })
                          .replace('.', '')
                          .slice(0, 2)}
                      </Text>
                      <View
                        style={[
                          styles.dayMark,
                          day.completed && styles.dayDone,
                          day.isToday && styles.dayToday,
                          isDark && !day.completed && { backgroundColor: colors.darkCanvas },
                        ]}>
                        <Text
                          style={[
                            styles.muted,
                            day.completed && { color: colors.white },
                            isDark && !day.completed && { color: colors.darkMuted },
                          ]}>
                          {day.completed ? '✓' : day.date.getDate()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
              <View style={[styles.wordRow, isDark && { backgroundColor: colors.darkSurface }]}>
                <Text style={[styles.sectionTitle, isDark && { color: colors.white }]}>
                  {es ? 'Hoy' : 'Today'}
                </Text>
                <View style={styles.statRow}>
                  <View>
                    <Text style={textStyle}>
                      {todaySummary.sessions} / {dailyGoal} {es ? 'sesiones' : 'sessions'}
                    </Text>
                    <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                      {todaySummary.total
                        ? `${todaySummary.correct} / ${todaySummary.total} ${es ? 'respuestas correctas' : 'correct answers'}`
                        : es
                          ? 'Aún no hay sesiones completadas'
                          : 'No completed sessions yet'}
                    </Text>
                  </View>
                  <MasteryBadge
                    value={
                      todaySummary.total
                        ? Math.round((todaySummary.correct / todaySummary.total) * 100)
                        : null
                    }
                    es={es}
                    dark={isDark}
                    score
                  />
                </View>
              </View>
              {button(
                es ? 'Practicar' : 'Start practice',
                () => {
                  setTopic('');
                  setPage('topics');
                },
                'start-practice',
              )}
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.secondary, isDark && { backgroundColor: colors.darkSurface }]}
                onPress={() => setPage('history')}>
                <Text style={textStyle}>
                  {es ? 'Ver sesiones anteriores' : 'View previous sessions'} ›
                </Text>
                <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                  {es ? 'Consulta tus sesiones completadas' : 'See your completed sessions'}
                </Text>
              </TouchableOpacity>
            </>
          )}
          {page === 'topics' && (
            <>
              <Text style={[styles.sectionTitle, isDark && { color: colors.white }]}>
                {es ? 'Elige una etiqueta' : 'Choose a tag'}
              </Text>
              <Text style={textStyle}>
                {es
                  ? 'Elige qué palabras quieres practicar. La selección se usa al empezar una sesión.'
                  : 'Choose which words to practice. Your selection applies when you start a session.'}
              </Text>
              {button(es ? 'Comenzar sesión' : 'Begin session', () => start(), 'begin-session')}
              <TextInput
                testID="search-tags"
                accessibilityLabel={es ? 'Buscar etiquetas' : 'Search tags'}
                placeholder={es ? 'Buscar etiquetas' : 'Search tags'}
                placeholderTextColor={colors.gray}
                style={[
                  styles.input,
                  isDark && { color: colors.white, backgroundColor: colors.darkSurface },
                ]}
                value={tagQuery}
                onChangeText={setTagQuery}
              />
              <Text style={textStyle}>
                {es ? 'Escribe para buscar todas las etiquetas.' : 'Type to search all tags.'}
              </Text>
              {[
                '',
                ...availableTags
                  .filter(tag =>
                    tag.toLocaleLowerCase().includes(tagQuery.trim().toLocaleLowerCase()),
                  )
                  .slice(0, 20),
              ].map(item => (
                <TouchableOpacity
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: topic === item }}
                  style={[styles.secondary, isDark && { backgroundColor: colors.darkSurface }]}
                  onPress={() => {
                    setTopic(item);
                  }}>
                  <Text style={textStyle}>
                    {item || (es ? 'Todas las palabras' : 'All words')}
                    {topic === item ? '  ✓' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          {page === 'history' && (
            <>
              <Text style={[styles.sectionTitle, isDark && { color: colors.white }]}>
                {es ? 'Sesiones anteriores' : 'Previous sessions'}
              </Text>
              {sessions.length === 0 ? (
                <Text style={textStyle}>
                  {es
                    ? 'Tus sesiones completadas aparecerán aquí.'
                    : 'Your completed sessions will appear here.'}
                </Text>
              ) : (
                sessions.map(session => {
                  return (
                    <TouchableOpacity
                      key={session.id}
                      accessibilityRole="button"
                      onPress={() => {
                        setSessionId(session.id);
                        setPage('session-detail');
                      }}
                      style={[styles.wordRow, isDark && { backgroundColor: colors.darkSurface }]}>
                      <View style={styles.statRow}>
                        <View style={styles.wordInfo}>
                          <Text style={textStyle}>
                            {session.topic || (es ? 'Todas las palabras' : 'All words')}
                          </Text>
                          <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                            {new Date(session.completedAt).toLocaleString(es ? 'es' : 'en', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </Text>
                          <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                            {session.correct} / {session.total} {es ? 'correctas' : 'correct'}
                          </Text>
                        </View>
                        <MasteryBadge
                          value={Math.round((session.correct / session.total) * 100)}
                          es={es}
                          dark={isDark}
                          score
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}
          {page === 'session-detail' &&
            (() => {
              const session = sessions.find(item => item.id === sessionId);
              return (
                <>
                  <Text style={[styles.sectionTitle, isDark && { color: colors.white }]}>
                    {es ? 'Detalle de la sesión' : 'Session details'}
                  </Text>
                  {button(es ? 'Volver a sesiones' : 'Back to sessions', () => setPage('history'))}
                  {!session?.answers?.length ? (
                    <Text style={textStyle}>
                      {es
                        ? 'Los detalles no se guardaban en sesiones anteriores.'
                        : 'Answer details were not saved for older sessions.'}
                    </Text>
                  ) : (
                    session.answers.map((entry, answerIndex) => (
                      <View
                        key={`${entry.wordId}-${answerIndex}`}
                        style={[styles.wordRow, isDark && { backgroundColor: colors.darkSurface }]}>
                        <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                          {entry.kind === 'sentence'
                            ? es
                              ? 'Frase contextual'
                              : 'Sentence'
                            : entry.kind === 'phrase'
                              ? es
                                ? 'Expresión'
                                : 'Phrase'
                              : es
                                ? 'Palabra'
                                : 'Word'}
                        </Text>
                        <Text style={textStyle}>{entry.prompt}</Text>
                        <Text style={textStyle}>
                          {es ? 'Respuesta esperada' : 'Expected'}: {entry.expected}
                        </Text>
                        <Text style={textStyle}>
                          {es ? 'Tu respuesta' : 'Your answer'}:{' '}
                          {entry.answer === 'remembered'
                            ? es
                              ? 'Lo recordé (autoevaluación)'
                              : 'Remembered (self-assessed)'
                            : entry.answer === 'forgot'
                              ? es
                                ? 'No lo recordé (autoevaluación)'
                                : 'Forgot (self-assessed)'
                              : entry.answer}
                        </Text>
                        <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                          {entry.correct
                            ? es
                              ? 'Correcta'
                              : 'Correct'
                            : es
                              ? 'Para repasar'
                              : 'Needs review'}
                        </Text>
                      </View>
                    ))
                  )}
                </>
              );
            })()}
          {page === 'practice' &&
            (word ? (
              <>
                <Text style={textStyle}>
                  {es ? 'Práctica' : 'Practice'} · {index + 1} / {queue.length}
                </Text>
                <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                  {choices.length > 0
                    ? es
                      ? 'Opción múltiple · elige una respuesta'
                      : 'Multiple choice · choose one answer'
                    : sentence
                      ? es
                        ? 'Completa la frase y comprueba tu respuesta'
                        : 'Complete the sentence, then check your answer'
                      : es
                        ? 'Recuerda el significado antes de mostrar la respuesta'
                        : 'Recall the meaning before showing the answer'}
                </Text>
                <View style={[styles.card, isDark && { backgroundColor: colors.darkSurface }]}>
                  {sentence ? (
                    <>
                      <Text style={textStyle}>{es ? sentence.es : sentence.en}</Text>
                      <Text style={[styles.word, isDark && { color: colors.white }]}>
                        {sentence.before}______{sentence.after}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.word, isDark && { color: colors.white }]}>
                        {word.hu}
                      </Text>
                      {visuals[word.hu.toLocaleLowerCase()] ? (
                        <Text style={styles.word} accessibilityLabel={es ? word.es : word.en}>
                          {visuals[word.hu.toLocaleLowerCase()]}
                        </Text>
                      ) : null}
                    </>
                  )}
                  <Text style={textStyle}>
                    {estimateRecall(progress[word.id], new Date()) === null
                      ? es
                        ? 'Sin evaluar'
                        : 'Not assessed'
                      : `${estimateRecall(progress[word.id], new Date())}% ${es ? 'estimado' : 'estimated recall'}`}
                  </Text>
                </View>
                {choices.length > 0 ? (
                  choiceResult === null ? (
                    <>
                      <Text style={textStyle}>
                        {es ? 'Elige el significado' : 'Choose the meaning'}
                      </Text>
                      {choices.map(choice => (
                        <TouchableOpacity
                          key={choice}
                          accessibilityRole="button"
                          style={[styles.option, isDark && { backgroundColor: colors.darkSurface }]}
                          onPress={() => {
                            setChoiceAnswer(choice);
                            setChoiceResult(choice === word[language].split('\n')[0]);
                          }}>
                          <Text style={textStyle}>{choice}</Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  ) : (
                    <>
                      <Text style={textStyle}>
                        {choiceResult
                          ? es
                            ? '¡Bien!'
                            : 'Nice!'
                          : `${es ? 'Respuesta' : 'Answer'}: ${word[language]}`}
                      </Text>
                      {button(es ? 'Continuar' : 'Continue', () =>
                        answer(choiceResult, 'recognition'),
                      )}
                    </>
                  )
                ) : revealed ? (
                  <>
                    {(sentence ? [word.hu] : word[language].split('\n')).map(meaning => (
                      <Text key={meaning} style={textStyle}>
                        {word[language].includes('\n') && !sentence ? '• ' : ''}
                        {meaning}
                      </Text>
                    ))}
                    {button(es ? 'Lo recordé' : 'I remembered', () => answer(true))}
                    {button(es ? 'No lo recordé' : 'I forgot', () => answer(false))}
                  </>
                ) : (
                  button(es ? 'Mostrar respuesta' : 'Show answer', () => setRevealed(true))
                )}
                <TouchableOpacity
                  testID="remove-word"
                  accessibilityRole="button"
                  style={styles.dangerAction}
                  onPress={() =>
                    confirmRemoval(word, () => {
                      dispatch(wordRemovalChanged({ wordId: word.id, removed: true }));
                      const nextQueue = queue.filter(
                        (item, itemIndex) =>
                          itemIndex <= index ||
                          item.hu.toLocaleLowerCase() !== word.hu.toLocaleLowerCase(),
                      );
                      setQueue(nextQueue);
                      setRevealed(false);
                      setChoiceResult(null);
                      if (index + 1 >= nextQueue.length) finishSession();
                      setIndex(index + 1);
                    })
                  }>
                  <Text style={[styles.dangerText, isDark && { color: colors.darkDanger }]}>
                    {es ? 'Quitar de práctica' : 'Remove from practice'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={textStyle}>
                  {queue.length === 0
                    ? es
                      ? 'No hay palabras disponibles para este tema.'
                      : 'No words are available for this topic.'
                    : es
                      ? '¡Sesión terminada!'
                      : 'Session complete!'}
                </Text>
                {button(
                  queue.length === 0
                    ? es
                      ? 'Elegir otro tema'
                      : 'Choose another topic'
                    : es
                      ? 'Practicar más'
                      : 'Practice more',
                  () => setPage('topics'),
                )}
              </>
            ))}
          {page === 'settings' && (
            <>
              <Text style={textStyle}>
                {es ? 'Objetivo de sesiones por día' : 'Daily session goal'}: {dailyGoal}
              </Text>
              <View style={styles.row}>
                {button('−', () => dispatch(dailyGoalChanged(dailyGoal - 1)))}
                {button('+', () => dispatch(dailyGoalChanged(dailyGoal + 1)))}
              </View>
              <Text style={textStyle}>{es ? 'Idioma de ayuda' : 'Support language'}</Text>
              <View style={styles.row}>
                {button('English', () => dispatch(languageChanged('en')))}
                {button('Español', () => dispatch(languageChanged('es')))}
              </View>
              <View style={styles.statRow}>
                <Text style={textStyle}>
                  {es ? 'Recordarme practicar' : 'Remind me to practice'}
                </Text>
                <Switch
                  accessibilityLabel={es ? 'Recordarme practicar' : 'Remind me to practice'}
                  value={remindersEnabled}
                  onValueChange={value => {
                    dispatch(remindersEnabledChanged(value));
                  }}
                />
              </View>
              <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                {remindersEnabled
                  ? es
                    ? 'Un recordatorio por sesión, distribuido fuera de las horas de silencio.'
                    : 'One reminder per session, spaced outside your quiet hours.'
                  : es
                    ? 'Los recordatorios están desactivados.'
                    : 'Reminders are off.'}
              </Text>
              <Text style={textStyle}>
                {es ? 'Horas de silencio (hora local)' : 'Quiet hours (local time)'}
              </Text>
              {(['quietStart', 'quietEnd'] as const).map(key => (
                <View key={key}>
                  <Text style={textStyle}>
                    {key === 'quietStart' ? (es ? 'Desde' : 'From') : es ? 'Hasta' : 'Until'}:{' '}
                    {String(Math.floor(reminders[key] / 60)).padStart(2, '0')}:00
                  </Text>
                  <View style={styles.row}>
                    {button('−', () =>
                      dispatch(
                        remindersChanged({ ...reminders, [key]: (reminders[key] + 1380) % 1440 }),
                      ),
                    )}
                    {button('+', () =>
                      dispatch(
                        remindersChanged({ ...reminders, [key]: (reminders[key] + 60) % 1440 }),
                      ),
                    )}
                  </View>
                </View>
              ))}
              <Text style={textStyle}>
                {status === 'permission-denied'
                  ? es
                    ? 'Permite las notificaciones en los ajustes del teléfono.'
                    : 'Allow notifications in your phone settings.'
                  : status === 'error'
                    ? es
                      ? 'No se pudieron programar recordatorios.'
                      : 'Could not schedule reminders.'
                    : reminders.count > 0 &&
                        getReminderMinutes(
                          reminders.count,
                          reminders.quietStart,
                          reminders.quietEnd,
                        ).length === 0
                      ? es
                        ? 'El período disponible es demasiado corto para programar recordatorios.'
                        : 'The available window is too short to schedule reminders.'
                      : ''}
              </Text>
              <VocabularyManagement />
            </>
          )}
        </ScrollView>
      )}
      <View style={[styles.nav, isDark && { backgroundColor: colors.darkSurface }]}>
        {[
          { id: 'home' as const, label: es ? 'Inicio' : 'Home', icon: 'home-outline' as const },
          {
            id: 'words' as const,
            label: es ? 'Mis palabras' : 'My words',
            icon: 'book-outline' as const,
          },
          {
            id: 'settings' as const,
            label: es ? 'Ajustes' : 'Settings',
            icon: 'settings-outline' as const,
          },
        ].map(item => {
          const active =
            item.id === page ||
            (item.id === 'home' &&
              (page === 'practice' ||
                page === 'topics' ||
                page === 'history' ||
                page === 'session-detail'));
          return (
            <TouchableOpacity
              key={item.id}
              testID={`nav-${item.id}`}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              style={styles.navItem}
              onPress={() => setPage(item.id)}>
              <Ionicons
                name={item.icon}
                size={22}
                color={
                  active
                    ? isDark
                      ? colors.darkTeal
                      : colors.teal
                    : isDark
                      ? colors.darkMuted
                      : colors.mutedInk
                }
              />
              <Text
                style={[
                  styles.navText,
                  isDark && { color: colors.darkMuted },
                  active && styles.navActive,
                  active && isDark && { color: colors.darkTeal },
                ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
