// src/types/shop.ts

export type FloorId = string;

export interface Shop {
  shopId?: string;
  name: string;
  genre: string;
  genreSub?: string;
  genreMemo: string;
  number: string;
  floors: FloorId[];
  photo1?: string;
  photo2?: string;
  shopLogo?: string;
  description?: string;
  openTime?: string;
  tel?: string;
}

// Raw data type from BridgeWebPopper /api/shops
export interface BridgeShop {
  genre: string;
  number: string;
  genre_sub?: string;
  genre_memo: string;
  shop_name: string;
  floors?: string | string[];
  shop_id?: string;
  photo1?: string;
  photo2?: string;
  shop_logo?: string;
  description?: string;
  open_time?: string;
  tel?: string;
}
