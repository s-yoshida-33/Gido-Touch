import type { AnimationConfig } from "./locationIcon";

export type PictoTag =
  | "info"
  | "restroom"
  | "smoking_room"
  | "free_coin_lockers"
  | "atm"
  | "elevator"
  | string;

export interface PictoInstance {
  id: string;
  tag: PictoTag;
  iconName: string;
  floor: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  shadow?: {
    enabled: boolean;
    offsetX: number;
    offsetY: number;
    blur: number;
    opacity: number;
  };
  animation?: AnimationConfig;
}

export interface PictoSettings {
  instances: Record<string, PictoInstance>;
}

export const DEFAULT_PICTO_SETTINGS: PictoSettings = {
  instances: {},
};
