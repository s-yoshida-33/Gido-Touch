// src/components/CurrentFloorSettingsTab.tsx
import React, { useState, useMemo } from "react";
import type { FloorId, FloorLayout } from "../types/floorLayout";
import type { Shop } from "../types/shop";
import type { SubFloorSettings } from "../types/global";
import type { MallId } from "../hooks/useMallAssets";

export interface CurrentFloorSettingsTabProps {
  currentFloorSetting: string;
  onChangeCurrentFloorSetting: (floor: string) => void;
  displayFloors: string[];
  onChangeDisplayFloors: (floors: string[]) => void;
  floorLayout?: FloorLayout;
  onChangeFloorLayout?: (layout: FloorLayout) => void;
  shops?: Shop[];
  subFloorSettings?: SubFloorSettings;
  onChangeSubFloorSettings?: (settings: SubFloorSettings) => void;
  mallId: MallId;
}

export const CurrentFloorSettingsTab: React.FC<CurrentFloorSettingsTabProps> = ({ 
  currentFloorSetting, 
  onChangeCurrentFloorSetting, 
  displayFloors, 
  onChangeDisplayFloors,
  floorLayout,
  onChangeFloorLayout,
  shops = [],
  subFloorSettings = { "1F-1": [], "1F-2": [] },
  onChangeSubFloorSettings,
  mallId
}) => {
  const floors: FloorId[] = ["1F", "2F", "3F", "4F"];
  const [editingLayoutFloor, setEditingLayoutFloor] = useState<string>("1F");

  const shopList1F = useMemo(() => {
    return shops.filter(s => {
      if (Array.isArray(s.floors)) return s.floors.includes("1F");
      return String(s.floors || "").includes("1F");
    }).sort((a, b) => (a.number || "").localeCompare(b.number || ""));
  }, [shops]);

  const handleCurrentFloorChange = (newFloor: string) => {
    onChangeCurrentFloorSetting(newFloor);
  };

  const handleDisplayFloorChange = (floor: string, checked: boolean) => {
    let newDisplayFloors = [...displayFloors];
    if (checked) {
      if (!newDisplayFloors.includes(floor)) {
        newDisplayFloors.push(floor);
      }
    } else {
      newDisplayFloors = newDisplayFloors.filter(f => f !== floor);
    }
    // Sort to keep order consistent
    newDisplayFloors.sort();
    onChangeDisplayFloors(newDisplayFloors);
  };

  const handleLayoutChange = (key: 'columns' | 'rowsPerCol' | 'maxRows' | 'autoWidth' | 'prioritizeCurrentFloor', value: number | boolean) => {
    if (!floorLayout || !onChangeFloorLayout) return;
    
    const current = floorLayout[editingLayoutFloor] || { columns: 3, rowsPerCol: 20 };
    const updated = {
      ...floorLayout,
      [editingLayoutFloor]: {
        ...current,
        [key]: value
      }
    };
    onChangeFloorLayout(updated);
  };

  const handleSubFloorShopToggle = (subFloor: "1F-1" | "1F-2", shopId: string, checked: boolean) => {
    if (!onChangeSubFloorSettings) return;
    
    const currentIds = subFloorSettings[subFloor] || [];
    let newIds: string[];
    
    if (checked) {
      if (!currentIds.includes(shopId)) {
        newIds = [...currentIds, shopId];
      } else {
        newIds = currentIds;
      }
    } else {
      newIds = currentIds.filter(id => id !== shopId);
    }
    
    onChangeSubFloorSettings({
      ...subFloorSettings,
      [subFloor]: newIds
    });
  };

  const isSendai = mallId === 'sendaikamisugi';

  return (
    <div>
      <h3 style={{ color: "#ffffff", fontSize: 18, fontWeight: 600, marginBottom: 24 }}>フロア設定</h3>

      <div style={{ padding: 16, backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, marginBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ display: "block", color: "rgba(255, 255, 255, 0.8)", fontSize: 13, fontWeight: 500 }}>
          カレントフロア設定（現在地）
        </label>
          <select
            value={currentFloorSetting}
            onChange={(e) => handleCurrentFloorChange(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", backgroundColor: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 6, color: "#ffffff", fontSize: 14 }}
          >
            {floors.map((f) => (
              <option key={f} value={f} style={{ backgroundColor: "#2C2C2C", color: "#ffffff" }}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ padding: 16, backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, marginBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "block", color: "rgba(255, 255, 255, 0.8)", fontSize: 13, fontWeight: 500 }}>
            表示フロア設定
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {floors.map((f) => (
              <label key={f} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#ffffff", fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={displayFloors.includes(f)}
                  onChange={(e) => handleDisplayFloorChange(f, e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                {f}
              </label>
            ))}
          </div>
        </div>
      </div>

      {isSendai && onChangeSubFloorSettings && (
        <div style={{ padding: 16, backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, marginBottom: 24 }}>
          <h4 style={{ color: "#ffffff", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            1Fサブフロア設定 (表示店舗選択) [仙台上杉限定]
          </h4>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {["1F-1", "1F-2"].map((subFloor) => (
              <div key={subFloor}>
                <h5 style={{ color: "#ffffff", fontSize: 14, fontWeight: 600, marginBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 4 }}>
                  {subFloor} ボタン表示店舗
                </h5>
                <div style={{ maxHeight: "200px", overflowY: "auto", display: "grid", gridTemplateColumns: "1fr", gap: 4, padding: 8, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 6 }}>
                  {shopList1F.map(shop => {
                    const shopId = shop.shopId || shop.number || "";
                    const isChecked = (subFloorSettings[subFloor] || []).includes(shopId);
                    return (
                      <label key={`${subFloor}-${shopId}`} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#ffffff", fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleSubFloorShopToggle(subFloor as any, shopId, e.target.checked)}
                          style={{ cursor: "pointer" }}
                        />
                        <span style={{opacity: 0.7, fontSize: 11, width: 30}}>{shop.number}</span>
                        <span>{shop.name}</span>
                      </label>
                    );
                  })}
                  {shopList1F.length === 0 && <div style={{color: "#888", fontSize: 12}}>1Fの店舗データがありません</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {floorLayout && onChangeFloorLayout && (
        <div style={{ padding: 16, backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}>
          <h4 style={{ color: "#ffffff", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            レイアウト設定 (詳細)
          </h4>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", color: "rgba(255, 255, 255, 0.8)", fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
              編集対象フロア
            </label>
            <select
              value={editingLayoutFloor}
              onChange={(e) => setEditingLayoutFloor(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", backgroundColor: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 6, color: "#ffffff", fontSize: 14 }}
            >
              <option value="ALL" style={{ backgroundColor: "#2C2C2C", color: "#ffffff" }}>一覧 (ALL)</option>
              {floors.map((f) => (
                <option key={f} value={f} style={{ backgroundColor: "#2C2C2C", color: "#ffffff" }}>{f}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", color: "rgba(255, 255, 255, 0.8)", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                列数 (Columns)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={floorLayout[editingLayoutFloor]?.columns ?? 3}
                onChange={(e) => handleLayoutChange('columns', parseInt(e.target.value) || 1)}
                style={{ width: "100%", padding: "8px", backgroundColor: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 6, color: "#ffffff" }}
              />
            </div>
            <div>
              <label style={{ display: "block", color: "rgba(255, 255, 255, 0.8)", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                1列の行数 (Rows)
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={floorLayout[editingLayoutFloor]?.rowsPerCol ?? 20}
                onChange={(e) => handleLayoutChange('rowsPerCol', parseInt(e.target.value) || 1)}
                style={{ width: "100%", padding: "8px", backgroundColor: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 6, color: "#ffffff" }}
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: "block", color: "rgba(255, 255, 255, 0.8)", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
              最大行数 (Max Rows) <span style={{fontSize: '0.8em', color: '#888'}}>※0で無効、設定時は自動伸縮</span>
            </label>
            <input
              type="number"
              min="0"
              max="50"
              value={floorLayout[editingLayoutFloor]?.maxRows ?? 0}
              onChange={(e) => handleLayoutChange('maxRows', parseInt(e.target.value) || 0)}
              style={{ width: "100%", padding: "8px", backgroundColor: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 6, color: "#ffffff" }}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "rgba(255, 255, 255, 0.8)", fontSize: 13, fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={floorLayout[editingLayoutFloor]?.autoWidth ?? true}
                onChange={(e) => handleLayoutChange('autoWidth', e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              横幅自動調整 (店舗数が少ない場合に画面幅を埋める)
            </label>
          </div>

          {editingLayoutFloor === "ALL" && (
            <div style={{ marginTop: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "rgba(255, 255, 255, 0.8)", fontSize: 13, fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={floorLayout[editingLayoutFloor]?.prioritizeCurrentFloor ?? false}
                  onChange={(e) => handleLayoutChange('prioritizeCurrentFloor', e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                カレントフロアの店舗を優先表示する
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
