import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useMallAssets, MALL_IDS } from '../hooks/useMallAssets';
import type { MallId, Language } from '../hooks/useMallAssets';
import type { GenreSettings } from '../types/genreSettings';
import { DEFAULT_IGNORED_GENRE_KEYWORDS, DEFAULT_CATEGORY_MAPPINGS } from '../utils/genreUtils';
import { loadGlobalSettings, saveGlobalSettings, loadMallSettings } from '../utils/settings';
import type { GlobalSettings } from '../utils/settings';

// デフォルトはリストの先頭、なければ須坂
const DEFAULT_MALL_ID: MallId = MALL_IDS[0] || 'suzaka';
const DEFAULT_LANGUAGE: Language = 'ja';
const LANGUAGE_STORAGE_KEY = "gido-selected-language";

const DEFAULT_GENRE_SETTINGS: GenreSettings = {
  ignoredKeywords: DEFAULT_IGNORED_GENRE_KEYWORDS || [],
  maxItems: 3,
  categoryMapping: DEFAULT_CATEGORY_MAPPINGS
};

interface MallContextType {
  mallId: MallId;
  setMallId: (id: MallId) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  assets: ReturnType<typeof useMallAssets>['assets'];
  isLoading: boolean;
  genreSettings: GenreSettings;
  /** S3からマップ/アセットをダウンロード後に呼び出すことでアセットを再読み込みする */
  refreshAssets: () => void;
}

const MallContext = createContext<MallContextType>({
  mallId: DEFAULT_MALL_ID,
  setMallId: () => {},
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  assets: null,
  isLoading: true,
  genreSettings: DEFAULT_GENRE_SETTINGS,
  refreshAssets: () => {},
});

export const MallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mallId, setMallId] = useState<MallId>(DEFAULT_MALL_ID);
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [genreSettings, setGenreSettings] = useState<GenreSettings>(DEFAULT_GENRE_SETTINGS);
  
  // Tauri設定から読み込む
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // グローバル設定からmallIdを取得
        const global = await loadGlobalSettings();
        if (global.mallId && MALL_IDS.includes(global.mallId as MallId)) {
          setMallId(global.mallId as MallId);
        }

        // モール別設定からジャンル設定を取得
        const currentMallId = global.mallId || DEFAULT_MALL_ID;
        const mallSettings = await loadMallSettings(currentMallId);
        if (mallSettings.genreSettings) {
          setGenreSettings(mallSettings.genreSettings);
        }
      } catch (err) {
        console.error("Failed to load settings", err);
      }
    };

    loadSettings();
  }, []);

  // 言語設定の読み込み
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === "en" || saved === "ja" || saved === "vn") {
        setLanguageState(saved);
      }
    }
  }, []);

  const [assetRefreshKey, setAssetRefreshKey] = useState(0);
  const refreshAssets = useCallback(() => setAssetRefreshKey(k => k + 1), []);

  const { assets, isLoading } = useMallAssets(mallId, language, assetRefreshKey);

  // setMallIdのラッパー (Tauri設定にも保存する)
  const handleSetMallId = useCallback(async (id: MallId) => {
    setMallId(id);
    try {
      const global = await loadGlobalSettings();
      await saveGlobalSettings({ ...global, mallId: id } as GlobalSettings);

      // 新しいモールのジャンル設定を読み込む
      const mallSettings = await loadMallSettings(id);
      if (mallSettings.genreSettings) {
        setGenreSettings(mallSettings.genreSettings);
      }
    } catch (err) {
      console.error("Failed to save mall ID", err);
    }
  }, []);

  // setLanguageのラッパー (LocalStorageにも保存する)
  const handleSetLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    }
  }, []);

  const contextValue = useMemo(() => ({
    mallId,
    setMallId: handleSetMallId,
    language,
    setLanguage: handleSetLanguage,
    assets,
    isLoading,
    genreSettings,
    refreshAssets,
  }), [mallId, handleSetMallId, language, handleSetLanguage, assets, isLoading, genreSettings, refreshAssets]);

  return (
    <MallContext.Provider value={contextValue}>
      {children}
    </MallContext.Provider>
  );
};

export const useMall = () => useContext(MallContext);
