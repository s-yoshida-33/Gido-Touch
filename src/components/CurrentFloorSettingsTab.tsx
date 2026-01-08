import React from "react";
import type { FloorId } from "../types/floorLayout";

export interface CurrentFloorSettingsTabProps {
  currentFloorSetting: string;
  onChangeCurrentFloorSetting: (floor: string) => void;
  displayFloors: string[];
  onChangeDisplayFloors: (floors: string[]) => void;
}

export const CurrentFloorSettingsTab: React.FC<CurrentFloorSettingsTabProps> = ({ currentFloorSetting, onChangeCurrentFloorSetting, displayFloors, onChangeDisplayFloors }) => {
  const floors: FloorId[] = ["1F", "2F", "3F", "4F"];

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

      <div style={{ padding: 16, backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}>
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
    </div>
  );
};
