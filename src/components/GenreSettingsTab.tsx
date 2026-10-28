import React, { useState, useMemo, useRef, useEffect } from "react";
import type { GenreSettings } from "../types/genreSettings";
import type { Shop } from "../types/shop";
import { DEFAULT_CATEGORY_MAPPINGS } from "../utils/genreUtils";

interface GenreSettingsTabProps {
  settings: GenreSettings;
  onChangeSettings: (settings: GenreSettings) => void;
  shops?: Shop[];
}

type CategoryKey = "sweets" | "alcohol" | "kids" | "takeout";

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  sweets: "スイーツ",
  alcohol: "アルコール",
  kids: "キッズメニュー",
  takeout: "テイクアウト",
};

export const GenreSettingsTab: React.FC<GenreSettingsTabProps> = ({
  settings,
  onChangeSettings,
  shops = [],
}) => {
  const [newKeyword, setNewKeyword] = useState("");
  const [showIgnoredDropdown, setShowIgnoredDropdown] = useState(false);
  const ignoredDropdownRef = useRef<HTMLDivElement>(null);
  const ignoredInputRef = useRef<HTMLInputElement>(null);

  // 非表示ショップ設定用のステート
  const [newHiddenShopId, setNewHiddenShopId] = useState("");
  const [showHiddenShopDropdown, setShowHiddenShopDropdown] = useState(false);
  const hiddenShopDropdownRef = useRef<HTMLDivElement>(null);
  const hiddenShopInputRef = useRef<HTMLInputElement>(null);

  // カテゴリー設定用のステート
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>("sweets");
  const [newCategoryKeyword, setNewCategoryKeyword] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ショップデータからユニークなジャンルメモを抽出
  const uniqueGenreMemos = useMemo(() => {
    const memos = new Set<string>();
    shops.forEach((shop) => {
      if (!shop.genreMemo) return;
      shop.genreMemo.split(/[|]+/).forEach((memo) => {
        const trimmed = memo.trim();
        if (trimmed) memos.add(trimmed);
      });
    });
    return Array.from(memos).sort();
  }, [shops]);

  // クリック外判定
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // カテゴリーキーワード設定用
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
      
      // 除外キーワード設定用
      if (
        ignoredDropdownRef.current &&
        !ignoredDropdownRef.current.contains(event.target as Node) &&
        ignoredInputRef.current &&
        !ignoredInputRef.current.contains(event.target as Node)
      ) {
        setShowIgnoredDropdown(false);
      }

      // 非表示ショップ設定用
      if (
        hiddenShopDropdownRef.current &&
        !hiddenShopDropdownRef.current.contains(event.target as Node) &&
        hiddenShopInputRef.current &&
        !hiddenShopInputRef.current.contains(event.target as Node)
      ) {
        setShowHiddenShopDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleAddKeyword = () => {
    const trimmed = newKeyword.trim();
    if (trimmed && !settings.ignoredKeywords.includes(trimmed)) {
      const newKeywords = [...settings.ignoredKeywords, trimmed];
      onChangeSettings({
        ...settings,
        ignoredKeywords: newKeywords,
      });
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    const newKeywords = settings.ignoredKeywords.filter(k => k !== keywordToRemove);
    onChangeSettings({
      ...settings,
      ignoredKeywords: newKeywords,
    });
  };

  // 非表示ショップの追加
  const handleAddHiddenShopId = () => {
    const trimmed = newHiddenShopId.trim();
    const currentIds = settings.hiddenShopIds || [];
    if (trimmed && !currentIds.includes(trimmed)) {
      onChangeSettings({
        ...settings,
        hiddenShopIds: [...currentIds, trimmed],
      });
      setNewHiddenShopId("");
    }
  };

  // 非表示ショップの削除
  const handleRemoveHiddenShopId = (idToRemove: string) => {
    onChangeSettings({
      ...settings,
      hiddenShopIds: (settings.hiddenShopIds || []).filter(id => id !== idToRemove),
    });
  };

  // ショップIDから表示用ラベルを生成（例: "[408] 店名 (ID: 135)"）
  const getShopLabel = (shopId: string): string => {
    const shop = shops.find(s => s.shopId === shopId);
    if (!shop) return `ID: ${shopId}（現在のショップデータに無し）`;
    return `${shop.number ? `[${shop.number}] ` : ""}${shop.name} (ID: ${shopId})`;
  };

  const handleMaxItemsChange =(e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0) {
      onChangeSettings({
        ...settings,
        maxItems: val,
      });
    }
  };

  // カテゴリーキーワードの追加
  const handleAddCategoryKeyword = () => {
    const trimmed = newCategoryKeyword.trim();
    const currentMapping = settings.categoryMapping || DEFAULT_CATEGORY_MAPPINGS;
    const currentKeywords = currentMapping[selectedCategory] || [];

    if (trimmed && !currentKeywords.includes(trimmed)) {
      onChangeSettings({
        ...settings,
        categoryMapping: {
          ...currentMapping,
          [selectedCategory]: [...currentKeywords, trimmed],
        },
      });
      setNewCategoryKeyword("");
    }
  };

  // カテゴリーキーワードの削除
  const handleRemoveCategoryKeyword = (keywordToRemove: string) => {
    const currentMapping = settings.categoryMapping || DEFAULT_CATEGORY_MAPPINGS;
    const currentKeywords = currentMapping[selectedCategory] || [];
    
    onChangeSettings({
      ...settings,
      categoryMapping: {
        ...currentMapping,
        [selectedCategory]: currentKeywords.filter(k => k !== keywordToRemove),
      },
    });
  };

  // カテゴリーキーワード用 フィルタリングされた候補リスト
  const filteredOptions = useMemo(() => {
    if (!newCategoryKeyword) return uniqueGenreMemos;
    return uniqueGenreMemos.filter(memo => 
      memo.toLowerCase().includes(newCategoryKeyword.toLowerCase())
    );
  }, [uniqueGenreMemos, newCategoryKeyword]);

  // 除外キーワード用 フィルタリングされた候補リスト
  const filteredIgnoredOptions = useMemo(() => {
    if (!newKeyword) return uniqueGenreMemos;
    return uniqueGenreMemos.filter(memo => 
      memo.toLowerCase().includes(newKeyword.toLowerCase())
    );
  }, [uniqueGenreMemos, newKeyword]);

  // 非表示ショップ用 候補リスト（ショップID・区画番号・店名で絞り込み、区画番号順）
  const filteredHiddenShopOptions = useMemo(() => {
    const hiddenIds = settings.hiddenShopIds || [];
    const query = newHiddenShopId.trim().toLowerCase();
    return shops
      .filter(shop => shop.shopId && !hiddenIds.includes(shop.shopId))
      .filter(shop => {
        if (!query) return true;
        return (
          (shop.shopId || "").toLowerCase().includes(query) ||
          (shop.number || "").toLowerCase().includes(query) ||
          (shop.name || "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => (a.number || "").localeCompare(b.number || "", undefined, { numeric: true }));
  }, [shops, settings.hiddenShopIds, newHiddenShopId]);

  return (
    <div style={{ color: "#ffffff", fontFamily: "'Rounded Mplus 1c', sans-serif" }}>
      <h2 style={{ fontSize: "20px", marginBottom: "20px" }}>ジャンルメモ設定</h2>

      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "12px", color: "#aaaaaa" }}>
          最大表示件数
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            type="number"
            value={settings.maxItems}
            onChange={handleMaxItemsChange}
            min="1"
            max="10"
            style={{
              padding: "8px",
              backgroundColor: "#333333",
              border: "1px solid #555555",
              borderRadius: "4px",
              color: "#ffffff",
              fontSize: "14px",
              width: "80px",
            }}
          />
          <span style={{ fontSize: "14px", color: "#cccccc" }}>件</span>
        </div>
        <p style={{ fontSize: "12px", color: "#888888", marginTop: "8px" }}>
          ショップカードや詳細画面に表示するジャンルメモの最大数です。これを超える項目は省略されます。
        </p>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "12px", color: "#aaaaaa" }}>
          除外キーワード
        </h3>
        <p style={{ fontSize: "12px", color: "#888888", marginBottom: "12px" }}>
          以下のキーワードと完全一致するジャンルメモは表示されません。
        </p>

        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", position: "relative" }}>
             {/* カスタムドロップダウン入力欄（除外キーワード） */}
            <div style={{ flex: 1, position: "relative" }}>
                <input
                    ref={ignoredInputRef}
                    type="text"
                    value={newKeyword}
                    onChange={(e) => {
                        setNewKeyword(e.target.value);
                        setShowIgnoredDropdown(true);
                    }}
                    onFocus={() => setShowIgnoredDropdown(true)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleAddKeyword();
                            setShowIgnoredDropdown(false);
                        }
                    }}
                    placeholder="リストから選択または入力"
                    style={{
                        width: "100%",
                        padding: "10px",
                        backgroundColor: "#333333",
                        border: "1px solid #555555",
                        borderRadius: "4px",
                        color: "#ffffff",
                        fontSize: "14px",
                        boxSizing: "border-box"
                    }}
                />
                
                 {/* ドロップダウンリスト（除外キーワード） */}
                {showIgnoredDropdown && filteredIgnoredOptions.length > 0 && (
                    <div 
                        ref={ignoredDropdownRef}
                        style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            width: "100%",
                            maxHeight: "400px",
                            overflowY: "auto",
                            backgroundColor: "#333333",
                            border: "1px solid #555555",
                            borderTop: "none",
                            borderRadius: "0 0 4px 4px",
                            zIndex: 100,
                            boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
                        }}
                    >
                        {filteredIgnoredOptions.map((memo) => (
                            <div
                                key={memo}
                                onClick={() => {
                                    setNewKeyword(memo);
                                    setShowIgnoredDropdown(false);
                                }}
                                style={{
                                    padding: "8px 12px",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    color: "#ffffff",
                                    borderBottom: "1px solid #444444"
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#444444"}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                            >
                                {memo}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            <button
                onClick={handleAddKeyword}
                disabled={!newKeyword.trim()}
                style={{
                    padding: "0 20px",
                    backgroundColor: newKeyword.trim() ? "#007acc" : "#555555",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: newKeyword.trim() ? "pointer" : "not-allowed",
                    fontSize: "14px",
                    fontWeight: "bold",
                }}
            >
                追加
            </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {settings.ignoredKeywords && settings.ignoredKeywords.map((keyword, index) => (
                <div key={`${keyword}-${index}`} style={{
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#444444",
                    borderRadius: "20px",
                    padding: "6px 12px",
                    border: "1px solid #555555"
                }}>
                    <span style={{ marginRight: "8px", fontSize: "14px" }}>{keyword}</span>
                    <button
                        onClick={() => handleRemoveKeyword(keyword)}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#aaaaaa",
                            cursor: "pointer",
                            fontSize: "18px",
                            lineHeight: "1",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                            width: "20px",
                            height: "20px",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = "#ff6b6b"}
                        onMouseLeave={(e) => e.currentTarget.style.color = "#aaaaaa"}
                        title="削除"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
      </div>

      <div style={{ borderTop: "1px solid #444444", margin: "32px 0" }} />

      {/* --- 非表示ショップ設定 --- */}
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "12px", color: "#aaaaaa" }}>
          非表示ショップ
        </h3>
        <p style={{ fontSize: "12px", color: "#888888", marginBottom: "12px" }}>
          以下のショップIDの店舗は、ショップデータ（API）に存在していても表示されません。<br/>
          屋号変更などで旧店舗のページがHPに残る場合に使用します。
        </p>

        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", position: "relative" }}>
            {/* カスタムドロップダウン入力欄（非表示ショップ） */}
            <div style={{ flex: 1, position: "relative" }}>
                <input
                    ref={hiddenShopInputRef}
                    type="text"
                    value={newHiddenShopId}
                    onChange={(e) => {
                        setNewHiddenShopId(e.target.value);
                        setShowHiddenShopDropdown(true);
                    }}
                    onFocus={() => setShowHiddenShopDropdown(true)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleAddHiddenShopId();
                            setShowHiddenShopDropdown(false);
                        }
                    }}
                    placeholder="リストから選択またはショップIDを入力"
                    style={{
                        width: "100%",
                        padding: "10px",
                        backgroundColor: "#333333",
                        border: "1px solid #555555",
                        borderRadius: "4px",
                        color: "#ffffff",
                        fontSize: "14px",
                        boxSizing: "border-box"
                    }}
                />

                {/* ドロップダウンリスト（非表示ショップ） */}
                {showHiddenShopDropdown && filteredHiddenShopOptions.length > 0 && (
                    <div
                        ref={hiddenShopDropdownRef}
                        style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            width: "100%",
                            maxHeight: "400px",
                            overflowY: "auto",
                            backgroundColor: "#333333",
                            border: "1px solid #555555",
                            borderTop: "none",
                            borderRadius: "0 0 4px 4px",
                            zIndex: 100,
                            boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
                        }}
                    >
                        {filteredHiddenShopOptions.map((shop) => (
                            <div
                                key={shop.shopId}
                                onClick={() => {
                                    setNewHiddenShopId(shop.shopId || "");
                                    setShowHiddenShopDropdown(false);
                                }}
                                style={{
                                    padding: "8px 12px",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    color: "#ffffff",
                                    borderBottom: "1px solid #444444"
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#444444"}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                            >
                                {getShopLabel(shop.shopId || "")}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <button
                onClick={handleAddHiddenShopId}
                disabled={!newHiddenShopId.trim()}
                style={{
                    padding: "0 20px",
                    backgroundColor: newHiddenShopId.trim() ? "#007acc" : "#555555",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: newHiddenShopId.trim() ? "pointer" : "not-allowed",
                    fontSize: "14px",
                    fontWeight: "bold",
                }}
            >
                追加
            </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {(settings.hiddenShopIds || []).map((shopId) => (
                <div key={shopId} style={{
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#444444",
                    borderRadius: "20px",
                    padding: "6px 12px",
                    border: "1px solid #555555"
                }}>
                    <span style={{ marginRight: "8px", fontSize: "14px" }}>{getShopLabel(shopId)}</span>
                    <button
                        onClick={() => handleRemoveHiddenShopId(shopId)}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#aaaaaa",
                            cursor: "pointer",
                            fontSize: "18px",
                            lineHeight: "1",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                            width: "20px",
                            height: "20px",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = "#ff6b6b"}
                        onMouseLeave={(e) => e.currentTarget.style.color = "#aaaaaa"}
                        title="削除"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
      </div>

      <div style={{ borderTop: "1px solid #444444", margin: "32px 0" }} />

      {/* --- カテゴリー検索キーワード設定 --- */}
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "12px", color: "#aaaaaa" }}>
          カテゴリー検索キーワード設定
        </h3>
        <p style={{ fontSize: "12px", color: "#888888", marginBottom: "16px" }}>
          トップ画面のカテゴリーボタンを選択した際に検索されるキーワードを設定します。<br/>
          ここで設定したキーワードがジャンルメモに含まれている店舗が表示されます。
        </p>

        {/* カテゴリー選択タブ */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {(Object.keys(CATEGORY_LABELS) as CategoryKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              style={{
                padding: "8px 16px",
                backgroundColor: selectedCategory === key ? "#007acc" : "#333333",
                color: "#ffffff",
                border: "1px solid #555555",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: selectedCategory === key ? "bold" : "normal",
              }}
            >
              {CATEGORY_LABELS[key]}
            </button>
          ))}
        </div>

        {/* キーワード追加エリア */}
        <div style={{ backgroundColor: "#252525", padding: "16px", borderRadius: "8px", border: "1px solid #444444" }}>
          <h4 style={{ fontSize: "14px", marginBottom: "12px", color: "#ffffff" }}>
            {CATEGORY_LABELS[selectedCategory]} のキーワード
          </h4>

          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", position: "relative" }}>
            {/* カスタムドロップダウン入力欄 */}
            <div style={{ flex: 1, position: "relative" }}>
              <input
                ref={inputRef}
                type="text"
                value={newCategoryKeyword}
                onChange={(e) => {
                  setNewCategoryKeyword(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddCategoryKeyword();
                    setShowDropdown(false);
                  }
                }}
                placeholder="リストから選択または入力"
                style={{
                  width: "100%",
                  padding: "10px",
                  backgroundColor: "#333333",
                  border: "1px solid #555555",
                  borderRadius: "4px",
                  color: "#ffffff",
                  fontSize: "14px",
                  boxSizing: "border-box"
                }}
              />
              
              {/* ドロップダウンリスト */}
              {showDropdown && filteredOptions.length > 0 && (
                <div 
                  ref={dropdownRef}
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    width: "100%",
                    maxHeight: "400px",
                    overflowY: "auto",
                    backgroundColor: "#333333",
                    border: "1px solid #555555",
                    borderTop: "none",
                    borderRadius: "0 0 4px 4px",
                    zIndex: 100,
                    boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
                  }}
                >
                  {filteredOptions.map((memo) => (
                    <div
                      key={memo}
                      onClick={() => {
                        setNewCategoryKeyword(memo);
                        setShowDropdown(false);
                      }}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        fontSize: "14px",
                        color: "#ffffff",
                        borderBottom: "1px solid #444444"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#444444"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      {memo}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleAddCategoryKeyword}
              disabled={!newCategoryKeyword.trim()}
              style={{
                padding: "0 20px",
                backgroundColor: newCategoryKeyword.trim() ? "#007acc" : "#555555",
                color: "#ffffff",
                border: "none",
                borderRadius: "4px",
                cursor: newCategoryKeyword.trim() ? "pointer" : "not-allowed",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              追加
            </button>
          </div>

          {/* 現在のキーワード一覧 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {((settings.categoryMapping || DEFAULT_CATEGORY_MAPPINGS)[selectedCategory] || []).map((keyword, index) => (
              <div key={`${selectedCategory}-${keyword}-${index}`} style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "#444444",
                borderRadius: "20px",
                padding: "6px 12px",
                border: "1px solid #555555"
              }}>
                <span style={{ marginRight: "8px", fontSize: "14px" }}>{keyword}</span>
                <button
                  onClick={() => handleRemoveCategoryKeyword(keyword)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#aaaaaa",
                    cursor: "pointer",
                    fontSize: "18px",
                    lineHeight: "1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    width: "20px",
                    height: "20px",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "#ff6b6b"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "#aaaaaa"}
                  title="削除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
