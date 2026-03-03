// src/screens/VersionInfoScreen.tsx
import React, { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface VersionInfo {
  current: string;
  latest: string | null;
  isLatest: boolean;
  releaseDate?: string;
  releaseNotes?: string;
  checking: boolean;
  error: string | null;
}

const VersionInfoScreen: React.FC<Props> = ({ visible, onClose }) => {
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    current: "",
    latest: null,
    isLatest: false,
    checking: false,
    error: null,
  });

  const [windowPos, setWindowPos] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0,
  });

  useEffect(() => {
    if (visible) {
      checkVersion();
    }
  }, [visible]);

  const checkVersion = async () => {
    setVersionInfo((prev) => ({ ...prev, checking: true, error: null }));

    try {
      // Get current version via Tauri API
      const currentVersion = await getVersion() || "不明";

      // TODO: Implement update checking via Tauri updater plugin
      // For now, just show the current version
      setVersionInfo({
        current: currentVersion,
        latest: null,
        isLatest: false,
        checking: false,
        error: null,
      });
    } catch (error) {
      setVersionInfo((prev) => ({
        ...prev,
        checking: false,
        error: error instanceof Error ? error.message : "エラーが発生しました",
      }));
    }
  };

  const handleClose = () => {
    onClose();
  };

  const handleDragMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...windowPos };

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const nextLeft = startPos.left + dx;
      const nextTop = startPos.top + dy;

      setWindowPos({
        left: Math.max(0, Math.min(window.innerWidth - 200, nextLeft)),
        top: Math.max(0, Math.min(window.innerHeight - 100, nextTop)),
      });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: windowPos.left,
        top: windowPos.top,
        width: 500,
        maxWidth: "95vw",
        backgroundColor: "#1a1a1a",
        borderRadius: 20,
        padding: 24,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
        fontFamily: "'Rounded Mplus 1c', sans-serif",
        border: "1px solid rgba(255,255,255,0.1)",
        zIndex: 9999,
      }}
    >
      <div
        onMouseDown={handleDragMouseDown}
        style={{
          cursor: "move",
          margin: "-8px -8px 16px -8px",
          padding: "8px 8px 0 8px",
          userSelect: "none",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 6, color: "#ffffff", fontSize: 20, fontWeight: 600 }}>
          バージョン情報
        </h2>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.7)",
              marginBottom: 6,
            }}
          >
            現在のバージョン
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "#ffffff",
            }}
          >
            {versionInfo.current || "読み込み中..."}
          </div>
        </div>

        {versionInfo.checking && (
          <div
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            最新バージョンを確認中...
          </div>
        )}

        {!versionInfo.checking && versionInfo.latest && (
          <div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.7)",
                marginBottom: 6,
              }}
            >
              最新バージョン
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: versionInfo.isLatest ? "#00c6ff" : "#ff9500",
              }}
            >
              {versionInfo.latest}
            </div>
            {versionInfo.isLatest && (
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.7)",
                  marginTop: 8,
                }}
              >
                最新バージョンです
              </div>
            )}
            {!versionInfo.isLatest && (
              <div
                style={{
                  fontSize: 13,
                  color: "#ff9500",
                  marginTop: 8,
                }}
              >
                更新が利用可能です
              </div>
            )}
          </div>
        )}

        {!versionInfo.checking && versionInfo.error && (
          <div
            style={{
              fontSize: 13,
              color: "#ff3b30",
              padding: 12,
              backgroundColor: "rgba(255, 59, 48, 0.1)",
              borderRadius: 8,
            }}
          >
            {versionInfo.error}
          </div>
        )}

        {versionInfo.releaseDate && (
          <div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.7)",
                marginBottom: 4,
              }}
            >
              リリース日
            </div>
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              {new Date(versionInfo.releaseDate).toLocaleDateString("ja-JP")}
            </div>
          </div>
        )}

        {versionInfo.releaseNotes && (
          <div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.7)",
                marginBottom: 8,
              }}
            >
              リリースノート
            </div>
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.9)",
                lineHeight: 1.6,
                maxHeight: 150,
                overflowY: "auto",
                padding: 12,
                backgroundColor: "rgba(255,255,255,0.03)",
                borderRadius: 8,
                whiteSpace: "pre-wrap",
              }}
            >
              {versionInfo.releaseNotes}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          marginTop: 24,
          paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <button
          type="button"
          onClick={checkVersion}
          disabled={versionInfo.checking}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.2)",
            backgroundColor: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.9)",
            cursor: versionInfo.checking ? "not-allowed" : "pointer",
            fontWeight: 500,
            fontSize: 14,
            transition: "all 0.2s ease",
            opacity: versionInfo.checking ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!versionInfo.checking) {
              e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)";
          }}
        >
          {versionInfo.checking ? "確認中..." : "再確認"}
        </button>
        <button
          type="button"
          onClick={handleClose}
          style={{
            padding: "10px 24px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, #007aff, #00c6ff)",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
            transition: "all 0.2s ease",
            boxShadow: "0 4px 12px rgba(0, 122, 255, 0.3)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 122, 255, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 122, 255, 0.3)";
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
};

export default VersionInfoScreen;

