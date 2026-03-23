import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { loadGlobalSettings } from '../utils/settings';

import mallsConfig from '../config/malls.json';

export type MallId = string;
export const MALL_IDS = mallsConfig.map(m => m.id);
export type Language = "ja" | "en";

// アセットのパス定義
interface MallAssets {
  buttons: {
    [key: string]: {
      default: string;
      highlight: string;
    };
  };
  maps: {
    [key: string]: string;
  };
  openTime: string;
  common: {
    buttonClose: string;
    buttonCloseHighlight: string;
    buttonPrev: string;
    buttonPrevHighlight: string;
    buttonNext: string;
    buttonNextHighlight: string;
    zoomIn: string;
    zoomInHighlight: string;
    zoomOut: string;
    zoomOutHighlight: string;
    reset: string;
    resetHighlight: string;
    iconCurrentFloor: string;
    iconLocation: string;
    iconTime: string;
    iconTel: string;
    waonPointIcon: string;
    aeonPayIcon: string;
    selectLanguageBg: string;
    selectLanguageJp: string;
    selectLanguageJpHighlight: string;
    selectLanguageEn: string;
    selectLanguageEnHighlight: string;
    selectLanguageSelectedJp: string;
    selectLanguageSelectedEn: string;
    floorLabels: {
      [key: string]: string;
    };
  };
}

// 共通アセットのインポート
import buttonClose from "../assets/button/close.svg";
import buttonCloseHighlight from "../assets/button/close-highlight.svg";
import buttonPrev from "../assets/button/prev.svg";
import buttonPrevHighlight from "../assets/button/prev-highlight.svg";
import buttonNext from "../assets/button/next.svg";
import buttonNextHighlight from "../assets/button/next-highlight.svg";

// フロアラベル
import label1F from "../assets/label/1F.svg";
import label2F from "../assets/label/2F.svg";
import label3F from "../assets/label/3F.svg";
import label4F from "../assets/label/4F.svg";

// 日本語用アセット
import zoomInJa from "../assets/button/ja/zoom-in.svg";
import zoomInHighlightJa from "../assets/button/ja/zoom-in-highlight.svg";
import zoomOutJa from "../assets/button/ja/zoom-out.svg";
import zoomOutHighlightJa from "../assets/button/ja/zoom-out-highlight.svg";
import resetJa from "../assets/button/ja/reset.svg";
import resetHighlightJa from "../assets/button/ja/reset-highlight.svg";
import iconCurrentFloorJa from "../assets/current/ja/current.svg";

// 英語用アセット
import zoomInEn from "../assets/button/en/zoom-in.svg";
import zoomInHighlightEn from "../assets/button/en/zoom-in-highlight.svg";
import zoomOutEn from "../assets/button/en/zoom-out.svg";
import zoomOutHighlightEn from "../assets/button/en/zoom-out-highlight.svg";
import resetEn from "../assets/button/en/reset.svg";
import resetHighlightEn from "../assets/button/en/reset-highlight.svg";
import iconCurrentFloorEn from "../assets/current/en/current.svg";

import iconLocation from "../assets/icon/location.svg";
import iconTime from "../assets/icon/time.svg";
import iconTel from "../assets/icon/tel.svg";
import waonPointIcon from "../assets/icon/waonpoint.svg";
import aeonPayIcon from "../assets/icon/aeonpay.svg";
import selectLanguageBg from "../assets/lang/background.svg";
import selectLanguageJp from "../assets/lang/ja.svg";
import selectLanguageJpHighlight from "../assets/lang/ja-highlight.svg";
import selectLanguageEn from "../assets/lang/en.svg";
import selectLanguageEnHighlight from "../assets/lang/en-highlight.svg";
import selectLanguageSelectedJp from "../assets/lang/selected-ja.svg";
import selectLanguageSelectedEn from "../assets/lang/selected-en.svg";

/**
 * Load mall-specific external assets via Tauri IPC.
 * Uses list_mall_assets to scan the mall's media/assets directory
 * and return a map of relative_path → data-URL.
 */
async function loadExternalMallAssets(mallId: string): Promise<Record<string, string>> {
  try {
    const globalSettings = await loadGlobalSettings();
    const hostname = globalSettings.hostname ?? '';
    const result = await invoke<Record<string, string> | null>('list_mall_assets', {
      mallId,
      hostname,
    });
    return result ?? {};
  } catch (error) {
    console.warn(`Failed to load external assets for mall: ${mallId}`, error);
    return {};
  }
}

export const useMallAssets = (mallId: MallId, language: Language = 'ja') => {
  const [assets, setAssets] = useState<MallAssets | null>(null);
  const [rawAssets, setRawAssets] = useState<Record<string, string> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. MallID変更時にデータを取得
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setRawAssets(null);

    const loadRawAssets = async () => {
      try {
        const externalAssets = await loadExternalMallAssets(mallId);
        
        if (isMounted) {
          setRawAssets(externalAssets);
        }
      } catch (error) {
        console.error(`Failed to load assets for mall: ${mallId}`, error);
        if (isMounted) setIsLoading(false);
      }
    };

    loadRawAssets();

    return () => {
      isMounted = false;
    };
  }, [mallId]);

  // 2. データまたは言語変更時にアセットオブジェクトを構築
  useEffect(() => {
    if (!rawAssets) return;

    const maps: MallAssets['maps'] = {};
    let openTimeDefault = "";
    let openTimeJa = "";
    let openTimeEn = "";

    // Button branch collection: floor → [{branch, default, highlight}]
    const buttonBranches: Record<string, { branch: number; default: string; highlight: string }[]> = {};

    Object.entries(rawAssets).forEach(([relativePath, fileUrl]) => {
      if (relativePath.startsWith('buttons/')) {
        // Expected: buttons/{FLOOR}-button-{NN}.svg or buttons/{FLOOR}-button-{NN}-highlight.svg
        const fileName = relativePath.split('/').pop() || "";
        const namePart = fileName.replace('.svg', '');

        const highlightMatch = namePart.match(/^(.+)-button-(\d+)-highlight$/);
        const defaultMatch = namePart.match(/^(.+)-button-(\d+)$/);

        const [floor, branch, isHighlight] = highlightMatch
          ? [highlightMatch[1], parseInt(highlightMatch[2]), true]
          : defaultMatch
          ? [defaultMatch[1], parseInt(defaultMatch[2]), false]
          : [null, null, false];

        if (floor != null && branch != null) {
          if (!buttonBranches[floor]) buttonBranches[floor] = [];
          let entry = buttonBranches[floor].find(e => e.branch === branch);
          if (!entry) {
            entry = { branch, default: '', highlight: '' };
            buttonBranches[floor].push(entry);
          }
          if (isHighlight) entry.highlight = fileUrl;
          else entry.default = fileUrl;
        }

      } else if (relativePath.startsWith('maps/')) {
        // Expected: maps/{FLOOR}-map.svg
        const fileName = relativePath.split('/').pop() || "";
        const floor = fileName.replace('-map.svg', '');
        if (floor) maps[floor] = fileUrl;

      } else if (relativePath.startsWith('open-times/')) {
        if (relativePath.includes('/en/')) {
          openTimeEn = fileUrl;
        } else if (relativePath.includes('/ja/')) {
          openTimeJa = fileUrl;
        } else {
          openTimeDefault = fileUrl;
        }
      }
    });

    // Build buttons map: single-branch floors use floor key, multi-branch use floor-N key
    const buttons: MallAssets['buttons'] = {};
    Object.entries(buttonBranches).forEach(([floor, branches]) => {
      branches.sort((a, b) => a.branch - b.branch);
      if (branches.length === 1) {
        buttons[floor] = { default: branches[0].default, highlight: branches[0].highlight };
      } else {
        branches.forEach(({ branch, default: d, highlight: h }) => {
          buttons[`${floor}-${branch}`] = { default: d, highlight: h };
        });
      }
    });

    const isEn = language === 'en';
    
    let openTime = "";
    if (isEn) {
      openTime = openTimeEn || openTimeJa || openTimeDefault;
    } else {
      openTime = openTimeJa || openTimeDefault || openTimeEn;
    }

    const commonAssets = {
      buttonClose,
      buttonCloseHighlight,
      buttonPrev,
      buttonPrevHighlight,
      buttonNext,
      buttonNextHighlight,
      
      zoomIn: isEn ? zoomInEn : zoomInJa,
      zoomInHighlight: isEn ? zoomInHighlightEn : zoomInHighlightJa,
      zoomOut: isEn ? zoomOutEn : zoomOutJa,
      zoomOutHighlight: isEn ? zoomOutHighlightEn : zoomOutHighlightJa,
      reset: isEn ? resetEn : resetJa,
      resetHighlight: isEn ? resetHighlightEn : resetHighlightJa,
      iconCurrentFloor: isEn ? iconCurrentFloorEn : iconCurrentFloorJa,

      iconLocation,
      iconTime,
      iconTel,
      waonPointIcon,
      aeonPayIcon,
      selectLanguageBg,
      selectLanguageJp,
      selectLanguageJpHighlight,
      selectLanguageEn,
      selectLanguageEnHighlight,
      selectLanguageSelectedJp,
      selectLanguageSelectedEn,
      floorLabels: {
        "1F": label1F,
        "2F": label2F,
        "3F": label3F,
        "4F": label4F,
      },
    };

    setAssets({
      buttons,
      maps,
      openTime,
      common: commonAssets
    });
    
    setIsLoading(false);
  }, [rawAssets, language]);

  return { assets, isLoading };
};
