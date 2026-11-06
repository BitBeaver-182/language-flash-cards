import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PronunciationButton } from './PronunciationButton';
import {
  speakHungarianAsync,
  openHungarianVoiceSetupAsync,
} from '@/services/hungarianVoice.service';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useColorScheme', () => ({
  __esModule: true,
  default: () => ({ isDark: false }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/services/hungarianVoice.service', () => ({
  speakHungarianAsync: jest.fn(),
  openHungarianVoiceSetupAsync: jest.fn(),
  getHungarianVoiceStatusAsync: jest.fn(),
}));
afterEach(() => jest.restoreAllMocks());

it('plays the same Hungarian text at normal and slow speeds', async () => {
  jest.mocked(speakHungarianAsync).mockResolvedValue('started');
  await render(<PronunciationButton text="Beszélj!" />);
  await fireEvent.press(screen.getByTestId('pronounce-normal'));
  await fireEvent.press(screen.getByTestId('pronounce-slow'));
  await waitFor(() => expect(speakHungarianAsync).toHaveBeenCalledTimes(2));
  expect(speakHungarianAsync).toHaveBeenNthCalledWith(1, 'Beszélj!', false);
  expect(speakHungarianAsync).toHaveBeenNthCalledWith(2, 'Beszélj!', true);
});

it('offers system setup when no offline Hungarian voice is installed', async () => {
  jest.mocked(speakHungarianAsync).mockResolvedValue('missing');
  jest.mocked(openHungarianVoiceSetupAsync).mockResolvedValue(true);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(<PronunciationButton text="alma" />);
  await fireEvent.press(screen.getByTestId('pronounce-normal'));
  await waitFor(() => expect(alert).toHaveBeenCalled());
  const buttons = alert.mock.calls[0][2];
  expect(alert.mock.calls[0][1]).toBe('voice.missing');
  buttons?.find(button => button.text === 'voice.openSetup')?.onPress?.();
  expect(openHungarianVoiceSetupAsync).toHaveBeenCalled();
});

it('explains that an unsupported engine cannot play without pretending success', async () => {
  jest.mocked(speakHungarianAsync).mockResolvedValue('unavailable');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(<PronunciationButton text="alma" />);
  await fireEvent.press(screen.getByTestId('pronounce-normal'));
  await waitFor(() => expect(alert).toHaveBeenCalledWith('voice.title', 'voice.unavailable'));
});
