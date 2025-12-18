import { useState, useEffect } from "react";
import type { AudioSettings } from "../types/audioSettings";
import { DEFAULT_AUDIO_SETTINGS } from "../types/audioSettings";

export const useAudioSettings = () => {
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api || !api.getAudioSettings) return;

    // Initial load
    api.getAudioSettings()
      .then((data) => {
        setSettings(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load audio settings", err);
        setIsLoading(false);
      });

    // Subscribe to updates
    const unsubscribe = api.onAudioSettingsUpdated((updated) => {
      setSettings(updated);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const saveSettings = async (newSettings: AudioSettings) => {
    const api = window.electronAPI;
    if (!api || !api.saveAudioSettings) return;

    try {
      const saved = await api.saveAudioSettings(newSettings);
      setSettings(saved);
    } catch (e) {
      console.error("Failed to save audio settings", e);
    }
  };

  return {
    settings,
    isLoading,
    saveSettings,
  };
};


