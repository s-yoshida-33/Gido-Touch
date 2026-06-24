import React, { useState, useMemo } from "react";
import type { FloorId } from "../types/floorLayout";
import type { PictoSettings, PictoInstance, PictoTag } from "../types/picto";
import type { AnimationConfig, AnimationType, ShadowConfig } from "../types/locationIcon";

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const clampPercent = (v: number) => Math.round(Math.min(100, Math.max(0, isNaN(v) ? 0 : v)) * 100) / 100;
const clampRotation = (v: number) => { const n = isNaN(v) ? 0 : v; return Math.min(360, Math.max(0, n)); };

const HALONG_PICTO_TAGS: Array<{ id: PictoTag; label: string }> = [
  { id: "atm",             label: "ATM" },
  { id: "elevator",        label: "エレベーター" },
  { id: "free_coin_lockers", label: "無料コインロッカー" },
  { id: "info",            label: "インフォメーション" },
  { id: "restroom",        label: "トイレ" },
  { id: "smoking_room",    label: "喫煙所" },
];

const HALONG_ICON_FILES = [
  "atm.svg",
  "elevator.svg",
  "free-coin-lockers.svg",
  "info.svg",
  "restroom.svg",
  "smoking-room.svg",
];

const ConfigGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <fieldset style={{ border: "1px solid rgba(255,255,255,0.1)", padding: 16, borderRadius: 12, marginBottom: 16, backgroundColor: "rgba(255,255,255,0.03)" }}>
    <legend style={{ fontWeight: 600, color: "rgba(255,255,255,0.9)", padding: "0 8px", fontSize: 14 }}>{title}</legend>
    {children}
  </fieldset>
);

export interface PictoSettingsTabProps {
  floor: FloorId;
  onChangeFloor: (floor: FloorId) => void;
  pictoSettings: PictoSettings;
  onSavePictoSettings: (settings: PictoSettings) => void;
  selectedInstanceId?: string | null;
  onSelectedInstanceIdChange?: (id: string | null) => void;
  iconOptions: Array<{ fileName: string; url: string }>;
}

export const PictoSettingsTab: React.FC<PictoSettingsTabProps> = ({
  floor,
  onChangeFloor,
  pictoSettings,
  onSavePictoSettings,
  selectedInstanceId: externalSelectedInstanceId,
  onSelectedInstanceIdChange,
  iconOptions,
}) => {
  const [selectedIconFile, setSelectedIconFile] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<PictoTag>("info");
  const [internalSelectedInstanceId, setInternalSelectedInstanceId] = useState<string | null>(null);

  const selectedInstanceId = externalSelectedInstanceId !== undefined ? externalSelectedInstanceId : internalSelectedInstanceId;
  const setSelectedInstanceId = (id: string | null) => {
    if (onSelectedInstanceIdChange) onSelectedInstanceIdChange(id);
    else setInternalSelectedInstanceId(id);
  };

  const floorInstances = useMemo(
    () => Object.values(pictoSettings.instances).filter((i) => i.floor === floor),
    [pictoSettings, floor]
  );

  const selectedInstance = selectedInstanceId ? pictoSettings.instances[selectedInstanceId] : null;

  const handleAddInstance = () => {
    if (!selectedIconFile) return;
    const newId = generateUUID();
    const newInstance: PictoInstance = {
      id: newId,
      tag: selectedTag,
      iconName: selectedIconFile,
      floor,
      x: 50,
      y: 50,
      size: 80,
      rotation: 0,
      shadow: { enabled: true, offsetX: 4, offsetY: 4, blur: 4, opacity: 0.5 },
      animation: { enabled: true, type: "bounce", duration: 2.0, amplitude: 15 },
    };
    onSavePictoSettings({
      ...pictoSettings,
      instances: { ...pictoSettings.instances, [newId]: newInstance },
    });
    setSelectedInstanceId(newId);
  };

  const handleDeleteInstance = () => {
    if (!selectedInstanceId) return;
    const { [selectedInstanceId]: _, ...rest } = pictoSettings.instances;
    onSavePictoSettings({ ...pictoSettings, instances: rest });
    setSelectedInstanceId(null);
  };

  const updateInstance = (updates: Partial<PictoInstance>) => {
    if (!selectedInstanceId || !selectedInstance) return;
    onSavePictoSettings({
      ...pictoSettings,
      instances: { ...pictoSettings.instances, [selectedInstanceId]: { ...selectedInstance, ...updates } },
    });
  };

  const updateShadow = (updates: Partial<ShadowConfig>) => {
    if (!selectedInstanceId || !selectedInstance) return;
    updateInstance({
      shadow: {
        ...(selectedInstance.shadow || { enabled: false, offsetX: 0, offsetY: 0, blur: 0, opacity: 0 }),
        ...updates,
      },
    });
  };

  const updateAnimation = (updates: Partial<AnimationConfig>) => {
    if (!selectedInstanceId || !selectedInstance) return;
    updateInstance({
      animation: {
        ...(selectedInstance.animation || { enabled: false, type: "none", duration: 1, amplitude: 0 }),
        ...updates,
      },
    });
  };

  const inputStyle: React.CSSProperties = { backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 8px", color: "#ffffff", fontSize: 13 };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <h3 style={{ color: "#ffffff", fontSize: 18, fontWeight: 600, marginBottom: 24 }}>ピクトグラム設定</h3>
      <div style={{ display: "flex", gap: 20, height: "100%", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", paddingRight: 10 }}>

          {/* Floor Selection */}
          <div>
            <label style={{ display: "block", color: "rgba(255,255,255,0.8)", fontSize: 13, marginBottom: 8, fontWeight: 500 }}>フロア選択</label>
            <select
              value={floor}
              onChange={(e) => { onChangeFloor(e.target.value as FloorId); setSelectedInstanceId(null); }}
              style={{ width: "100%", padding: "8px 12px", ...inputStyle }}
            >
              {["1F", "2F", "3F", "4F"].map((f) => (
                <option key={f} value={f} style={{ backgroundColor: "#2C2C2C" }}>{f}</option>
              ))}
            </select>
          </div>

          {/* New Instance */}
          <ConfigGroup title="新規配置">
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>アイコン選択</div>
              <select
                value={selectedIconFile || ""}
                onChange={(e) => setSelectedIconFile(e.target.value || null)}
                style={{ width: "100%", padding: "8px", ...inputStyle }}
              >
                <option value="" style={{ backgroundColor: "#2C2C2C" }}>選択してください</option>
                {(iconOptions.length > 0 ? iconOptions : HALONG_ICON_FILES.map((f) => ({ fileName: f, url: "" }))).map((opt) => (
                  <option key={opt.fileName} value={opt.fileName} style={{ backgroundColor: "#2C2C2C" }}>{opt.fileName}</option>
                ))}
              </select>
              {selectedIconFile && (() => {
                const url = iconOptions.find((o) => o.fileName === selectedIconFile)?.url;
                return url ? (
                  <div style={{ marginTop: 10, width: 60, height: 60, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 6, padding: 4, display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <img src={url} alt="preview" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  </div>
                ) : null;
              })()}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>タグ選択</div>
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value as PictoTag)}
                style={{ width: "100%", padding: "8px", ...inputStyle }}
              >
                {HALONG_PICTO_TAGS.map((t) => (
                  <option key={t.id} value={t.id} style={{ backgroundColor: "#2C2C2C" }}>{t.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAddInstance}
              disabled={!selectedIconFile}
              style={{
                width: "100%", padding: "10px",
                backgroundColor: selectedIconFile ? "#007aff" : "rgba(255,255,255,0.1)",
                color: selectedIconFile ? "#fff" : "rgba(255,255,255,0.3)",
                border: "none", borderRadius: 6, cursor: selectedIconFile ? "pointer" : "not-allowed", fontWeight: 600,
              }}
            >配置する</button>
          </ConfigGroup>

          {/* Instance List */}
          <div style={{ flex: "0 0 auto", maxHeight: 300, overflowY: "auto" }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>配置済み ({floorInstances.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {floorInstances.map((inst) => {
                const iconUrl = iconOptions.find((o) => o.fileName === inst.iconName)?.url || "";
                return (
                  <div
                    key={inst.id}
                    onClick={() => setSelectedInstanceId(inst.id)}
                    style={{
                      padding: 10,
                      backgroundColor: selectedInstanceId === inst.id ? "rgba(0,122,255,0.2)" : "rgba(255,255,255,0.05)",
                      border: selectedInstanceId === inst.id ? "1px solid #007aff" : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                    }}
                  >
                    <div style={{ width: 30, height: 30, backgroundColor: "#fff", borderRadius: 4, padding: 2 }}>
                      {iconUrl && <img src={iconUrl} style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
                    </div>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{HALONG_PICTO_TAGS.find((t) => t.id === inst.tag)?.label ?? inst.tag}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{inst.iconName}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Edit Selected Instance */}
          <div style={{ flex: "0 0 auto", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 20 }}>
            {selectedInstance ? (
              <>
                <ConfigGroup title="基本設定">
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>タグ</div>
                    <select value={selectedInstance.tag} onChange={(e) => updateInstance({ tag: e.target.value as PictoTag })} style={{ width: "100%", padding: "8px", ...inputStyle }}>
                      {HALONG_PICTO_TAGS.map((t) => <option key={t.id} value={t.id} style={{ backgroundColor: "#2C2C2C" }}>{t.label}</option>)}
                    </select>
                  </div>

                  {[{ label: "X位置 (%)", key: "x" as const }, { label: "Y位置 (%)", key: "y" as const }].map(({ label, key }) => (
                    <div key={key} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>{label}</div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input type="range" min={0} max={100} step={0.01} value={selectedInstance[key]} onChange={(e) => updateInstance({ [key]: clampPercent(Number(e.target.value)) })} style={{ flex: 1, accentColor: "#007aff" }} />
                        <input type="number" value={selectedInstance[key]} onChange={(e) => updateInstance({ [key]: clampPercent(Number(e.target.value)) })} step={0.01} min={0} max={100} style={{ width: 70, ...inputStyle }} />
                      </div>
                    </div>
                  ))}

                  <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 120 }}>
                      <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>サイズ (px)</div>
                      <input type="number" value={selectedInstance.size} onChange={(e) => updateInstance({ size: Math.max(1, Number(e.target.value)) })} min={1} step={0.1} style={{ width: 100, ...inputStyle }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>回転 (°)</div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input type="range" min={0} max={360} value={selectedInstance.rotation} onChange={(e) => updateInstance({ rotation: clampRotation(Number(e.target.value)) })} style={{ flex: 1, accentColor: "#007aff" }} />
                        <input type="number" value={selectedInstance.rotation} onChange={(e) => updateInstance({ rotation: clampRotation(Number(e.target.value)) })} min={0} max={360} style={{ width: 70, ...inputStyle }} />
                      </div>
                    </div>
                  </div>

                  {/* Shadow */}
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                    <label style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                      <input type="checkbox" checked={selectedInstance.shadow?.enabled ?? false} onChange={(e) => updateShadow({ enabled: e.target.checked })} style={{ marginRight: 10, width: 18, height: 18, accentColor: "#007aff" }} />
                      <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: 500 }}>シャドウ</span>
                    </label>
                    {selectedInstance.shadow?.enabled && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "flex", gap: 10 }}>
                          {[{ label: "オフセットX", key: "offsetX" as const }, { label: "オフセットY", key: "offsetY" as const }].map(({ label, key }) => (
                            <div key={key} style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>{label}</div>
                              <input type="number" value={selectedInstance.shadow?.[key] ?? 0} onChange={(e) => updateShadow({ [key]: Number(e.target.value) || 0 })} style={{ width: "100%", ...inputStyle }} />
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>ぼかし</div>
                            <input type="number" min={0} value={selectedInstance.shadow?.blur ?? 0} onChange={(e) => updateShadow({ blur: Math.max(0, Number(e.target.value) || 0) })} style={{ width: "100%", ...inputStyle }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>不透明度</div>
                            <input type="number" min={0} max={1} step={0.1} value={selectedInstance.shadow?.opacity ?? 0} onChange={(e) => updateShadow({ opacity: Math.max(0, Math.min(1, Number(e.target.value) || 0)) })} style={{ width: "100%", ...inputStyle }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <button onClick={handleDeleteInstance} style={{ width: "100%", padding: "8px", backgroundColor: "rgba(255,59,48,0.2)", color: "#ff3b30", border: "1px solid #ff3b30", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>削除</button>
                  </div>
                </ConfigGroup>

                <ConfigGroup title="アニメーション">
                  <label style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                    <input type="checkbox" checked={selectedInstance.animation?.enabled ?? false} onChange={(e) => updateAnimation({ enabled: e.target.checked })} style={{ marginRight: 10, width: 18, height: 18, accentColor: "#007aff" }} />
                    <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 14 }}>有効</span>
                  </label>
                  {selectedInstance.animation?.enabled && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>タイプ</div>
                        <select value={selectedInstance.animation?.type ?? "bounce"} onChange={(e) => updateAnimation({ type: e.target.value as AnimationType })} style={{ width: "100%", padding: "8px", ...inputStyle }}>
                          <option value="floating" style={{ backgroundColor: "#2C2C2C" }}>Floating</option>
                          <option value="pulse"    style={{ backgroundColor: "#2C2C2C" }}>Pulse</option>
                          <option value="bounce"   style={{ backgroundColor: "#2C2C2C" }}>Bounce</option>
                          <option value="blink"    style={{ backgroundColor: "#2C2C2C" }}>Blink (Ripple)</option>
                          <option value="none"     style={{ backgroundColor: "#2C2C2C" }}>None</option>
                        </select>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>期間 (秒)</div>
                          <input type="number" value={selectedInstance.animation?.duration ?? 2} onChange={(e) => updateAnimation({ duration: Math.max(0.1, Number(e.target.value) || 2) })} min={0.1} step={0.1} style={{ width: "100%", ...inputStyle }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>振幅</div>
                          <input type="number" value={selectedInstance.animation?.amplitude ?? 15} onChange={(e) => updateAnimation({ amplitude: Number(e.target.value) || 0 })} style={{ width: "100%", ...inputStyle }} />
                        </div>
                      </div>
                      {selectedInstance.animation?.type === "blink" && (
                        <>
                          <div>
                            <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>波紋の色 (HEX)</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                              <span style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRight: "none", borderTopLeftRadius: 6, borderBottomLeftRadius: 6, padding: "6px 8px", color: "#ffffff", fontSize: 13, userSelect: "none" }}>#</span>
                              <input type="text" value={(selectedInstance.animation?.rippleColor || "#FFFFFF").replace(/^#/, "")} onChange={(e) => updateAnimation({ rippleColor: `#${e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase()}` })} placeholder="FFFFFF" maxLength={6} style={{ flex: 1, ...inputStyle, borderLeft: "none", borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }} />
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>波紋サイズ</div>
                              <input type="number" min={1} step={0.1} value={selectedInstance.animation?.rippleSize ?? 1.5} onChange={(e) => updateAnimation({ rippleSize: Math.max(1, Number(e.target.value) || 1.5) })} style={{ width: "100%", ...inputStyle }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>中心サイズ</div>
                              <input type="number" min={0.1} max={2} step={0.05} value={selectedInstance.animation?.rippleCenterSize ?? 0.95} onChange={(e) => updateAnimation({ rippleCenterSize: Math.max(0.1, Number(e.target.value) || 0.95) })} style={{ width: "100%", ...inputStyle }} />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </ConfigGroup>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: 14, paddingTop: 20, textAlign: "center" }}>
                左のリストから選択するか<br />新規配置してください
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
