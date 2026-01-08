import { useState, useEffect } from "react";

export type MallId = "suzaka" | "sendai-kamisugi";
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
import buttonClose from "../assets/common/button/close.svg";
import buttonCloseHighlight from "../assets/common/button/close-highlight.svg";
import buttonPrev from "../assets/common/button/prev.svg";
import buttonPrevHighlight from "../assets/common/button/prev-highlight.svg";
import buttonNext from "../assets/common/button/next.svg";
import buttonNextHighlight from "../assets/common/button/next-highlight.svg";

// フロアラベル
import label1F from "../assets/common/label/1F.svg";
import label2F from "../assets/common/label/2F.svg";
import label3F from "../assets/common/label/3F.svg";
import label4F from "../assets/common/label/4F.svg";

// 日本語用アセット
import zoomInJa from "../assets/common/button/ja/zoom-in.svg";
import zoomInHighlightJa from "../assets/common/button/ja/zoom-in-highlight.svg";
import zoomOutJa from "../assets/common/button/ja/zoom-out.svg";
import zoomOutHighlightJa from "../assets/common/button/ja/zoom-out-highlight.svg";
import resetJa from "../assets/common/button/ja/reset.svg";
import resetHighlightJa from "../assets/common/button/ja/reset-highlight.svg";
import iconCurrentFloorJa from "../assets/common/current/ja/current.svg";

// 英語用アセット
import zoomInEn from "../assets/common/button/en/zoom-in.svg";
import zoomInHighlightEn from "../assets/common/button/en/zoom-in-highlight.svg";
import zoomOutEn from "../assets/common/button/en/zoom-out.svg";
import zoomOutHighlightEn from "../assets/common/button/en/zoom-out-highlight.svg";
import resetEn from "../assets/common/button/en/reset.svg";
import resetHighlightEn from "../assets/common/button/en/reset-highlight.svg";
import iconCurrentFloorEn from "../assets/common/current/en/current.svg";

import iconLocation from "../assets/common/icon/location.svg";
import iconTime from "../assets/common/icon/time.svg";
import iconTel from "../assets/common/icon/tel.svg";
import waonPointIcon from "../assets/common/icon/waonpoint.svg";
import selectLanguageBg from "../assets/common/lang/background.svg";
import selectLanguageJp from "../assets/common/lang/ja.svg";
import selectLanguageJpHighlight from "../assets/common/lang/ja-highlight.svg";
import selectLanguageEn from "../assets/common/lang/en.svg";
import selectLanguageEnHighlight from "../assets/common/lang/en-highlight.svg";
import selectLanguageSelectedJp from "../assets/common/lang/selected-ja.svg";
import selectLanguageSelectedEn from "../assets/common/lang/selected-en.svg";

export const useMallAssets = (mallId: MallId, language: Language = 'ja') => {
  const [assets, setAssets] = useState<MallAssets | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const loadAssets = async () => {
      try {
        // モールIDに基づいて動的にインポート
        let buttonModules: Record<string, any> = {};
        let mapModules: Record<string, any> = {};
        let openTimeModule: any = null;

        if (mallId === 'suzaka') {
           buttonModules = import.meta.glob('../assets/malls/suzaka/button/*.svg', { eager: true });
           mapModules = import.meta.glob('../assets/malls/suzaka/maps/*.svg', { eager: true });
           const openTimeModules = import.meta.glob('../assets/malls/suzaka/open-time/*.svg', { eager: true });
           openTimeModule = Object.values(openTimeModules)[0]; 
        } else if (mallId === 'sendai-kamisugi') {
           buttonModules = import.meta.glob('../assets/malls/sendai-kamisugi/button/*.svg', { eager: true });
           mapModules = import.meta.glob('../assets/malls/sendai-kamisugi/maps/*.svg', { eager: true });
           const openTimeModules = import.meta.glob('../assets/malls/sendai-kamisugi/open-time/*.svg', { eager: true });
           openTimeModule = Object.values(openTimeModules)[0];
        }

        if (!isMounted) return;

        // ボタンアセットの整理
        const buttons: MallAssets['buttons'] = {};
        Object.entries(buttonModules).forEach(([path, module]: [string, any]) => {
          const fileName = path.split('/').pop() || "";
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
          buttons[floor][type] = module.default;
        });

        // マップアセットの整理
        const maps: MallAssets['maps'] = {};
        Object.entries(mapModules).forEach(([path, module]: [string, any]) => {
            const fileName = path.split('/').pop() || "";
            const floor = fileName.replace('.svg', '');
            maps[floor] = module.default;
        });

        // 言語に応じたアセットの選択
        // 英語アセットがない場合は日本語アセットを使用する (フォールバックは各インポートで処理済み、ここでは論理切り替えのみ)
        // ※実際にはファイルが存在しないとビルドエラーになるため、ファイルが存在する前提
        const isEn = language === 'en';

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
          openTime: openTimeModule?.default || "",
          common: commonAssets
        });
        
      } catch (error) {
        console.error(`Failed to load assets for mall: ${mallId}`, error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadAssets();

    return () => {
      isMounted = false;
    };
  }, [mallId, language]);

  return { assets, isLoading };
};
