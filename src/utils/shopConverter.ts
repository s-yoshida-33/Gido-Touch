import type { Shop } from "../types/shop";
import { APP_CONFIG } from "../config";
import { parseFloorsFromBridge } from "../api/bridgeClient";
import { logWarn } from "../logs/logging";

interface SseShopData {
  shopId?: string | number;
  shopName?: string;
  shopNameEnglish?: string;
  shopLogo?: string;
  shopLogoLocalPath?: string;
  genre?: string;
  genreSub?: string;
  genreMemo?: string;
  genreMemoEnglish?: string;
  number?: string;
  floors?: unknown;
  photo1?: string;
  photo1LocalPath?: string;
  photo2?: string;
  photo2LocalPath?: string;
  description?: string;
  openTime?: string;
  tel?: string;
  takeOut?: string;
  alcohol?: string;
}

export function convertSseShopDataToShop(item: SseShopData): Shop {
  const defaultFloor = APP_CONFIG.floor;
  const floors = parseFloorsFromBridge(item.floors, defaultFloor);

  if (floors.length === 0) {
    logWarn("SHOP_MAP", "Shop has no floors after normalization", {
      shopId: item.shopId,
      name: item.shopName,
      rawFloors: item.floors,
      defaultFloor,
    });
  }

  // Handle fields (Server is confirmed to use camelCase)
  
  const shopId = String(item.shopId || "");
  const name = item.shopName || "";
  const nameEn = item.shopNameEnglish || "";
  
  // Image paths: prioritize local paths if available
  const shopLogo = item.shopLogoLocalPath || item.shopLogo;
  const photo1 = item.photo1LocalPath || item.photo1;
  const photo2 = item.photo2LocalPath || item.photo2;

  return {
    shopId,
    name,
    nameEn,
    genre: item.genre || "",
    genreSub: item.genreSub || "",
    genreMemo: item.genreMemo || "",
    genreMemoEn: item.genreMemoEnglish || "",
    number: item.number || "",
    floors,
    photo1,
    photo2,
    shopLogo,
    description: item.description || "",
    openTime: item.openTime || "",
    tel: item.tel || "",
    takeOut: item.takeOut,
    alcohol: item.alcohol,
  };
}
