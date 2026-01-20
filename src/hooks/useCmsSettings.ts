import { useEffect, useState } from 'react';
import type { CmsSettings } from '../types/cmsSettings';
import { logInfo, logError } from '../logs/logging';

interface UseCmsSettingsResult {
  settings: CmsSettings;
  updateSettings: (newSettings: CmsSettings) => Promise<void>;
  isLoading: boolean;
}

const DEFAULT_SETTINGS: CmsSettings = {
  enabled: true,
};

export function useCmsSettings(): UseCmsSettingsResult {
  const [settings, setSettings] = useState<CmsSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        if (!window.electronAPI?.getCmsSettings) {
          logInfo('CMS_SETTINGS', 'electronAPI.getCmsSettings is not available');
          if (isMounted) setIsLoading(false);
          return;
        }

        const loadedSettings = await window.electronAPI.getCmsSettings();
        if (isMounted) {
          setSettings(loadedSettings);
          setIsLoading(false);
          logInfo('CMS_SETTINGS', 'Loaded CMS settings', { enabled: loadedSettings.enabled });
        }
      } catch (error: any) {
        logError('CMS_SETTINGS', 'Failed to load CMS settings', { error: error?.message });
        if (isMounted) setIsLoading(false);
      }
    };

    loadSettings();

    const unsubscribe = window.electronAPI?.onCmsSettingsUpdated?.((updated) => {
      if (isMounted) {
        logInfo('CMS_SETTINGS', 'CMS settings updated', { enabled: updated.enabled });
        setSettings(updated);
      }
    });

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const updateSettings = async (newSettings: CmsSettings) => {
    try {
      if (window.electronAPI?.saveCmsSettings) {
        await window.electronAPI.saveCmsSettings(newSettings);
        setSettings(newSettings);
      }
    } catch (error: any) {
      logError('CMS_SETTINGS', 'Failed to save CMS settings', { error: error?.message });
      throw error;
    }
  };

  return { settings, updateSettings, isLoading };
}
