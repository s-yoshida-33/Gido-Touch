import { useState, useEffect, useRef } from "react";
import {
  fetchShops,
  loadShopsFromCache,
  saveShopsToCache
} from "../repositories/shopRepository";
import { shopSseService } from "../services/SSEService";
import { logInfo, logError } from "../logs/logging";
import type { Shop } from "../types/shop";

export const useShops = (useCacheFirst: boolean = true) => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Keep track of shops for error handling logic (to prevent overwriting with empty data)
  const shopsRef = useRef<Shop[]>([]);

  useEffect(() => {
    shopsRef.current = shops;
  }, [shops]);

  // Helper to clean shop data
  const cleanShops = (rawShops: Shop[]): Shop[] => {
    // Filter for restaurants only (飲食店, グルメ, フード, カフェ, etc.)
    const restaurants = rawShops.filter(s => {
      const g = (s.genre || "").toLowerCase();
      return g.includes("飲食") || g.includes("グルメ") || g.includes("フード") || g.includes("レストラン") || g.includes("カフェ") || g.includes("喫茶");
    });

    return restaurants.map((s) => ({
      ...s,
      name: (s.name || "").replace(/【.*?】/g, "").trim(),
    }));
  };

  const loadData = async (forceReload: boolean = false) => {
    setIsLoading(true);

    // 1. キャッシュがあれば即時反映 (Cache-First)
    // 初回ロード時のみキャッシュを使用する
    if (useCacheFirst && !forceReload && shops.length === 0) {
      const cached = loadShopsFromCache();
      if (cached && cached.length > 0) {
        setShops(cached);
        logInfo("DATA_SYNC", "Loaded shops from cache", { count: cached.length });
        // キャッシュがあれば先に表示（ユーザーを待たせない）
        setIsLoading(false);
      }
    }

    // 2. APIから最新データを取得 (Background Update)
    try {
      const data = await fetchShops({ forceReload });
      
      // Check for empty data (likely due to API update in progress)
      if (data.length === 0 && shopsRef.current.length > 0) {
        throw new Error("API returned 0 shops");
      }

      const cleaned = cleanShops(data);
      
      // データ更新
      setShops(cleaned);
      setError(null);
      
      // 次回用にキャッシュ保存
      saveShopsToCache(cleaned);
      
      logInfo("DATA_SYNC", "Shop data synced", {
        count: cleaned.length,
      });

    } catch (e: any) {
      console.error(e);
      const message = e?.message ?? "failed to load";
      
      // API失敗時、キャッシュもなければエラー
      if (shopsRef.current.length === 0) {
        // キャッシュからのロードも失敗（または空）だった場合のみエラーを表示
        // キャッシュがあれば、それを見せ続ける
        const cached = loadShopsFromCache();
        if (cached && cached.length > 0) {
            setShops(cached);
            console.warn("[ShopList] API Error but used cache:", e);
        } else {
            setError(new Error(message));
        }
      } else {
        console.warn("[ShopList] API Error but keeping existing data:", e);
      }

      logError("DATA_SYNC", "Failed to load shop list", {
        error: message,
        keepingExistingData: shopsRef.current.length > 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial load
    loadData();

    // 分離パターン: SSEは更新通知のみ。データはREST経由で取得する。
    const unsubscribeShops = shopSseService.on('shops', () => {
      logInfo("DATA_SYNC", "Shop update signal received, fetching from REST");
      loadData(true);
    });

    const unsubscribeUpdate = shopSseService.on('update', () => {
      logInfo("DATA_SYNC", "Update signal received, fetching from REST");
      loadData(true);
    });

    const unsubscribeConnected = shopSseService.on('connected', () => {
      console.log('[useShops] SSE connected, reloading shops...');
      loadData(true);
    });

    return () => {
      unsubscribeShops();
      unsubscribeUpdate();
      unsubscribeConnected();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { shops, isLoading, error, reload: () => loadData(true) };
};
