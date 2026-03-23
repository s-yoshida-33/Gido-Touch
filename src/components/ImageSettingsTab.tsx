import React, { useRef, useState } from "react";
import type { FloorId } from "../types/floorLayout";
import type { ImageSettings } from "../types/imageSettings";
import { useMapForceFetch } from "../hooks/useMapForceFetch";

export interface ImageSettingsTabProps {
  floor: FloorId;
  onChangeFloor: (floor: FloorId) => void;
  imageSettings: ImageSettings;
  onChangeImageSettings: (settings: ImageSettings) => void;
  onMapsFetchedFromS3: () => void;
}

const FLOORS: FloorId[] = ["1F", "2F", "3F", "4F"];

export const ImageSettingsTab: React.FC<ImageSettingsTabProps> = ({
  floor,
  onChangeFloor,
  imageSettings,
  onChangeImageSettings,
  onMapsFetchedFromS3,
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
    const floorMaps = await fetchMaps();
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
      <div
        style={{
          marginBottom: 32,
          padding: 16,
          backgroundColor: "#1E2A3A",
          borderRadius: 6,
          border: "1px solid #2A3F55",
        }}
      >
        <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 500, color: "#E0E0E0" }}>
          マップ画像の自動取得
        </div>
        <div style={{ marginBottom: 12, fontSize: 12, color: "#9E9E9E" }}>
          S3から全フロア分の最新マップ画像を取得します。保存時に反映されます。
        </div>
        <button
          onClick={handleFetchMapsFromS3}
          disabled={isFetching}
          style={{
            padding: "10px 16px",
            backgroundColor: isFetching ? "#2A3F55" : "#1565C0",
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
          <div style={{ marginTop: 12 }}>
            {isFetching && (
              <div
                style={{
                  height: 4,
                  backgroundColor: "#2A3F55",
                  borderRadius: 2,
                  marginBottom: 8,
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
    </div>
  );
};
