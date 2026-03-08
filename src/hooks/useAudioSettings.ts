import { useState, useEffect } from "react";
import type { AudioSettings } from "../types/audioSettings";
import { DEFAULT_AUDIO_SETTINGS } from "../types/audioSettings";
import { loadMallSettings, saveMallSettings } from "../utils/settings";
import type { MallId } from "../utils/settings";

export const useAudioSettings = (mallId: MallId = 'suzaka') => {
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const mallSettings = await loadMallSettings(mallId);
        setSettings(mallSettings.audioSettings);
      } catch (err) {
        console.error("Failed to load audio settings", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [mallId]);

  const saveSettings = async (newSettings: AudioSettings) => {
    try {
      const mallSettings = await loadMallSettings(mallId);
      mallSettings.audioSettings = newSettings;
      await saveMallSettings(mallId, mallSettings);
      setSettings(newSettings);
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


