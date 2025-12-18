import { useState, useEffect, useRef } from "react";
import { 
  fetchShops, 
  loadShopsFromCache, 
  saveShopsToCache 
} from "../repositories/shopRepository";
import { shopSseClient, type ShopsEvent } from "../api/sseClient";
import { convertSseShopDataToShop } from "../utils/shopConverter";
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
    return rawShops.map((s) => ({
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
        logInfo("shopList", "Loaded shops from cache", { count: cached.length });
        // APIロード完了までローディングは維持しても良いが、
        // ユーザー体験的には「表示された」時点でローディング解除するのもあり。
        // ここではバックグラウンド更新中であることを示すためisLoadingはtrueのままにするか、
        // あるいはfalseにして裏で更新するか。要件「ユーザーを待たせず」に従い、
        // ここでは一旦描画させるために何か返すが、状態としてはLoading継続が無難。
        // ただし、画面が固まらないことが重要。
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
      
      logInfo("shopList", "Shop data synced", {
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

      logError("shopList", "Failed to load shop list", {
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

    // Subscribe to SSE events for real-time updates
    const unsubscribeShops = shopSseClient.on<ShopsEvent | any[]>('shops', (payload) => {
      console.log('[useShops] SSE shops received', payload);
      
      let shopList: any[] = [];
      
      if (payload && !Array.isArray(payload) && 'data' in payload && Array.isArray((payload as any).data)) {
        shopList = (payload as any).data;
      } else if (Array.isArray(payload)) {
        shopList = payload;
      } else if (payload && typeof payload === 'object' && 'items' in payload && Array.isArray((payload as any).items)) {
         shopList = (payload as any).items;
      }

      if (shopList.length > 0) {
        try {
          const newShops = shopList.map((item: any) => convertSseShopDataToShop(item));
          const cleaned = cleanShops(newShops);

          setShops(cleaned);
          setError(null);
          
          // SSE更新時もキャッシュを更新しておく
          saveShopsToCache(cleaned);

          logInfo("shopList", "Shop data updated via SSE", {
            count: cleaned.length,
          });
        } catch (e) {
          console.error('[useShops] Failed to process shops event', e);
        }
      }
    });

    // Fallback: If 'update' event is received (legacy behavior), reload shops via API
    const unsubscribeUpdate = shopSseClient.on('update', () => {
      console.log('[useShops] SSE update received, reloading shops...');
      loadData(true);
    });

    const unsubscribeConnected = shopSseClient.on('connected', () => {
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
