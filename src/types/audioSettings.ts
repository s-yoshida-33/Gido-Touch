export interface AudioSettings {
  cmsMuted: boolean;
  localMediaMuted: boolean;
  touchSoundEnabled: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  cmsMuted: true,
  localMediaMuted: false,
  touchSoundEnabled: false,
};


