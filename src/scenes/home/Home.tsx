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
import { recentAccuracy } from '@/utils/recall';
import {
  countActiveWords,
  MAX_ACTIVE_WORDS,
  selectReplacement,
  selectWords,
} from '@/utils/session';
import { makeChoices } from '@/utils/choices';
import { getReminderMinutes } from '@/utils/reminderSchedule';
import { getWeekProgress, summarizeSessions } from '@/utils/sessionHistory';
import { Word, getWordMeaning } from '@/utils/vocabulary';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';
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
  buttonSelected: {
    borderWidth: 3,
    borderColor: colors.white,
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
  dark,
  score = false,
}: {
  value: number | null;
  dark: boolean;
  score?: boolean;
}) {
  const { t } = useTranslation();
  const label = value === null ? t('practice.notAssessed') : `${value}%`;
  const circumference = 2 * Math.PI * 23;
  return (
    <View
      style={styles.badge}
      accessible
      accessibilityLabel={
        value === null
          ? label
          : `${label} ${score ? t('practice.correctAnswers') : t('practice.estimatedRecall')}`
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
    answerHistory,
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
  const [sessionStartProgress, setSessionStartProgress] = useState(progress);
  const [sessionStartHistory, setSessionStartHistory] = useState(answerHistory ?? []);
  const [sessionStats, setSessionStats] = useState<{
    id: string;
    correct: number;
    total: number;
    topic: string;
    answers: SessionAnswer[];
  }>({ id: '', correct: 0, total: 0, topic: '', answers: [] });
  const { t, i18n } = useTranslation();
  const es = i18n.language === 'es';
  const locale = i18n.language;
  const words = useMemo(() => Object.values(userWords), [userWords]);
  const activeLearning = useMemo(() => countActiveWords(words, progress), [words, progress]);
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
    return makeChoices(word, words, language, { progress });
  }, [word, index, language, words, progress]);
  useEffect(() => {
    if (language) void i18n.changeLanguage(language);
  }, [language, i18n]);
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
        setSessionStartProgress(progress);
        setSessionStartHistory(answerHistory ?? []);
        setQueue(
          selectWords(words, progress, new Date(), undefined, { history: answerHistory ?? [] }),
        );
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
  }, [progress, words, answerHistory]);

  function button(label: string, onPress: () => void, testID?: string, selected?: boolean) {
    return (
      <TouchableOpacity
        key={label}
        accessibilityRole="button"
        accessibilityState={selected === undefined ? undefined : { selected }}
        testID={testID}
        style={[styles.button, selected && styles.buttonSelected]}
        onPress={onPress}>
        <Text style={styles.buttonText}>{label}</Text>
      </TouchableOpacity>
    );
  }
  function start() {
    setSessionStartProgress(progress);
    setSessionStartHistory(answerHistory ?? []);
    setQueue(
      selectWords(words, progress, new Date(), topic || undefined, {
        history: answerHistory ?? [],
      }),
    );
    setSessionStats({ id: createSessionId(), correct: 0, total: 0, topic, answers: [] });
    setIndex(0);
    setRevealed(false);
    setChoiceResult(null);
    setPage('practice');
  }
  function confirmRemoval(target: Word, onConfirm: () => void) {
    Alert.alert(
      t('dictionary.removeConfirmTitle'),
      t('dictionary.removeConfirmMessage', { word: target.hu }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('dictionary.remove'), style: 'destructive', onPress: onConfirm },
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
          expected: sentence ? word.hu : getWordMeaning(word, language),
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
        <Text style={styles.text}>{t('common.loading')}</Text>
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
            Magyar · {t('vocabulary.title')}
          </Text>
          {page === 'home' && (
            <>
              <View style={[styles.wordRow, isDark && { backgroundColor: colors.darkSurface }]}>
                <Text style={[styles.sectionTitle, isDark && { color: colors.white }]}>
                  {t('practice.thisWeek')}
                </Text>
                <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                  {t('settings.dailyGoal')}: {dailyGoal}{' '}
                  {dailyGoal === 1 ? t('practice.session') : t('practice.sessions')}
                </Text>
                <Text
                  testID="learning-count"
                  style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                  {t('practice.learningCount', {
                    active: activeLearning,
                    max: MAX_ACTIVE_WORDS,
                  })}
                </Text>
                <View style={styles.weekRow}>
                  {week.map(day => (
                    <View
                      key={day.date.toISOString()}
                      style={styles.day}
                      accessible
                      accessibilityLabel={`${day.date.toLocaleDateString(locale, { weekday: 'long' })}: ${day.count} ${t('practice.sessions')}`}>
                      <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                        {day.date
                          .toLocaleDateString(locale, { weekday: 'short' })
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
                  {t('practice.today')}
                </Text>
                <View style={styles.statRow}>
                  <View>
                    <Text style={textStyle}>
                      {todaySummary.sessions} / {dailyGoal} {t('practice.sessions')}
                    </Text>
                    <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                      {todaySummary.total
                        ? `${todaySummary.correct} / ${todaySummary.total} ${t('practice.correctAnswers')}`
                        : t('practice.noSessionsYet')}
                    </Text>
                  </View>
                  <MasteryBadge
                    value={
                      todaySummary.total
                        ? Math.round((todaySummary.correct / todaySummary.total) * 100)
                        : null
                    }
                    dark={isDark}
                    score
                  />
                </View>
              </View>
              {button(
                t('practice.startPractice'),
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
                <Text style={textStyle}>{t('practice.viewPreviousSessions')} ›</Text>
                <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                  {t('practice.seeCompletedSessions')}
                </Text>
              </TouchableOpacity>
            </>
          )}
          {page === 'topics' && (
            <>
              <Text style={[styles.sectionTitle, isDark && { color: colors.white }]}>
                {t('practice.chooseTag')}
              </Text>
              <Text style={textStyle}>{t('practice.chooseTagHint')}</Text>
              {button(t('practice.beginSession'), () => start(), 'begin-session')}
              <TextInput
                testID="search-tags"
                accessibilityLabel={t('practice.searchTags')}
                placeholder={t('practice.searchTags')}
                placeholderTextColor={colors.gray}
                style={[
                  styles.input,
                  isDark && { color: colors.white, backgroundColor: colors.darkSurface },
                ]}
                value={tagQuery}
                onChangeText={setTagQuery}
              />
              <Text style={textStyle}>{t('practice.searchTagsHint')}</Text>
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
                    {item || t('practice.allWords')}
                    {topic === item ? '  ✓' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          {page === 'history' && (
            <>
              <Text style={[styles.sectionTitle, isDark && { color: colors.white }]}>
                {t('practice.previousSessions')}
              </Text>
              {sessions.length === 0 ? (
                <Text style={textStyle}>{t('practice.previousSessionsEmpty')}</Text>
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
                          <Text style={textStyle}>{session.topic || t('practice.allWords')}</Text>
                          <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                            {new Date(session.completedAt).toLocaleString(locale, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </Text>
                          <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                            {session.correct} / {session.total} {t('practice.correct')}
                          </Text>
                        </View>
                        <MasteryBadge
                          value={Math.round((session.correct / session.total) * 100)}
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
                    {t('practice.sessionDetails')}
                  </Text>
                  {button(t('practice.backToSessions'), () => setPage('history'))}
                  {!session?.answers?.length ? (
                    <Text style={textStyle}>{t('practice.answersUnavailable')}</Text>
                  ) : (
                    session.answers.map((entry, answerIndex) => (
                      <View
                        key={`${entry.wordId}-${answerIndex}`}
                        style={[styles.wordRow, isDark && { backgroundColor: colors.darkSurface }]}>
                        <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                          {entry.kind === 'sentence'
                            ? t('practice.kindSentence')
                            : entry.kind === 'phrase'
                              ? t('practice.kindPhrase')
                              : t('practice.kindWord')}
                        </Text>
                        <Text style={textStyle}>{entry.prompt}</Text>
                        <Text style={textStyle}>
                          {t('practice.expected')}: {entry.expected}
                        </Text>
                        <Text style={textStyle}>
                          {t('practice.yourAnswer')}:{' '}
                          {entry.answer === 'remembered'
                            ? t('practice.rememberedSelf')
                            : entry.answer === 'forgot'
                              ? t('practice.forgotSelf')
                              : entry.answer}
                        </Text>
                        <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                          {entry.correct ? t('practice.correctLabel') : t('practice.needsReview')}
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
                  {t('practice.title')} · {index + 1} / {queue.length}
                </Text>
                <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                  {choices.length > 0
                    ? t('practice.multipleChoiceHint')
                    : sentence
                      ? t('practice.sentenceHint')
                      : t('practice.recallHint')}
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
                        <Text
                          style={styles.word}
                          accessibilityLabel={getWordMeaning(word, language)}>
                          {visuals[word.hu.toLocaleLowerCase()]}
                        </Text>
                      ) : null}
                    </>
                  )}
                  <Text style={textStyle}>
                    {recentAccuracy(progress[word.id]) === null
                      ? t('practice.notAssessed')
                      : `${recentAccuracy(progress[word.id])!.percent}% ${t('practice.recentAccuracy')} · ${recentAccuracy(progress[word.id])!.correct}/${recentAccuracy(progress[word.id])!.total}`}
                  </Text>
                </View>
                {choices.length > 0 ? (
                  choiceResult === null ? (
                    <>
                      <Text style={textStyle}>{t('practice.chooseMeaning')}</Text>
                      {choices.map(choice => (
                        <TouchableOpacity
                          key={choice}
                          accessibilityRole="button"
                          style={[styles.option, isDark && { backgroundColor: colors.darkSurface }]}
                          onPress={() => {
                            setChoiceAnswer(choice);
                            const meanings = getWordMeaning(word, language)
                              .split('\n')
                              .map(value => value.trim().toLowerCase())
                              .filter(Boolean);
                            setChoiceResult(meanings.includes(choice.trim().toLowerCase()));
                          }}>
                          <Text style={textStyle}>{choice}</Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  ) : (
                    <>
                      <Text style={textStyle}>
                        {choiceResult
                          ? t('practice.nice')
                          : `${t('practice.answerLabel')}: ${getWordMeaning(word, language)}`}
                      </Text>
                      {button(t('common.continue'), () => answer(choiceResult, 'recognition'))}
                    </>
                  )
                ) : revealed ? (
                  <>
                    {(sentence ? [word.hu] : getWordMeaning(word, language).split('\n')).map(
                      meaning => (
                        <Text key={meaning} style={textStyle}>
                          {getWordMeaning(word, language).includes('\n') && !sentence ? '• ' : ''}
                          {meaning}
                        </Text>
                      ),
                    )}
                    {button(t('practice.iRemembered'), () => answer(true))}
                    {button(t('practice.iForgot'), () => answer(false))}
                  </>
                ) : (
                  button(t('practice.showAnswer'), () => setRevealed(true))
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
                          itemIndex < index ||
                          item.hu.toLocaleLowerCase() !== word.hu.toLocaleLowerCase(),
                      );
                      const replacement = selectReplacement(
                        words,
                        progress,
                        sessionStartProgress,
                        nextQueue,
                        word,
                        new Date(),
                        sessionStats.topic || undefined,
                        sessionStartHistory,
                      );
                      if (replacement) nextQueue.splice(index, 0, replacement);
                      setQueue(nextQueue);
                      setRevealed(false);
                      setChoiceResult(null);
                      if (index >= nextQueue.length) finishSession();
                    })
                  }>
                  <Text style={[styles.dangerText, isDark && { color: colors.darkDanger }]}>
                    {t('practice.removeFromPractice')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={textStyle}>
                  {queue.length === 0 ? t('practice.noWords') : t('practice.sessionComplete')}
                </Text>
                {button(
                  queue.length === 0
                    ? t('practice.chooseAnotherTopic')
                    : t('practice.practiceMore'),
                  () => setPage('topics'),
                )}
              </>
            ))}
          {page === 'settings' && (
            <>
              <Text style={textStyle}>
                {t('settings.dailyGoal')}: {dailyGoal}
              </Text>
              <View style={styles.row}>
                {button('−', () => dispatch(dailyGoalChanged(dailyGoal - 1)))}
                {button('+', () => dispatch(dailyGoalChanged(dailyGoal + 1)))}
              </View>
              <Text style={textStyle}>{t('settings.supportLanguage')}</Text>
              <View style={styles.row}>
                {SUPPORTED_LANGUAGES.map(lang =>
                  button(
                    lang.nativeName,
                    () => {
                      dispatch(languageChanged(lang.code));
                      void i18n.changeLanguage(lang.code);
                    },
                    undefined,
                    language === lang.code,
                  ),
                )}
              </View>
              <View style={styles.statRow}>
                <Text style={textStyle}>{t('settings.remindMe')}</Text>
                <Switch
                  accessibilityLabel={t('settings.remindMe')}
                  value={remindersEnabled}
                  onValueChange={value => {
                    dispatch(remindersEnabledChanged(value));
                  }}
                />
              </View>
              <Text style={[styles.muted, isDark && { color: colors.darkMuted }]}>
                {remindersEnabled ? t('settings.remindersOn') : t('settings.remindersOff')}
              </Text>
              <Text style={textStyle}>{t('settings.quietHours')}</Text>
              {(['quietStart', 'quietEnd'] as const).map(key => (
                <View key={key}>
                  <Text style={textStyle}>
                    {key === 'quietStart' ? t('settings.from') : t('settings.until')}:{' '}
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
                  ? t('settings.permissionDenied')
                  : status === 'error'
                    ? t('settings.scheduleFailed')
                    : reminders.count > 0 &&
                        getReminderMinutes(
                          reminders.count,
                          reminders.quietStart,
                          reminders.quietEnd,
                        ).length === 0
                      ? t('settings.windowTooShort')
                      : ''}
              </Text>
              <VocabularyManagement />
            </>
          )}
        </ScrollView>
      )}
      <View style={[styles.nav, isDark && { backgroundColor: colors.darkSurface }]}>
        {[
          { id: 'home' as const, label: t('nav.home'), icon: 'home-outline' as const },
          {
            id: 'words' as const,
            label: t('nav.words'),
            icon: 'book-outline' as const,
          },
          {
            id: 'settings' as const,
            label: t('nav.settings'),
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
