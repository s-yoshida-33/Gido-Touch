import { useEffect, useState } from 'react';
import type { CmsSettings } from '../types/cmsSettings';
import { logInfo, logError } from '../logs/logging';
import { loadMallSettings, saveMallSettings } from '../utils/settings';
import type { MallId } from '../utils/settings';

interface UseCmsSettingsResult {
  settings: CmsSettings;
  updateSettings: (newSettings: CmsSettings) => Promise<void>;
  isLoading: boolean;
}

const DEFAULT_SETTINGS: CmsSettings = {
  enabled: true,
  categorySearchEnabled: true,
};

export function useCmsSettings(mallId: MallId = 'suzaka'): UseCmsSettingsResult {
  const [settings, setSettings] = useState<CmsSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const mallSettings = await loadMallSettings(mallId);
        if (isMounted) {
          setSettings(mallSettings.cmsSettings);
          setIsLoading(false);
          logInfo('CMS_SETTINGS', 'Loaded CMS settings', { enabled: mallSettings.cmsSettings.enabled });
        }
      } catch (error: any) {
        logError('CMS_SETTINGS', 'Failed to load CMS settings', { error: error?.message });
        if (isMounted) setIsLoading(false);
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [mallId]);

  const updateSettings = async (newSettings: CmsSettings) => {
    try {
      const mallSettings = await loadMallSettings(mallId);
      mallSettings.cmsSettings = newSettings;
      await saveMallSettings(mallId, mallSettings);
      setSettings(newSettings);
      logInfo('CMS_SETTINGS', 'CMS settings saved', { enabled: newSettings.enabled });
    } catch (error: any) {
      logError('CMS_SETTINGS', 'Failed to save CMS settings', { error: error?.message });
      throw error;
    }
  };

  return { settings, updateSettings, isLoading };
}
