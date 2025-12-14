import React, { useState, useEffect } from "react";
import type { FloorId } from "../types/floorLayout";

export interface CurrentFloorSettingsTabProps {
  currentFloorSetting: string;
  onChangeCurrentFloorSetting: (floor: string) => void;
}

export const CurrentFloorSettingsTab: React.FC<CurrentFloorSettingsTabProps> = ({ currentFloorSetting, onChangeCurrentFloorSetting }) => {
  const floors: FloorId[] = ["1F", "2F", "3F", "4F"];

  const handleCurrentFloorChange = (newFloor: string) => {
    onChangeCurrentFloorSetting(newFloor);
  };

  return (
    <div>
      <h3 style={{ color: "#ffffff", fontSize: 18, fontWeight: 600, marginBottom: 24 }}>フロア設定</h3>

      <div style={{ padding: 16, backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}>
        <label style={{ display: "block", color: "rgba(255, 255, 255, 0.9)", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          カレントフロア設定（現在地）
        </label>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>この端末の設置フロア:</span>
          <select
            value={currentFloorSetting}
            onChange={(e) => handleCurrentFloorChange(e.target.value)}
            style={{ padding: "6px 12px", backgroundColor: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 6, color: "#ffffff", fontSize: 14 }}
          >
            {floors.map((f) => (
              <option key={f} value={f} style={{ backgroundColor: "#2C2C2C", color: "#ffffff" }}>{f}</option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
          ※アプリ起動時にこのフロアが初期表示され、フロアボタン上に現在地アイコンが表示されます。
        </div>
      </div>
    </div>
  );
};

