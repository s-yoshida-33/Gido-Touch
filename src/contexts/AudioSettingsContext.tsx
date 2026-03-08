import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AudioSettings } from '../types/audioSettings';
import { DEFAULT_AUDIO_SETTINGS } from '../types/audioSettings';
import { loadMallSettings, saveMallSettings } from '../utils/settings';
import { useMall } from './MallContext';

interface AudioSettingsContextType {
  audioSettings: AudioSettings;
  setAudioSettings: (settings: AudioSettings) => void;
  saveAudioSettings: (settings: AudioSettings) => Promise<void>;
  isLoading: boolean;
}

const AudioSettingsContext = createContext<AudioSettingsContextType>({
  audioSettings: DEFAULT_AUDIO_SETTINGS,
  setAudioSettings: () => {},
  saveAudioSettings: async () => {},
  isLoading: true,
});

export const AudioSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { mallId } = useMall();
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load audio settings when mallId changes
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const mallSettings = await loadMallSettings(mallId);
        setAudioSettings(mallSettings.audioSettings);
      } catch (err) {
        console.error('Failed to load audio settings', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [mallId]);

  // Save audio settings to file and update state immediately
  const saveAudioSettings = useCallback(async (newSettings: AudioSettings) => {
    // Update state immediately for instant UI feedback
    setAudioSettings(newSettings);
    try {
      const mallSettings = await loadMallSettings(mallId);
      mallSettings.audioSettings = newSettings;
      await saveMallSettings(mallId, mallSettings);
    } catch (e) {
      console.error('Failed to save audio settings', e);
    }
  }, [mallId]);

  return (
    <AudioSettingsContext.Provider value={{ audioSettings, setAudioSettings, saveAudioSettings, isLoading }}>
      {children}
    </AudioSettingsContext.Provider>
  );
};

export const useAudioSettingsContext = () => useContext(AudioSettingsContext);
