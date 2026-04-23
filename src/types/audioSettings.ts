export interface AudioSettings {
  cmsMuted: boolean;
  localMediaMuted: boolean;
  touchSoundEnabled: boolean;
  touchSoundFile?: string;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  cmsMuted: true,
  localMediaMuted: false,
  touchSoundEnabled: false,
  touchSoundFile: 'touch-sound-1.wav',
};


