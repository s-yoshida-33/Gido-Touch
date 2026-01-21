// src/api/bridgeClient.ts
import { getApiBaseUrl, APP_CONFIG } from "../config";
import type { BridgeShop, Shop, FloorId } from "../types/shop";

import { logInfo, logWarn, logError } from "../logs/logging";

// Normalize floor id string (you can extend this if needed)
export function normalizeFloorId(value: string): FloorId {
  if (!value) return "";
  return value.trim().toUpperCase(); // e.g. "1f" -> "1F"
}

// Parse floors from BridgeShop into FloorId[]
export function parseFloorsFromBridge(
  rawFloors: unknown,
  fallbackFloor: string
): FloorId[] {
  let floors: string[] = [];

  if (Array.isArray(rawFloors)) {
    // Already an array: ["1F", "2F", "3F"]
    floors = rawFloors.map((f) => String(f));
  } else if (typeof rawFloors === "string") {
    // Comma-separated string: "1F,2F,3F"
    floors = rawFloors
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }

  // If floors is still empty, fallback to provided default floor
  if (floors.length === 0 && fallbackFloor) {
    floors = [fallbackFloor];
  }

  // Normalize and remove empty values
  const normalized = floors
    .map((f) => normalizeFloorId(f))
    .filter((f) => f !== "");

  return normalized;
}

// Fetches shop list from BridgeWebPopper and normalizes it to Shop[]
export async function fetchShopsFromBridge(): Promise<Shop[]> {
  const baseUrl = await getApiBaseUrl();
  const url = `${baseUrl}/api/shops`;

  logInfo("SHOP_MAP", "Requesting shops from Bridge API", { url });

  try {
    const res = await fetch(url, { method: "GET" });

    if (!res.ok) {
      logWarn("API_ERROR", "Bridge API returned non-200 response", {
        status: res.status,
        statusText: res.statusText,
      });
      throw new Error(`Bridge API error: HTTP ${res.status}`);
    }

    const json = await res.json();

    // Detect structure
    let rawList: BridgeShop[] = [];
    if (Array.isArray(json)) {
      rawList = json;
    } else if (Array.isArray((json as any).data)) {
      rawList = (json as any).data;
      logInfo(
        "SHOP_MAP",
        "Bridge API returned data under json.data (legacy format)"
      );
    } else if (Array.isArray((json as any).items)) {
      rawList = (json as any).items;
      logInfo(
        "SHOP_MAP",
        "Bridge API returned data under json.items (legacy format)"
      );
    } else {
      logError("API_ERROR", "Bridge API response did not contain an array", {
        receivedKeys: Object.keys(json),
      });
    }

    const defaultFloor = APP_CONFIG.floor;

    const shops: Shop[] = rawList.map((item) => {
      const floors = parseFloorsFromBridge(item.floors, defaultFloor);

      if (floors.length === 0) {
        logWarn("SHOP_MAP", "Shop has no floors after normalization", {
          shopId: item.shopId,
          name: item.shopName,
          rawFloors: item.floors,
          defaultFloor,
        });
      }

      // Prioritize new API fields (local_path), fallback to legacy fields
      const shopLogoValue = item.shopLogoLocalPath || item.shopLogo;
      const photo1Value = item.photo1LocalPath || item.photo1;
      const photo2Value = item.photo2LocalPath || item.photo2;

      // Verbose logging for shop logo removed to reduce noise, unless debugging needed
      /*
      if (shopLogoValue) {
        logInfo("SHOP_MAP", "Shop has shop_logo", {
          shopId: item.shopId,
          shopName: item.shopName,
          shopLogo: shopLogoValue,
        });
      } else {
        logInfo("SHOP_MAP", "Shop missing shop_logo", {
          shopId: item.shopId,
          shopName: item.shopName,
          availableKeys: Object.keys(item),
        });
      }
      */

      return {
        shopId: String(item.shopId),
        name: item.shopName || "",
        nameEn: item.shopNameEnglish || "",
        genre: item.genre || "",
        genreSub: item.genreSub || "",
        genreMemo: item.genreMemo || "",
        genreMemoEn: item.genreMemoEnglish || "",
        number: item.number || "",
        floors,
        photo1: photo1Value,
        photo2: photo2Value,
        shopLogo: shopLogoValue,
        description: item.description || "",
        openTime: item.openTime || "",
        tel: item.tel || "",
        takeOut: item.takeOut,
        alcohol: item.alcohol,
      };
    });

    logInfo("SHOP_MAP", "Shops fetched & normalized", {
      count: shops.length,
      defaultFloor,
    });

    return shops;
  } catch (error: any) {
    logError("API_ERROR", "Failed to fetch shops from Bridge API", {
      error: error?.message,
      url,
    });
    throw error;
  }
}
