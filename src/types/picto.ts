import type { AnimationConfig } from "./locationIcon";

// halong の12ピクトのタグ（src/config/halongPictos.ts のキーのハイフンをアンダースコアにしたもの）。
// 旧タグ（info / smoking_room / free_coin_lockers）を含む既存設定も読めるよう string も許容する
export type PictoTag =
  | "relax_room"
  | "atm"
  | "elevator"
  | "exit"
  | "smart_locker"
  | "rest_space"
  | "escalator"
  | "restroom"
  | "currency_exchange_counter"
  | "charging_station"
  | "babyroom"
  | "entrance"
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
