import React, { createContext, useContext, useState, useEffect } from 'react';
import { useMallAssets } from '../hooks/useMallAssets';
import type { MallId } from '../hooks/useMallAssets';

// デフォルトは須坂
const DEFAULT_MALL_ID: MallId = 'suzaka';

interface MallContextType {
  mallId: MallId;
  setMallId: (id: MallId) => void;
  assets: ReturnType<typeof useMallAssets>['assets'];
  isLoading: boolean;
}

const MallContext = createContext<MallContextType>({
  mallId: DEFAULT_MALL_ID,
  setMallId: () => {},
  assets: null,
  isLoading: true,
});

export const MallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mallId, setMallId] = useState<MallId>(DEFAULT_MALL_ID);
  
  // Electronから設定を読み込む
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api.getMallId()
      .then((savedId) => {
        // savedIdが "suzaka" や "sendai-kamisugi" と一致するか確認
        if (savedId === 'suzaka' || savedId === 'sendai-kamisugi') {
          setMallId(savedId as MallId);
        }
      })
      .catch((err) => {
        console.error("Failed to load mall ID setting", err);
      });

    // モールIDの更新を監視 (必要であれば)
    const unsubscribe = api.onMallIdUpdated((updatedId) => {
       if (updatedId === 'suzaka' || updatedId === 'sendai-kamisugi') {
          setMallId(updatedId as MallId);
       }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const { assets, isLoading } = useMallAssets(mallId);

  // setMallIdのラッパー (Electronにも保存する)
  const handleSetMallId = (id: MallId) => {
    setMallId(id);
    if (window.electronAPI) {
      window.electronAPI.saveMallId(id).catch(console.error);
    }
  };

  return (
    <MallContext.Provider value={{ mallId, setMallId: handleSetMallId, assets, isLoading }}>
      {children}
    </MallContext.Provider>
  );
};

export const useMall = () => useContext(MallContext);
