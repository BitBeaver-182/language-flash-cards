import React from 'react';
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Provider } from 'react-redux';
import store from '@/utils/store';
import Home from './Home';
import { Alert } from 'react-native';
import {
  backupRestored,
  initialLearningState,
  languageChanged,
  vocabularyImported,
} from '@/slices/learning.slice';
import * as sessionUtils from '@/utils/session';
import * as vocabularyFiles from '@/services/vocabularyFile.service';
import { createBackupPackage, pickBackupFileAsync } from '@/services/backup.service';
import i18n from '@/i18n';

function freshLearningState() {
  return {
    ...initialLearningState,
    words: Object.fromEntries(
      Object.entries(initialLearningState.words).map(([id, word]) => [
        id,
        { ...word, tags: [...word.tags] },
      ]),
    ),
  };
}

beforeEach(() => {
  store.dispatch(backupRestored(freshLearningState()));
  store.dispatch(languageChanged('en'));
  void i18n.changeLanguage('en');
});
afterEach(() => jest.restoreAllMocks());

jest.mock('@/hooks/useLearningPersistence', () => ({ useLearningPersistence: () => true }));
jest.mock('@/services/backup.service', () => ({
  ...jest.requireActual('@/services/backup.service'),
  pickBackupFileAsync: jest.fn(),
  exportBackupFileAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => `test-${Math.random()}` }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/services/reminders.service', () => ({
  syncRemindersAsync: jest.fn(async () => 'disabled'),
}));
jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: () => ({ remove: jest.fn() }),
  getLastNotificationResponseAsync: jest.fn(async () => null),
}));

it('starts a review and reveals a translation', async () => {
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  await userEvent.press(screen.getByText('Start practice'));
  await userEvent.press(screen.getByText('Begin session'));
  await userEvent.press(screen.getByText('Show answer'));
  expect(screen.getByText('I remembered')).toBeTruthy();
});

it('shows how many words are in active learning', async () => {
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  expect(screen.getByTestId('learning-count')).toHaveTextContent('Learning 0 / 36');
});

it('starts practice using only words from the selected topic', async () => {
  const select = jest.spyOn(sessionUtils, 'selectWords');
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  await userEvent.press(screen.getByText('Start practice'));
  await userEvent.type(screen.getByTestId('search-tags'), 'Vegetables');
  await userEvent.press(screen.getByText('Vegetables'));
  await userEvent.press(screen.getByText('Begin session'));
  const chosen = select.mock.results[0].value as ReturnType<typeof sessionUtils.selectWords>;
  expect(chosen.length).toBeGreaterThan(0);
  expect(chosen.every(word => word.tags.includes('Vegetables'))).toBe(true);
});

it('switches support language and removes a practiced word', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find(button => button.style === 'destructive')?.onPress?.();
  });
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  const user = userEvent.setup();
  await user.press(screen.getByText('Settings'));
  await user.press(screen.getByText('Español'));
  await user.press(screen.getByText('Inicio'));
  await user.press(screen.getByText('Practicar'));
  await user.press(screen.getByText('Comenzar sesión'));
  await user.press(screen.getByText('Quitar de práctica'));
  await user.press(screen.getByText('Inicio'));
  await user.press(screen.getByText('Mis palabras'));
  await user.press(screen.getByText('Ver quitadas'));
  expect(screen.getAllByText('Restaurar').length).toBeGreaterThan(0);
});

it('shows bottom navigation and asks before removing a word', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  expect(screen.getByTestId('nav-words')).toBeTruthy();
  await userEvent.press(screen.getByText('Start practice'));
  await userEvent.press(screen.getByText('Begin session'));
  await userEvent.press(screen.getByTestId('remove-word'));
  expect(alert).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(String),
    expect.arrayContaining([
      expect.objectContaining({ style: 'cancel' }),
      expect.objectContaining({ style: 'destructive' }),
    ]),
  );
  alert.mockRestore();
});

it('shows weekly progress and records a completed session', async () => {
  jest.spyOn(sessionUtils, 'selectWords').mockReturnValue([
    {
      id: 'test-word',
      hu: 'alma',
      en: 'apple',
      es: 'manzana',
      tags: [],
      eligible: true,
    },
  ]);
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  expect(screen.getByText('This week')).toBeTruthy();
  expect(screen.queryByText('Choose a practice topic')).toBeNull();
  await userEvent.press(screen.getByText('Start practice'));
  expect(screen.getByText('Choose a tag')).toBeTruthy();
  await userEvent.press(screen.getByText('Begin session'));
  await userEvent.press(screen.getByText('Show answer'));
  await userEvent.press(screen.getByText('I remembered'));
  expect(screen.getByText('Session complete!')).toBeTruthy();
  await userEvent.press(screen.getByTestId('nav-home'));
  expect(screen.getByText('1 / 1 sessions')).toBeTruthy();
  await userEvent.press(screen.getByText(/View previous sessions/));
  expect(screen.getByText('1 / 1 correct')).toBeTruthy();
  await userEvent.press(screen.getByText('1 / 1 correct'));
  expect(screen.getByText('Session details')).toBeTruthy();
  expect(screen.getByText('Expected: apple')).toBeTruthy();
  expect(screen.getByText('Your answer: Remembered (self-assessed)')).toBeTruthy();
});

it('searches words and their editable tags and exposes the rest of the dictionary', async () => {
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  const user = userEvent.setup();
  await user.press(screen.getByTestId('nav-words'));
  expect(screen.getByTestId('dictionary-list')).toBeTruthy();
  await user.type(screen.getByPlaceholderText('Search words or tags'), 'répa');
  await user.press(screen.getAllByText('Edit tags')[0]);
  const field = screen.getByLabelText('Tags separated by commas');
  await user.clear(field);
  await user.type(field, 'garden');
  await user.press(screen.getByText('Save tags'));
  const search = screen.getByPlaceholderText('Search words or tags');
  await user.clear(search);
  await user.type(search, 'garden');
  expect(screen.getByText('Répa')).toBeTruthy();
});

it('keeps dictionary rendering bounded when switching sort order', async () => {
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  const user = userEvent.setup();
  await user.press(screen.getByTestId('nav-words'));
  await user.press(screen.getByText('Sort: alphabetically'));
  expect(screen.getAllByText('Edit tags').length).toBeLessThanOrEqual(20);
});

it('offers a back-to-top control after scrolling the dictionary', async () => {
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  await userEvent.press(screen.getByTestId('nav-words'));
  expect(screen.queryByTestId('scroll-to-top')).toBeNull();
  await fireEvent.scroll(screen.getByTestId('dictionary-list'), {
    nativeEvent: {
      contentOffset: { x: 0, y: 700 },
      contentSize: { width: 400, height: 2000 },
      layoutMeasurement: { width: 400, height: 800 },
    },
  });
  expect(screen.getByLabelText('Back to top')).toBeTruthy();
});

it('adds a local word that can be found without accents', async () => {
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  const user = userEvent.setup();
  await user.press(screen.getByTestId('nav-settings'));
  await user.press(screen.getByText('Add word'));
  await user.type(screen.getByLabelText('Hungarian'), 'különleges próbaszó');
  await user.type(screen.getByLabelText('English'), 'special');
  await user.type(screen.getByLabelText('Español'), 'especial');
  await user.press(screen.getByText('Save word'));
  await user.press(screen.getByTestId('nav-words'));
  await user.type(screen.getByPlaceholderText('Search words or tags'), 'kulonleges probaszo');
  expect(screen.getByText('különleges próbaszó')).toBeTruthy();
});

it('accepts a translation in any supported language', async () => {
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  const user = userEvent.setup();
  await user.press(screen.getByTestId('nav-settings'));
  await user.press(screen.getByText('Add word'));
  await user.type(screen.getByLabelText('Hungarian'), 'szlovák szó');
  await user.type(screen.getByLabelText('Slovenčina'), 'slovenské slovo');
  await user.press(screen.getByText('Save word'));
  const saved = Object.values(store.getState().learning.words).find(
    word => word.hu === 'szlovák szó',
  );
  expect(saved?.translations?.sk).toBe('slovenské slovo');
  await user.press(screen.getByTestId('nav-words'));
  await user.type(screen.getByPlaceholderText('Search words or tags'), 'slovenske');
  expect(screen.getByText('szlovák szó')).toBeTruthy();
});

it('merges a duplicate word that only has a third-language meaning', async () => {
  store.dispatch(
    vocabularyImported([
      {
        id: 'sk-merge',
        hu: 'slovenské slovo',
        en: '',
        es: '',
        translations: { sk: 'prvý význam' },
        tags: [],
        removed: false,
      },
    ]),
  );
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  const user = userEvent.setup();
  await user.press(screen.getByTestId('nav-settings'));
  await user.press(screen.getByText('Add word'));
  await user.type(screen.getByLabelText('Hungarian'), 'slovenské slovo');
  await user.type(screen.getByLabelText('Slovenčina'), 'druhý význam');
  await user.press(screen.getByText('Save word'));
  expect(screen.getByText('Review Slovak meanings')).toBeTruthy();
  await user.press(screen.getByText('Next'));
  await user.press(screen.getByText('Merge word'));
  expect(store.getState().learning.words['sk-merge'].translations?.sk).toBe(
    'prvý význam\ndruhý význam',
  );
});

it('keeps vocabulary management in settings and cancels an unsaved word', async () => {
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  const user = userEvent.setup();
  await user.press(screen.getByTestId('nav-words'));
  expect(screen.queryByText('Add word')).toBeNull();
  expect(screen.queryByText('Import CSV')).toBeNull();
  await user.press(screen.getByTestId('nav-settings'));
  expect(screen.getByText('Export CSV')).toBeTruthy();
  await user.press(screen.getByText('Add word'));
  await user.type(screen.getByLabelText('Hungarian'), 'lemondott');
  await user.press(screen.getByText('Cancel'));
  expect(screen.queryByLabelText('Hungarian')).toBeNull();
  await user.press(screen.getByText('Add word'));
  expect(screen.getByLabelText('Hungarian').props.value).toBe('');
});

it('guides a duplicate through meanings and tags before saving', async () => {
  store.dispatch(
    vocabularyImported([
      {
        id: 'merge-test',
        hu: 'tesztösszevonás',
        en: 'old meaning',
        es: 'significado viejo',
        tags: ['old tag'],
        removed: false,
      },
    ]),
  );
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  const user = userEvent.setup();
  await user.press(screen.getByTestId('nav-settings'));
  await user.press(screen.getByText('Add word'));
  await user.type(screen.getByLabelText('Hungarian'), 'Tesztösszevonás');
  await user.type(screen.getByLabelText('English'), 'new meaning');
  await user.type(screen.getByLabelText('Español'), 'significado nuevo');
  await user.type(screen.getByLabelText('Tags separated by commas'), 'new tag');
  await user.press(screen.getByText('Save word'));
  expect(screen.getByText('Review English meanings')).toBeTruthy();
  await user.press(screen.getByText('Next'));
  expect(screen.getByText('Review Spanish meanings')).toBeTruthy();
  await user.press(screen.getByText('Next'));
  await user.press(screen.getByLabelText('Remove tag old tag'));
  await user.press(screen.getByText('Merge word'));
  const state = store.getState().learning;
  expect(state.words['merge-test'].en).toBe('old meaning\nnew meaning');
  expect(state.words['merge-test'].tags).toEqual(['new tag']);
});

it('exports vocabulary from settings', async () => {
  const exportFile = jest.spyOn(vocabularyFiles, 'exportVocabularyFileAsync').mockResolvedValue();
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  await userEvent.press(screen.getByTestId('nav-settings'));
  await userEvent.press(screen.getByText('Export CSV'));
  expect(exportFile).toHaveBeenCalledWith(
    expect.stringContaining('id,hungarian,english,spanish,tags,removed'),
  );
});

it('persists a restored backup before reporting success', async () => {
  const events: string[] = [];
  const restored = { ...freshLearningState(), dailyGoal: 9 };
  (pickBackupFileAsync as jest.Mock).mockResolvedValue(createBackupPackage(restored));
  jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async () => {
    events.push('persist');
  });
  jest.spyOn(Alert, 'alert').mockImplementation((_title, message, buttons) => {
    if (message) events.push(`alert:${message}`);
    buttons?.find(button => button.style === 'destructive')?.onPress?.();
  });
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  await userEvent.press(screen.getByTestId('nav-settings'));
  await userEvent.press(screen.getByText('Restore from backup'));
  await waitFor(() => expect(store.getState().learning.dailyGoal).toBe(9));
  expect(events).toContain('persist');
  expect(events.indexOf('persist')).toBeLessThan(
    events.indexOf('alert:Backup restored successfully.'),
  );
});

it('rejects CSV imports that would create a duplicate instead of overwriting a card', async () => {
  store.dispatch(
    vocabularyImported([
      {
        id: 'csv-existing',
        hu: 'tesztütközés',
        en: 'original',
        es: 'original',
        tags: [],
        removed: false,
      },
    ]),
  );
  jest
    .spyOn(vocabularyFiles, 'pickVocabularyFileAsync')
    .mockResolvedValue(
      'id,hungarian,english,spanish,tags,removed\nnew-id,Tesztütközés,changed,cambiado,,false',
    );
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  await userEvent.press(screen.getByTestId('nav-settings'));
  await userEvent.press(screen.getByText('Import CSV'));
  expect(alert).toHaveBeenCalledWith(
    'Could not import',
    expect.stringContaining('duplicate words'),
  );
  expect(store.getState().learning.words['csv-existing'].en).toBe('original');
});

it('presents multiple choice for recognition cards with capitalized options', async () => {
  jest.spyOn(sessionUtils, 'selectWords').mockReturnValue([
    {
      id: 'w1',
      hu: 'répa',
      en: 'carrot',
      es: 'zanahoria',
      tags: ['Vegetables'],
      eligible: true,
    },
    {
      id: 'w2',
      hu: 'krumpli',
      en: 'potato',
      es: 'papa',
      tags: ['Vegetables'],
      eligible: true,
    },
    {
      id: 'w3',
      hu: 'hagyma',
      en: 'onion',
      es: 'cebolla',
      tags: ['Vegetables'],
      eligible: true,
    },
  ]);
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  await userEvent.press(screen.getByText('Start practice'));
  await userEvent.press(screen.getByText('Begin session'));
  // Card 0 is recall
  await userEvent.press(screen.getByText('Show answer'));
  await userEvent.press(screen.getByText('I remembered'));

  // Card 1 is multiple choice (index 1 % 3 === 1)
  expect(screen.getByText('Choose the meaning')).toBeTruthy();
  expect(screen.getByText('Potato')).toBeTruthy();
  await userEvent.press(screen.getByText('Potato'));
  expect(screen.getByText('Nice!')).toBeTruthy();
  await userEvent.press(screen.getByText('Continue'));
});

it('does not count a removed word as practiced or replace it with a new word', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find(button => button.style === 'destructive')?.onPress?.();
  });
  const select = jest.spyOn(sessionUtils, 'selectWords');
  await render(
    <Provider store={store}>
      <Home />
    </Provider>,
  );
  await userEvent.press(screen.getByText('Start practice'));
  await userEvent.press(screen.getByText('Begin session'));
  expect(screen.getByText(/1 \/ 10/)).toBeTruthy();
  await userEvent.press(screen.getByTestId('remove-word'));
  expect(screen.getByText(/1 \/ 9/)).toBeTruthy();
  expect(select).toHaveBeenCalledTimes(1);
  expect(store.getState().learning.sessions).toHaveLength(0);
});
