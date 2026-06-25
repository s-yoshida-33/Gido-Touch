import { invoke } from '@tauri-apps/api/core';
import type { LocationIconSettingsPerFloor } from '../types/locationIcon';
import type { ImageSettings } from '../types/imageSettings';
import type { ShopPositionSettings } from '../types/shopPosition';
import type { GenreSettings } from '../types/genreSettings';
import type { CmsSettings } from '../types/cmsSettings';
import type { VideoSettings } from '../types/videoSettings';
import type { AudioSettings } from '../types/audioSettings';
import type { LocalMediaTextSettings, SubFloorSettings } from '../types/global';
import type { FloorLayoutPerFloor } from '../types/floorLayout';
import type { BlackScreenSettings } from '../types/blackScreenSettings';
import { DEFAULT_BLACK_SCREEN_SETTINGS } from '../types/blackScreenSettings';
import { DEFAULT_IMAGE_SETTINGS } from '../types/imageSettings';
import { DEFAULT_AUDIO_SETTINGS } from '../types/audioSettings';
import { DEFAULT_LOCATION_ICON_SETTINGS_PER_FLOOR } from '../config';
import { logInfo, logError } from '../logs/logging';
import type { PictoSettings } from '../types/picto';
import type { HalongBannerSettings } from '../types/bannerSettings';

// ============================================================================
// Type definitions
// ============================================================================

export type MallId = 'suzaka' | 'sendaikamisugi' | 'halong';

/**
 * Global app settings stored in settings.json.
 * Contains only the active mall selection and current floor.
 */
export interface GlobalSettings {
  mallId: MallId;
  floor: string;
  setupCompleted?: boolean;
  hostname?: string;
}

/**
 * Per-mall settings stored in [mallId]-settings.json.
 * Each mall has its own independent settings file.
 */
export interface MallSettingsFile {
  locationIcons: LocationIconSettingsPerFloor;
  shopPositions: ShopPositionSettings;
  imageSettings: ImageSettings;
  genreSettings: GenreSettings;
  cmsSettings: CmsSettings;
  videoSettings: VideoSettings;
  audioSettings: AudioSettings;
  displayFloors: string[];
  currentFloorSetting: string;
  localMediaTextSettings: LocalMediaTextSettings;
  subFloorSettings: SubFloorSettings;
  floorLayout: Record<string, { columns: number; rowsPerCol: number; perColumnRows?: number[]; perColumnPadding?: { top?: number; right?: number; bottom?: number; left?: number; }[] }>;
  blackScreenSettings: BlackScreenSettings;
  shopDataMode: 'api' | 'local';
  pictoSettings?: PictoSettings;
  bannerSettings?: HalongBannerSettings;
}

/** Legacy settings structure for migration */
interface LegacySettings {
  mallId?: string;
  floor?: string;
  locationIcons?: LocationIconSettingsPerFloor;
  shopPositions?: ShopPositionSettings;
  imageSettings?: ImageSettings;
  genreSettings?: GenreSettings;
  cmsSettings?: CmsSettings;
  videoSettings?: VideoSettings;
  audioSettings?: AudioSettings;
  displayFloors?: string[];
  currentFloorSetting?: string;
  localMediaTextSettings?: LocalMediaTextSettings;
  subFloorSettings?: SubFloorSettings;
  floorLayout?: Record<string, FloorLayoutPerFloor>;
  blackScreenSettings?: BlackScreenSettings;
  shopDataMode?: 'api' | 'local';
}

const DEFAULT_SHOP_POSITIONS: ShopPositionSettings = { positions: {} };

const DEFAULT_GENRE_SETTINGS: GenreSettings = {
  ignoredKeywords: [
    'waonpoint加盟店',
    'aeonpayの使えるお店',
    'グルメ',
    'フード',
    'フードコート',
    'レストラン',
    'グルメアリーナ',
    'suzaka蔵',
    'suzuka蔵',
    'レストラン・カフェ',
    'レストラン・グルメ',
  ],
  maxItems: 3,
};

const DEFAULT_CMS_SETTINGS: CmsSettings = {
  enabled: true,
  categorySearchEnabled: true,
};

const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  enabled: false,
  source: '',
  loop: true,
  autoplay: true,
};

/**
 * Map legacy mall IDs to their current equivalents.
 * Used during migration to avoid creating stale settings files.
 */
const LEGACY_MALL_ID_MAP: Record<string, string> = {
  'sendai-kamisugi': 'sendaikamisugi',
};

// ============================================================================
// Defaults
// ============================================================================

export function getDefaultMallSettingsFile(): MallSettingsFile {
  return {
    locationIcons: DEFAULT_LOCATION_ICON_SETTINGS_PER_FLOOR,
    shopPositions: DEFAULT_SHOP_POSITIONS,
    imageSettings: DEFAULT_IMAGE_SETTINGS,
    genreSettings: DEFAULT_GENRE_SETTINGS,
    cmsSettings: DEFAULT_CMS_SETTINGS,
    videoSettings: DEFAULT_VIDEO_SETTINGS,
    audioSettings: DEFAULT_AUDIO_SETTINGS,
    displayFloors: ['1F', '2F', '3F', '4F'],
    currentFloorSetting: '1F',
    localMediaTextSettings: {},
    subFloorSettings: { "1F-1": [], "1F-2": [] },
    floorLayout: {
      "1F": { columns: 3, rowsPerCol: 20 },
      "2F": { columns: 2, rowsPerCol: 19 },
      "3F": { columns: 3, rowsPerCol: 20 },
      "4F": { columns: 2, rowsPerCol: 18 },
    },
    blackScreenSettings: DEFAULT_BLACK_SCREEN_SETTINGS,
    shopDataMode: 'api',
  };
}

// ============================================================================
// Global settings (settings.json)
// ============================================================================

export async function loadGlobalSettings(): Promise<GlobalSettings> {
  try {
    const json = await invoke<string>('get_settings');
    const raw = JSON.parse(json);
    return {
      mallId: (raw.mallId ?? 'suzaka') as MallId,
      floor: raw.floor ?? '1F',
      setupCompleted: raw.setupCompleted ?? false,
      hostname: raw.hostname ?? '',
    };
  } catch (error) {
    logError('CONFIG', 'Failed to load global settings', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { mallId: 'suzaka', floor: '1F', setupCompleted: false, hostname: '' };
  }
}

export async function saveGlobalSettings(settings: GlobalSettings): Promise<void> {
  const json = JSON.stringify(settings, null, 2);
  await invoke('save_settings', { json });
  logInfo('CONFIG', 'Global settings saved', { mallId: settings.mallId });
}

export async function cleanupOldHostnameMaps(mallId: string, currentHostname: string): Promise<void> {
  await invoke('cleanup_old_hostname_maps', { mallId, currentHostname });
}

// ============================================================================
// Per-mall settings ([mallId]-settings.json)
// ============================================================================

function mallSettingsFilename(mallId: string): string {
  return `${mallId}-settings.json`;
}

export async function loadMallSettings(mallId: string): Promise<MallSettingsFile> {
  try {
    const filename = mallSettingsFilename(mallId);
    const json = await invoke<string>('get_named_settings', { filename });
    const raw = JSON.parse(json);

    // If empty object, return defaults
    if (!raw || Object.keys(raw).length === 0) {
      return getDefaultMallSettingsFile();
    }

    const defaults = getDefaultMallSettingsFile();

    return {
      locationIcons: raw.locationIcons ?? defaults.locationIcons,
      shopPositions: raw.shopPositions ?? defaults.shopPositions,
      imageSettings: raw.imageSettings ?? defaults.imageSettings,
      genreSettings: raw.genreSettings ?? defaults.genreSettings,
      cmsSettings: raw.cmsSettings ?? defaults.cmsSettings,
      videoSettings: raw.videoSettings ?? defaults.videoSettings,
      audioSettings: { ...defaults.audioSettings, ...raw.audioSettings },
      displayFloors: raw.displayFloors ?? defaults.displayFloors,
      currentFloorSetting: raw.currentFloorSetting ?? defaults.currentFloorSetting,
      localMediaTextSettings: raw.localMediaTextSettings ?? defaults.localMediaTextSettings,
      subFloorSettings: raw.subFloorSettings ?? defaults.subFloorSettings,
      floorLayout: raw.floorLayout ?? defaults.floorLayout,
      blackScreenSettings: raw.blackScreenSettings ?? defaults.blackScreenSettings,
      shopDataMode: (raw.shopDataMode ?? 'api') as 'api' | 'local',
      pictoSettings: raw.pictoSettings,
      bannerSettings: raw.bannerSettings,
    };
  } catch (error) {
    logError('CONFIG', 'Failed to load mall settings', {
      mallId,
      error: error instanceof Error ? error.message : String(error),
    });
    return getDefaultMallSettingsFile();
  }
}

export async function saveMallSettings(
  mallId: string,
  settings: MallSettingsFile,
): Promise<void> {
  const filename = mallSettingsFilename(mallId);
  const json = JSON.stringify(settings, null, 2);
  await invoke('save_named_settings', { filename, json });
  logInfo('CONFIG', 'Mall settings saved', { mallId, filename });
}

export async function mallSettingsFileExists(mallId: string): Promise<boolean> {
  const filename = mallSettingsFilename(mallId);
  return invoke<boolean>('settings_file_exists', { filename });
}

export async function ensureMallSettingsFile(mallId: string): Promise<void> {
  const exists = await mallSettingsFileExists(mallId);
  if (!exists) {
    const defaults = getDefaultMallSettingsFile();
    await saveMallSettings(mallId, defaults);
    logInfo('CONFIG', 'Created default mall settings file', { mallId });
  }
}

// ============================================================================
// Migration from legacy single-file format
// ============================================================================

export async function migrateFromLegacyIfNeeded(): Promise<boolean> {
  try {
    const json = await invoke<string>('get_settings');
    const raw = JSON.parse(json) as LegacySettings;

    // If there's no legacy data indicators, skip migration
    if (!raw.locationIcons && !raw.shopPositions && !raw.imageSettings) {
      return false;
    }

    // Check if per-mall files already exist (migration already done)
    const globalMallId = raw.mallId ?? 'suzaka';
    const normalizedGlobalMallId = LEGACY_MALL_ID_MAP[globalMallId] ?? globalMallId;
    const exists = await mallSettingsFileExists(normalizedGlobalMallId);
    if (exists) {
      return false;
    }

    logInfo('CONFIG', 'Starting legacy settings migration');

    const defaults = getDefaultMallSettingsFile();

    const settings: MallSettingsFile = {
      locationIcons: raw.locationIcons ?? defaults.locationIcons,
      shopPositions: raw.shopPositions ?? defaults.shopPositions,
      imageSettings: raw.imageSettings ?? defaults.imageSettings,
      genreSettings: raw.genreSettings ?? defaults.genreSettings,
      cmsSettings: raw.cmsSettings ?? defaults.cmsSettings,
      videoSettings: raw.videoSettings ?? defaults.videoSettings,
      audioSettings: raw.audioSettings ?? defaults.audioSettings,
      displayFloors: raw.displayFloors ?? defaults.displayFloors,
      currentFloorSetting: raw.currentFloorSetting ?? defaults.currentFloorSetting,
      localMediaTextSettings: raw.localMediaTextSettings ?? defaults.localMediaTextSettings,
      subFloorSettings: raw.subFloorSettings ?? defaults.subFloorSettings,
      floorLayout: raw.floorLayout ?? defaults.floorLayout,
      blackScreenSettings: raw.blackScreenSettings ?? defaults.blackScreenSettings,
      shopDataMode: (raw.shopDataMode ?? 'api') as 'api' | 'local',
    };

    await saveMallSettings(normalizedGlobalMallId, settings);

    // Overwrite settings.json with clean global-only format
    await saveGlobalSettings({
      mallId: normalizedGlobalMallId as MallId,
      floor: raw.floor ?? '1F',
      setupCompleted: true,
    });

    logInfo('CONFIG', 'Legacy settings migration completed', {
      mallId: normalizedGlobalMallId,
    });

    return true;
  } catch (error) {
    logError('CONFIG', 'Failed to migrate legacy settings', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// ============================================================================
// Image file utilities
// ============================================================================

/**
 * Save image file via Rust backend (receives raw bytes, no Base64).
 * Returns the absolute path to the saved file.
 */
export async function saveImageFile(
  filename: string,
  data: Uint8Array,
): Promise<string> {
  const response = await invoke<{ success: boolean; path: string }>(
    'save_image_file',
    { filename, data: Array.from(data) },
  );
  return response.path;
}

/**
 * Get absolute path of an image file in the images directory.
 * Returns empty string if file does not exist.
 */
export async function getImagePath(filename: string): Promise<string> {
  return invoke<string>('get_image_path', { filename });
}

/**
 * Delete an image file from the images directory.
 */
export async function deleteImageFile(filename: string): Promise<boolean> {
  return invoke<boolean>('delete_image_file', { filename });
}

/**
 * Read image file as bytes from an arbitrary path.
 */
export async function readImageFile(filePath: string): Promise<number[]> {
  return invoke<number[]>('read_image_file', { filePath });
}
