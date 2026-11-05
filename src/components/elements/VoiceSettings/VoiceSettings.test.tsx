import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { VoiceSettings } from './VoiceSettings';
import {
  getHungarianVoiceStatusAsync,
  openHungarianVoiceSetupAsync,
  speakHungarianAsync,
} from '@/services/hungarianVoice.service';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useColorScheme', () => ({
  __esModule: true,
  default: () => ({ isDark: false }),
}));
jest.mock('@/services/hungarianVoice.service', () => ({
  getHungarianVoiceStatusAsync: jest.fn(),
  openHungarianVoiceSetupAsync: jest.fn(),
  speakHungarianAsync: jest.fn(),
}));

it('shows missing voice setup and rechecks until a voice is ready', async () => {
  jest
    .mocked(getHungarianVoiceStatusAsync)
    .mockResolvedValueOnce('missing')
    .mockResolvedValue('ready');
  jest.mocked(openHungarianVoiceSetupAsync).mockResolvedValue(true);
  jest.mocked(speakHungarianAsync).mockResolvedValue('started');
  await render(<VoiceSettings />);
  await screen.findByText('voice.status.missing');
  await fireEvent.press(screen.getByTestId('voice-setup'));
  await waitFor(() => expect(openHungarianVoiceSetupAsync).toHaveBeenCalled());
  await fireEvent.press(screen.getByTestId('voice-recheck'));
  await screen.findByText('voice.status.ready');
  await fireEvent.press(screen.getByTestId('voice-test'));
  await waitFor(() => expect(speakHungarianAsync).toHaveBeenCalledWith('Szia!', false));
});
