import React, { createContext, useContext, useState, useEffect } from 'react';
import { useMallAssets } from '../hooks/useMallAssets';
import type { MallId, Language } from '../hooks/useMallAssets';

// デフォルトは須坂
const DEFAULT_MALL_ID: MallId = 'suzaka';
const DEFAULT_LANGUAGE: Language = 'ja';
const LANGUAGE_STORAGE_KEY = "gido-selected-language";

interface MallContextType {
  mallId: MallId;
  setMallId: (id: MallId) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  assets: ReturnType<typeof useMallAssets>['assets'];
  isLoading: boolean;
}

const MallContext = createContext<MallContextType>({
  mallId: DEFAULT_MALL_ID,
  setMallId: () => {},
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  assets: null,
  isLoading: true,
});

export const MallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mallId, setMallId] = useState<MallId>(DEFAULT_MALL_ID);
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  
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

  // 言語設定の読み込み
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === "en" || saved === "ja") {
        setLanguageState(saved);
      }
    }
  }, []);

  const { assets, isLoading } = useMallAssets(mallId, language);

  // setMallIdのラッパー (Electronにも保存する)
  const handleSetMallId = (id: MallId) => {
    setMallId(id);
    if (window.electronAPI) {
      window.electronAPI.saveMallId(id).catch(console.error);
    }
  };

  // setLanguageのラッパー (LocalStorageにも保存する)
  const handleSetLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    }
  };

  return (
    <MallContext.Provider value={{ mallId, setMallId: handleSetMallId, language, setLanguage: handleSetLanguage, assets, isLoading }}>
      {children}
    </MallContext.Provider>
  );
};

export const useMall = () => useContext(MallContext);
