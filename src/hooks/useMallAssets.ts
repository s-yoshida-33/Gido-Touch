import { useState, useEffect } from "react";

export type MallId = "suzaka" | "sendai-kamisugi";

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
  };
}

// 共通アセットのインポート (これらはモール間で共通とする)
// Note: Vite will bundle these unless we specifically want to dynamic import them too,
// but for now keeping common assets statically imported is safer for performance on critical UI elements.
import buttonClose from "../assets/button-close.svg";
import buttonCloseHighlight from "../assets/button-close-highlight.svg";
import buttonPrev from "../assets/button-prev.svg";
import buttonPrevHighlight from "../assets/button-prev-highlight.svg";
import buttonNext from "../assets/button-next.svg";
import buttonNextHighlight from "../assets/button-next-highlight.svg";
import zoomIn from "../assets/zoom-in.svg";
import zoomInHighlight from "../assets/zoom-in-highlight.svg";
import zoomOut from "../assets/zoom-out.svg";
import zoomOutHighlight from "../assets/zoom-out-highlight.svg";
import reset from "../assets/reset.svg";
import resetHighlight from "../assets/reset-highlight.svg";
import iconCurrentFloor from "../assets/icon-current-floor.svg";
import iconLocation from "../assets/icon-location.svg";
import iconTime from "../assets/icon-time.svg";
import iconTel from "../assets/icon-tel.svg";
import waonPointIcon from "../assets/waonpoint.svg";
import selectLanguageBg from "../assets/select-language-bg.svg";
import selectLanguageJp from "../assets/select-language-jp.svg";
import selectLanguageJpHighlight from "../assets/select-language-jp-highlight.svg";
import selectLanguageEn from "../assets/select-language-en.svg";
import selectLanguageEnHighlight from "../assets/select-language-en-highlight.svg";
import selectLanguageSelectedJp from "../assets/select-language-selected-jp.svg";
import selectLanguageSelectedEn from "../assets/select-language-selected-en.svg";

const COMMON_ASSETS = {
  buttonClose,
  buttonCloseHighlight,
  buttonPrev,
  buttonPrevHighlight,
  buttonNext,
  buttonNextHighlight,
  zoomIn,
  zoomInHighlight,
  zoomOut,
  zoomOutHighlight,
  reset,
  resetHighlight,
  iconCurrentFloor,
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
};

export const useMallAssets = (mallId: MallId) => {
  const [assets, setAssets] = useState<MallAssets | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const loadAssets = async () => {
      try {
        // モールごとのアセットを動的にインポート
        // Glob importを使用してディレクトリ内のファイルを一括取得も可能だが、
        // ここでは必要なファイルを明示的に構築するロジックにする。
        // ただし、フロア構成が不明なため、Globインポートを活用する。

        // モールIDに基づいて動的にインポート
        // ViteのGlob Import機能を使用
        // 注意: 変数を含むパスでのimportは制限があるため、switch文か、globのパターンマッチを使用する。
        
        let buttonModules: Record<string, any> = {};
        let mapModules: Record<string, any> = {};
        let openTimeModule: any = null;

        if (mallId === 'suzaka') {
           buttonModules = import.meta.glob('../assets/malls/suzaka/button/*.svg', { eager: true });
           mapModules = import.meta.glob('../assets/malls/suzaka/maps/*.svg', { eager: true });
           // open-timeはファイル名固定とするか、globで探す
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
          // パスからファイル名を抽出 (e.g., "1F.svg", "1F-highlight.svg")
          const fileName = path.split('/').pop() || "";
          const namePart = fileName.replace('.svg', ''); // "1F" or "1F-highlight"
          
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

        setAssets({
          buttons,
          maps,
          openTime: openTimeModule?.default || "",
          common: COMMON_ASSETS
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
  }, [mallId]);

  return { assets, isLoading };
};

