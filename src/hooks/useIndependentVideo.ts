// src/hooks/useIndependentVideo.ts
import { useEffect, useState } from 'react';
import type { VideoSettings } from '../types/videoSettings';
import { logInfo, logWarn, logError } from '../logs/logging';

interface UseIndependentVideoResult {
  videoSettings: VideoSettings | null;
  isLoading: boolean;
}

/**
 * Fetches independent video settings from Electron IPC.
 * This is separate from CMS (WSP) video content.
 */
export function useIndependentVideo(): UseIndependentVideoResult {
  const [videoSettings, setVideoSettings] = useState<VideoSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const loadVideoSettings = async () => {
      try {
        if (!window.electronAPI?.getVideoSettings) {
          logWarn('video', 'electronAPI.getVideoSettings is not available');
          if (isMounted) {
            setIsLoading(false);
          }
          return;
        }

        const settings = await window.electronAPI.getVideoSettings();
        
        if (!isMounted) return;

        logInfo('video', 'Loaded independent video settings', {
          enabled: settings.enabled,
          hasSource: !!settings.source,
        });

        setVideoSettings(settings);
        setIsLoading(false);
      } catch (error: any) {
        logError('video', 'Failed to load independent video settings', {
          error: error?.message,
        });
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadVideoSettings();

    // Listen for settings updates
    const unsubscribe = window.electronAPI?.onVideoSettingsUpdated?.((updated) => {
      if (isMounted) {
        logInfo('video', 'Independent video settings updated', {
          enabled: updated.enabled,
          hasSource: !!updated.source,
        });
        setVideoSettings(updated);
      }
    });

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return { videoSettings, isLoading };
}





