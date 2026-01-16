import React, { useState } from "react";
import type { GenreSettings } from "../types/genreSettings";

interface GenreSettingsTabProps {
  settings: GenreSettings;
  onChangeSettings: (settings: GenreSettings) => void;
}

export const GenreSettingsTab: React.FC<GenreSettingsTabProps> = ({
  settings,
  onChangeSettings,
}) => {
  const [newKeyword, setNewKeyword] = useState("");

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddKeyword();
    }
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    const newKeywords = settings.ignoredKeywords.filter(k => k !== keywordToRemove);
    onChangeSettings({
      ...settings,
      ignoredKeywords: newKeywords,
    });
  };

  const handleMaxItemsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0) {
      onChangeSettings({
        ...settings,
        maxItems: val,
      });
    }
  };

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

        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="新しいキーワードを追加"
                style={{
                    flex: 1,
                    padding: "10px",
                    backgroundColor: "#333333",
                    border: "1px solid #555555",
                    borderRadius: "4px",
                    color: "#ffffff",
                    fontSize: "14px",
                }}
            />
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
    </div>
  );
};
