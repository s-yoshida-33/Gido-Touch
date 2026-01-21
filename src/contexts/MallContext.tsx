import React, { createContext, useContext, useState, useEffect } from 'react';
import { useMallAssets, MALL_IDS } from '../hooks/useMallAssets';
import type { MallId, Language } from '../hooks/useMallAssets';
import type { GenreSettings } from '../types/genreSettings';
import { DEFAULT_IGNORED_GENRE_KEYWORDS, DEFAULT_CATEGORY_MAPPINGS } from '../utils/genreUtils';

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
}

const MallContext = createContext<MallContextType>({
  mallId: DEFAULT_MALL_ID,
  setMallId: () => {},
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  assets: null,
  isLoading: true,
  genreSettings: DEFAULT_GENRE_SETTINGS,
});

export const MallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mallId, setMallId] = useState<MallId>(DEFAULT_MALL_ID);
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [genreSettings, setGenreSettings] = useState<GenreSettings>(DEFAULT_GENRE_SETTINGS);
  
  // Electronから設定を読み込む
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    // モールID
    api.getMallId()
      .then((savedId) => {
        // savedIdが有効なIDリストに含まれているか確認
        if (MALL_IDS.includes(savedId)) {
          setMallId(savedId as MallId);
        }
      })
      .catch((err) => {
        console.error("Failed to load mall ID setting", err);
      });

    // ジャンル設定
    if (api.getGenreSettings) {
      api.getGenreSettings()
        .then((settings) => {
          if (settings) {
            setGenreSettings(settings);
          }
        })
        .catch((err) => {
          console.error("Failed to load genre settings", err);
        });
    }

    // モールIDの更新を監視
    const unsubscribeMall = api.onMallIdUpdated((updatedId) => {
       if (MALL_IDS.includes(updatedId)) {
          setMallId(updatedId as MallId);
       }
    });

    // ジャンル設定の更新を監視
    let unsubscribeGenre = () => {};
    if (api.onGenreSettingsUpdated) {
      unsubscribeGenre = api.onGenreSettingsUpdated((updatedSettings) => {
        setGenreSettings(updatedSettings);
      });
    }

    return () => {
      unsubscribeMall();
      unsubscribeGenre();
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
    <MallContext.Provider value={{ mallId, setMallId: handleSetMallId, language, setLanguage: handleSetLanguage, assets, isLoading, genreSettings }}>
      {children}
    </MallContext.Provider>
  );
};

export const useMall = () => useContext(MallContext);
