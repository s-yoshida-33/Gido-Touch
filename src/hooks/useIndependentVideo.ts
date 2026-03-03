// src/hooks/useIndependentVideo.ts
import { useEffect, useState } from 'react';
import type { VideoSettings } from '../types/videoSettings';
import { logInfo, logWarn, logError } from '../logs/logging';
import { loadMallSettings, saveMallSettings } from '../utils/settings';
import type { MallId } from '../utils/settings';

interface UseIndependentVideoResult {
  videoSettings: VideoSettings | null;
  isLoading: boolean;
  saveVideoSettings: (settings: VideoSettings) => Promise<void>;
}

/**
 * Fetches independent video settings from per-mall settings file.
 * This is separate from CMS (WSP) video content.
 */
export function useIndependentVideo(mallId: MallId = 'suzaka'): UseIndependentVideoResult {
  const [videoSettings, setVideoSettings] = useState<VideoSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const loadVideoSettings = async () => {
      try {
        const mallSettings = await loadMallSettings(mallId);
        
        if (!isMounted) return;

        logInfo('VIDEO', 'Loaded independent video settings', {
          enabled: mallSettings.videoSettings.enabled,
          hasSource: !!mallSettings.videoSettings.source,
        });

        setVideoSettings(mallSettings.videoSettings);
        setIsLoading(false);
      } catch (error: any) {
        logError('VIDEO', 'Failed to load independent video settings', {
          error: error?.message,
        });
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadVideoSettings();

    return () => {
      isMounted = false;
    };
  }, [mallId]);

  const saveVideoSettings = async (settings: VideoSettings) => {
    try {
      const mallSettings = await loadMallSettings(mallId);
      mallSettings.videoSettings = settings;
      await saveMallSettings(mallId, mallSettings);
      setVideoSettings(settings);
      logInfo('VIDEO', 'Video settings saved', { enabled: settings.enabled });
    } catch (error: any) {
      logError('VIDEO', 'Failed to save video settings', { error: error?.message });
    }
  };

  return { videoSettings, isLoading, saveVideoSettings };
}





