// src/types/shopPosition.ts
import type { ShopPosition } from "./shop";

export interface ShopPositionSettings {
  // shopIdをキーとした位置情報のマップ
  positions: Record<string, ShopPosition>;
}

