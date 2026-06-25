import React, { useRef, useState } from "react";
import type { FloorId } from "../types/floorLayout";
import type { ImageSettings } from "../types/imageSettings";
import type { HalongBannerSettings, HalongBannerEntry, HalongBannerDisplayMode } from "../types/bannerSettings";
import { mergeBannerEntries } from "../types/bannerSettings";
import type { HalongBannerFile } from "../hooks/useHalongBanners";
import { useMapForceFetch } from "../hooks/useMapForceFetch";

export interface ImageSettingsTabProps {
  floor: FloorId;
  onChangeFloor: (floor: FloorId) => void;
  imageSettings: ImageSettings;
  onChangeImageSettings: (settings: ImageSettings) => void;
  onMapsFetchedFromS3: () => void;
  hostname: string;
  mallId?: string;
  bannerSettings?: HalongBannerSettings;
  availableBanners?: HalongBannerFile[];
  onChangeBannerSettings?: (settings: HalongBannerSettings) => void;
  onReloadBanners?: () => void;
}

const FLOORS: FloorId[] = ["1F", "2F", "3F", "4F"];

export const ImageSettingsTab: React.FC<ImageSettingsTabProps> = ({
  floor,
  onChangeFloor,
  imageSettings,
  onChangeImageSettings,
  onMapsFetchedFromS3,
  hostname,
  mallId,
  bannerSettings,
  availableBanners = [],
  onChangeBannerSettings,
  onReloadBanners,
}) => {
  const floorMapInputRef = useRef<HTMLInputElement>(null);
  const openTimeInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { status: fetchStatus, fetchMaps, reset: resetFetch } = useMapForceFetch();

  const validateSvgFile = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      if (file.type !== "image/svg+xml") {
        resolve(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content && content.includes("<svg")) {
          resolve(true);
        } else {
          resolve(false);
        }
      };
      reader.onerror = () => resolve(false);
      reader.readAsText(file);
    });
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "floorMap" | "openTime",
    floorId?: FloorId
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrors({});

    if (file.type !== "image/svg+xml" && !file.name.toLowerCase().endsWith(".svg")) {
      const errorKey = type === "floorMap" ? `floorMap-${floorId}` : "openTime";
      setErrors({
        ...errors,
        [errorKey]: "SVGファイルのみ選択できます",
      });
      return;
    }

    const isValid = await validateSvgFile(file);
    if (!isValid) {
      const errorKey = type === "floorMap" ? `floorMap-${floorId}` : "openTime";
      setErrors({
        ...errors,
        [errorKey]: "無効なSVGファイルです",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (type === "floorMap" && floorId) {
        onChangeImageSettings({
          ...imageSettings,
          floorMaps: {
            ...imageSettings.floorMaps,
            [floorId]: dataUrl,
          },
        });
      } else if (type === "openTime") {
        onChangeImageSettings({
          ...imageSettings,
          openTimeImage: dataUrl,
        });
      }
    };
    reader.readAsDataURL(file);

    event.target.value = "";
  };

  const handleRemoveImage = (type: "floorMap" | "openTime", floorId?: FloorId) => {
    if (type === "floorMap" && floorId) {
      onChangeImageSettings({
        ...imageSettings,
        floorMaps: {
          ...imageSettings.floorMaps,
          [floorId]: "",
        },
      });
    } else if (type === "openTime") {
      onChangeImageSettings({
        ...imageSettings,
        openTimeImage: "",
      });
    }
  };

  const handleFetchMapsFromS3 = async () => {
    resetFetch();
    const floorMaps = await fetchMaps(hostname);
    if (!floorMaps) return;

    onChangeImageSettings({
      ...imageSettings,
      floorMaps: {
        ...imageSettings.floorMaps,
        ...floorMaps,
      },
    });
    onMapsFetchedFromS3();
  };

  const isFetching = fetchStatus.status === 'fetching';

  return (
    <div style={{ color: "#ffffff" }}>
      <h2 style={{ marginTop: 0, marginBottom: 24, fontSize: 20, fontWeight: 600 }}>
        画像設定
      </h2>

      {/* S3 Map Fetch */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={handleFetchMapsFromS3}
          disabled={isFetching}
          style={{
            width: "100%",
            padding: "10px 16px",
            backgroundColor: isFetching ? "#2E7D32" : "#388E3C",
            border: "none",
            borderRadius: 4,
            color: isFetching ? "#9E9E9E" : "#ffffff",
            cursor: isFetching ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {isFetching ? "取得中..." : "最新のマップ画像を取得"}
        </button>

        {fetchStatus.status !== 'idle' && (
          <div style={{ marginTop: 8 }}>
            {isFetching && (
              <div
                style={{
                  height: 4,
                  backgroundColor: "#2A3F55",
                  borderRadius: 2,
                  marginBottom: 6,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${fetchStatus.progress}%`,
                    backgroundColor: "#4A9EFF",
                    borderRadius: 2,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            )}
            <div
              style={{
                fontSize: 12,
                color:
                  fetchStatus.status === 'error'
                    ? "#EF9A9A"
                    : fetchStatus.status === 'done'
                    ? "#A5D6A7"
                    : "#9E9E9E",
              }}
            >
              {fetchStatus.message}
            </div>
          </div>
        )}
      </div>

      {/* Floor Selection */}
      <div style={{ marginBottom: 32 }}>
        <label
          style={{
            display: "block",
            marginBottom: 8,
            fontSize: 14,
            fontWeight: 500,
            color: "#E0E0E0",
          }}
        >
          階を選択
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          {FLOORS.map((f) => (
            <button
              key={f}
              onClick={() => onChangeFloor(f)}
              style={{
                flex: 1,
                padding: "8px 16px",
                backgroundColor: floor === f ? "#4A9EFF" : "#3A3A3A",
                border: `1px solid ${floor === f ? "#4A9EFF" : "#4A4A4A"}`,
                borderRadius: 4,
                color: "#ffffff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                transition: "all 0.2s",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Floor Map Image */}
      <div style={{ marginBottom: 32 }}>
        <label
          style={{
            display: "block",
            marginBottom: 8,
            fontSize: 14,
            fontWeight: 500,
            color: "#E0E0E0",
          }}
        >
          {floor} マップ画像
        </label>
        <input
          ref={floorMapInputRef}
          type="file"
          accept=".svg,image/svg+xml"
          style={{ display: "none" }}
          onChange={(e) => handleFileSelect(e, "floorMap", floor)}
        />
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            onClick={() => floorMapInputRef.current?.click()}
            style={{
              flex: 1,
              padding: "10px 16px",
              backgroundColor: "#4A9EFF",
              border: "none",
              borderRadius: 4,
              color: "#ffffff",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            画像を選択
          </button>
          {imageSettings.floorMaps[floor] && (
            <button
              onClick={() => handleRemoveImage("floorMap", floor)}
              style={{
                padding: "10px 16px",
                backgroundColor: "#E53935",
                border: "none",
                borderRadius: 4,
                color: "#ffffff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              削除
            </button>
          )}
        </div>
        {errors[`floorMap-${floor}`] && (
          <div style={{ color: "#E53935", fontSize: 12, marginTop: 4 }}>
            {errors[`floorMap-${floor}`]}
          </div>
        )}
        {imageSettings.floorMaps[floor] && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              backgroundColor: "#1A1A1A",
              borderRadius: 4,
              border: "1px solid #3A3A3A",
            }}
          >
            <img
              src={imageSettings.floorMaps[floor]}
              alt={`${floor} map preview`}
              style={{
                maxWidth: "100%",
                maxHeight: 200,
                objectFit: "contain",
              }}
            />
          </div>
        )}
      </div>

      {/* Open Time Image */}
      <div>
        <label
          style={{
            display: "block",
            marginBottom: 8,
            fontSize: 14,
            fontWeight: 500,
            color: "#E0E0E0",
          }}
        >
          営業時間画像
        </label>
        <input
          ref={openTimeInputRef}
          type="file"
          accept=".svg,image/svg+xml"
          style={{ display: "none" }}
          onChange={(e) => handleFileSelect(e, "openTime")}
        />
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            onClick={() => openTimeInputRef.current?.click()}
            style={{
              flex: 1,
              padding: "10px 16px",
              backgroundColor: "#4A9EFF",
              border: "none",
              borderRadius: 4,
              color: "#ffffff",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            画像を選択
          </button>
          {imageSettings.openTimeImage && (
            <button
              onClick={() => handleRemoveImage("openTime")}
              style={{
                padding: "10px 16px",
                backgroundColor: "#E53935",
                border: "none",
                borderRadius: 4,
                color: "#ffffff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              削除
            </button>
          )}
        </div>
        {errors.openTime && (
          <div style={{ color: "#E53935", fontSize: 12, marginTop: 4 }}>
            {errors.openTime}
          </div>
        )}
        {imageSettings.openTimeImage && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              backgroundColor: "#1A1A1A",
              borderRadius: 4,
              border: "1px solid #3A3A3A",
            }}
          >
            <img
              src={imageSettings.openTimeImage}
              alt="Open time preview"
              style={{
                maxWidth: "100%",
                maxHeight: 200,
                objectFit: "contain",
              }}
            />
          </div>
        )}
      </div>

      {/* バナー画像設定（halong のみ） */}
      {mallId === 'halong' && onChangeBannerSettings && (() => {
        const bs = bannerSettings ?? { entries: [], displayMode: 'equal' as HalongBannerDisplayMode, bannerHeight: 200, topMargin: 0, bannerGap: 20, carouselDurationSec: 5 };
        const mode = bs.displayMode ?? 'equal';
        const update = (patch: Partial<typeof bs>) => onChangeBannerSettings({ ...bs, ...patch });
        const mergedEntries: HalongBannerEntry[] = mergeBannerEntries(bs.entries, availableBanners);

        const numStyle: React.CSSProperties = {
          width: "100%", padding: "6px 10px", backgroundColor: "#2A2A2A",
          border: "1px solid #4A4A4A", borderRadius: 4, color: "#fff", fontSize: 13,
          boxSizing: "border-box",
        };
        const labelStyle: React.CSSProperties = { display: "block", marginBottom: 6, fontSize: 13, color: "#B0B0B0" };
        const sectionStyle: React.CSSProperties = { marginBottom: 16 };

        return (
          <div style={{ marginTop: 40 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#E0E0E0" }}>
              バナー画像設定
            </h3>

            {/* バナーを再読み込み */}
            {onReloadBanners && (
              <div style={sectionStyle}>
                <button
                  onClick={onReloadBanners}
                  style={{ width: "100%", padding: "10px 16px", backgroundColor: "#37474F", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 500 }}
                >
                  バナーを再読み込み
                </button>
              </div>
            )}

            {/* 表示モード選択 */}
            <div style={sectionStyle}>
              <label style={labelStyle}>表示モード</label>
              <div style={{ display: "flex", gap: 6 }}>
                {([ ['equal', '均等配置'], ['custom', '任意間隔'], ['carousel', 'カルーセル'] ] as [HalongBannerDisplayMode, string][]).map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => update({ displayMode: m })}
                    style={{
                      flex: 1, padding: "8px 4px", fontSize: 12, fontWeight: 500, border: "none", borderRadius: 4, cursor: "pointer",
                      backgroundColor: mode === m ? "#4A9EFF" : "#3A3A3A",
                      color: mode === m ? "#fff" : "#B0B0B0",
                    }}
                  >{label}</button>
                ))}
              </div>
            </div>

            {/* モード別設定 */}
            {mode === 'equal' && (
              <div style={sectionStyle}>
                <label style={labelStyle}>バナー高さ (px)</label>
                <input type="number" min={50} max={700} value={bs.bannerHeight ?? 200} style={numStyle}
                  onChange={(e) => update({ bannerHeight: Math.max(50, Number(e.target.value)) })} />
              </div>
            )}

            {mode === 'custom' && (
              <>
                <div style={sectionStyle}>
                  <label style={labelStyle}>バナー高さ (px)</label>
                  <input type="number" min={50} max={700} value={bs.bannerHeight ?? 200} style={numStyle}
                    onChange={(e) => update({ bannerHeight: Math.max(50, Number(e.target.value)) })} />
                </div>
                <div style={sectionStyle}>
                  <label style={labelStyle}>上部余白 (px)</label>
                  <input type="number" min={0} max={600} value={bs.topMargin ?? 0} style={numStyle}
                    onChange={(e) => update({ topMargin: Math.max(0, Number(e.target.value)) })} />
                </div>
                <div style={sectionStyle}>
                  <label style={labelStyle}>バナー間隔 (px)</label>
                  <input type="number" min={0} max={300} value={bs.bannerGap ?? 20} style={numStyle}
                    onChange={(e) => update({ bannerGap: Math.max(0, Number(e.target.value)) })} />
                </div>
              </>
            )}

            {mode === 'carousel' && (
              <div style={sectionStyle}>
                <label style={labelStyle}>表示秒数（1枚あたり）</label>
                <input type="number" min={1} max={60} value={bs.carouselDurationSec ?? 5} style={numStyle}
                  onChange={(e) => update({ carouselDurationSec: Math.max(1, Number(e.target.value)) })} />
              </div>
            )}

            {/* バナー一覧 */}
            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle}>
                バナー一覧 {availableBanners.length === 0 ? "（ファイルなし）" : `（${availableBanners.length}件）`}
              </label>
            </div>
            {availableBanners.length === 0 ? (
              <p style={{ fontSize: 12, color: "#757575" }}>medias/halong/assets/banners/ にファイルが見つかりません。</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {mergedEntries.map((entry, idx) => {
                  const bannerFile = availableBanners.find((b) => b.filename === entry.filename);
                  return (
                    <div key={entry.filename} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px", backgroundColor: "#1A1A1A", borderRadius: 4, border: "1px solid #3A3A3A" }}>
                      <div style={{ width: 64, height: 36, flexShrink: 0, backgroundColor: "#2A2A2A", borderRadius: 2, overflow: "hidden" }}>
                        {bannerFile && <img src={bannerFile.url} alt={entry.filename} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                      </div>
                      <span style={{ flex: 1, fontSize: 11, color: "#B0B0B0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.filename}</span>
                      <button
                        onClick={() => { const next = mergedEntries.map((e, i) => i === idx ? { ...e, enabled: !e.enabled } : e); update({ entries: next }); }}
                        style={{ padding: "4px 8px", backgroundColor: entry.enabled ? "#1B5E20" : "#424242", border: "none", borderRadius: 3, color: "#fff", cursor: "pointer", fontSize: 11, flexShrink: 0 }}
                      >{entry.enabled ? "表示" : "非表示"}</button>
                      <button disabled={idx === 0}
                        onClick={() => { const next = [...mergedEntries]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; update({ entries: next }); }}
                        style={{ padding: "4px 6px", backgroundColor: "#2A2A2A", border: "1px solid #3A3A3A", borderRadius: 3, color: idx === 0 ? "#555" : "#ccc", cursor: idx === 0 ? "default" : "pointer", fontSize: 11, flexShrink: 0 }}
                      >▲</button>
                      <button disabled={idx === mergedEntries.length - 1}
                        onClick={() => { const next = [...mergedEntries]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; update({ entries: next }); }}
                        style={{ padding: "4px 6px", backgroundColor: "#2A2A2A", border: "1px solid #3A3A3A", borderRadius: 3, color: idx === mergedEntries.length - 1 ? "#555" : "#ccc", cursor: idx === mergedEntries.length - 1 ? "default" : "pointer", fontSize: 11, flexShrink: 0 }}
                      >▼</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};
