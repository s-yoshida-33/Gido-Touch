import { useState, useEffect } from "react";

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

export const useMallAssets = (mallId: MallId, language: Language = 'ja') => {
  const [assets, setAssets] = useState<MallAssets | null>(null);
  const [rawAssets, setRawAssets] = useState<Record<string, string> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. MallID変更時にデータを取得
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setRawAssets(null); // リセット

    const loadRawAssets = async () => {
      try {
        if (!window.electronAPI) {
          console.warn("Electron API not found");
          return;
        }

        // Electronから外部アセットのパス一覧を取得
        const externalAssets = await window.electronAPI.getMallAssets(mallId);
        
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

    // パスを分類
    const buttons: MallAssets['buttons'] = {};
    const maps: MallAssets['maps'] = {};
    let openTimeDefault = "";
    let openTimeJa = "";
    let openTimeEn = "";

    // パターン定義
    // button/{floor}.svg
    // button/{floor}-highlight.svg
    // maps/{floor}.svg
    // open-time/open-time.svg
    // open-time/ja/open-time.svg
    // open-time/en/open-time.svg

    Object.entries(rawAssets).forEach(([relativePath, fileUrl]) => {
      if (relativePath.startsWith('button/')) {
        const fileName = relativePath.split('/').pop() || "";
        const namePart = fileName.replace('.svg', '');
        
        let floor = "";
        let type: "default" | "highlight" = "default";

        if (namePart.endsWith('-highlight')) {
          floor = namePart.replace('-highlight', '');
          type = "highlight";
        } else {
          floor = namePart;
          type = "default";
        }

        if (!buttons[floor]) {
          buttons[floor] = { default: "", highlight: "" };
        }
        buttons[floor][type] = fileUrl;

      } else if (relativePath.startsWith('maps/')) {
        const fileName = relativePath.split('/').pop() || "";
        const floor = fileName.replace('.svg', '');
        maps[floor] = fileUrl;

      } else if (relativePath.startsWith('open-time/')) {
        if (relativePath.includes('/en/')) {
          openTimeEn = fileUrl;
        } else if (relativePath.includes('/ja/')) {
          openTimeJa = fileUrl;
        } else {
          openTimeDefault = fileUrl;
        }
      }
    });

    // 言語に応じたアセットの選択
    // 英語アセットがない場合は日本語アセットを使用する (フォールバックは各インポートで処理済み、ここでは論理切り替えのみ)
    // ※実際にはファイルが存在しないとビルドエラーになるため、ファイルが存在する前提
    const isEn = language === 'en';
    
    // 営業時間の言語対応
    // 優先順位:
    // EN: en/xxx -> ja/xxx -> default -> ""
    // JA: ja/xxx -> default -> en/xxx -> ""
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
      
      // ja/en のディレクトリ切り替えに対応
      zoomIn: isEn ? zoomInEn : zoomInJa,
      zoomInHighlight: isEn ? zoomInHighlightEn : zoomInHighlightJa,
      zoomOut: isEn ? zoomOutEn : zoomOutJa,
      zoomOutHighlight: isEn ? zoomOutHighlightEn : zoomOutHighlightJa,
      reset: isEn ? resetEn : resetJa,
      resetHighlight: isEn ? resetHighlightEn : resetHighlightJa,
      iconCurrentFloor: isEn ? iconCurrentFloorEn : iconCurrentFloorJa,

      // ディレクトリ分けされていないものはそのまま (切り替えなし)
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
