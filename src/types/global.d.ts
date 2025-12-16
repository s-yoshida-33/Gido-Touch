// src/types/global.d.ts
export {};

import type {
  CurrentAsset,
  WspCurrentTimelineResponse,
  WspTimelineResponse,
} from "./wsp";

import type { LocationIconSettings } from "./locationIcon";
import type { ImageSettings } from "./imageSettings";
import type { VideoSettings } from "./videoSettings";
import type { ShopPositionSettings } from "./shopPosition";

export type LocalMediaTextSettings = Record<string, { 
  line1: string; 
  line2: string;
  line1En?: string;
  line2En?: string;
}>;

type ColumnPadding = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

type FloorLayoutPerFloor = {
  columns: number;
  rowsPerCol: number;
  perColumnRows?: number[];
  perColumnPadding?: ColumnPadding[];
};

type FloorLayout = Record<string, FloorLayoutPerFloor>;

interface ElectronAPI {
  getBridgeBaseUrl: () => Promise<string>;
  getFloor: () => Promise<string>;
  setFloor: (floor: string) => void;
  onFloorChanged: (cb: (floor: string) => void) => void;

  getCurrentFloorSetting: () => Promise<string>;
  saveCurrentFloorSetting: (setting: string) => Promise<string>;
  onCurrentFloorSettingUpdated: (cb: (setting: string) => void) => () => void;

  getLocationIconSettings: () => Promise<LocationIconSettings>;
  saveLocationIconSettings: (
    settings: LocationIconSettings
  ) => Promise<LocationIconSettings>;
  onLocationIconSettingsUpdated: (
    cb: (settings: LocationIconSettings) => void
  ) => () => void;
  onOpenLocationIconSettings: (cb: () => void) => () => void;

  onUpdateFloorLayout?: (
    callback: (payload: {
      floor: string;
      columns: number;
      rowsPerCol: number;
    }) => void
  ) => void;

  getFloorLayout: () => Promise<FloorLayout>;
  saveFloorLayout: (layout: FloorLayout) => Promise<FloorLayout>;
  onFloorLayoutChanged: (cb: (layout: FloorLayout) => void) => () => void;
  onOpenFloorLayoutSettings: (cb: () => void) => () => void;
  onOpenFloorSettings: (cb: () => void) => () => void;
  onOpenVersionInfo: (cb: () => void) => () => void;
  onOpenSettings: (cb: () => void) => () => void;
  getImageSettings: () => Promise<ImageSettings>;
  saveImageSettings: (settings: ImageSettings) => Promise<ImageSettings>;
  onImageSettingsUpdated: (cb: (settings: ImageSettings) => void) => () => void;
  getVideoSettings: () => Promise<VideoSettings>;
  saveVideoSettings: (settings: VideoSettings) => Promise<VideoSettings>;
  onVideoSettingsUpdated: (cb: (settings: VideoSettings) => void) => () => void;
  getShopImage: (filePath: string) => Promise<string | null>;
  getLocalMediaFiles: () => Promise<string[]>;
  getShopPositions: () => Promise<ShopPositionSettings>;
  saveShopPositions: (settings: ShopPositionSettings) => Promise<ShopPositionSettings>;
  onShopPositionsUpdated: (cb: (settings: ShopPositionSettings) => void) => () => void;
  getLocalMediaTextSettings: () => Promise<LocalMediaTextSettings>;
  saveLocalMediaTextSettings: (
    settings: LocalMediaTextSettings
  ) => Promise<LocalMediaTextSettings>;
  onLocalMediaTextSettingsUpdated: (
    cb: (settings: LocalMediaTextSettings) => void
  ) => () => void;
  getDebugSettingsStatus: () => Promise<any>;
  manualUpdateCheck: () => void;
  oneClickUpdate: () => void;
  quitApp: () => void;
}

export type StatusState = 'checking' | 'available' | 'none' | 'downloaded' | 'error';

export interface UpdaterAPI {
  onStatus: (cb: (data: { state: StatusState; message: string }) => void) => void;
  onProgress: (cb: (data: {
    percent: number;
    transferred: number;
    total: number;
    speed: number;
  }) => void) => void;
  startupWaitCompleted: () => void;
  checkForUpdatesReady: () => void;
}

export interface AppInfoAPI {
  getVersion: () => Promise<string>;
  getLatestVersionInfo: () => Promise<{
    version: string;
    releaseDate?: string;
    releaseNotes?: string;
  } | null>;
}

interface WspApi {
  getCurrentAsset: () => Promise<CurrentAsset | null>;
  getCurrentTimeline: () => Promise<WspCurrentTimelineResponse | null>;
  getTimeline: (hour?: number) => Promise<WspTimelineResponse | null>;
  getRightTopVideoAsset: () => Promise<CurrentAsset | null>;
  getBaseUrl: () => Promise<string>;
}

interface LoggerApi {
  log: (
    level: string,
    message: string,
    context?: Record<string, unknown>
  ) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  debug: (message: string, context?: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    __BWP_BASE_URL__?: string;

    electronAPI?: ElectronAPI;
    updater?: UpdaterAPI;
    appInfo?: AppInfoAPI;
    wspApi?: WspApi;
    logger?: LoggerApi;
  }
}
