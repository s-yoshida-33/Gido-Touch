import React from 'react';
import type { LocalMediaTextSettings } from '../types/global';
import type { AudioSettings } from '../types/audioSettings';
import type { Shop } from '../types/shop';

interface LocalMediaSettingsTabProps {
  settings: LocalMediaTextSettings;
  onChangeSettings: (settings: LocalMediaTextSettings) => void;
  audioSettings: AudioSettings;
  onChangeAudioSettings: (settings: AudioSettings) => void;
  shops: Shop[];
}

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        backgroundColor: "#333",
        borderRadius: 8,
        border: "1px solid #555",
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 50,
          height: 30,
          backgroundColor: checked ? "#34C759" : "#e9e9ea", // iOS green or gray
          borderRadius: 15,
          position: "relative",
          cursor: "pointer",
          transition: "background-color 0.2s",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 22 : 2,
            width: 26,
            height: 26,
            backgroundColor: "white",
            borderRadius: "50%",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "left 0.2s",
          }}
        />
      </div>
    </div>
  );
};

export const LocalMediaSettingsTab: React.FC<LocalMediaSettingsTabProps> = ({
  audioSettings,
  onChangeAudioSettings,
}) => {
  return (
    <div style={{ color: "#ffffff" }}>
      <h2 style={{ marginTop: 0, marginBottom: 24, fontSize: 20, fontWeight: 600 }}>
        ローカルメディア設定
      </h2>
      
      {/* Audio Settings */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, borderBottom: "1px solid #444", paddingBottom: 8 }}>
          オーディオ設定
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ToggleSwitch
            checked={!audioSettings.localMediaMuted}
            onChange={(checked) => onChangeAudioSettings({ ...audioSettings, localMediaMuted: !checked })}
            label="右上のローカルメディアの音声を有効にする"
          />
          <ToggleSwitch
            checked={!audioSettings.cmsMuted}
            onChange={(checked) => onChangeAudioSettings({ ...audioSettings, cmsMuted: !checked })}
            label="右下のCMS配信の音声を有効にする"
          />
        </div>
        <p style={{ color: "#aaa", fontSize: 12, marginTop: 8 }}>
          ※両方の音声を同時に有効にすることも可能です。
        </p>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, borderBottom: "1px solid #444", paddingBottom: 8 }}>
        テキスト表示設定
      </h3>
      <div style={{ backgroundColor: '#222', padding: 20, borderRadius: 8, border: '1px solid #444' }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: '1.6' }}>
          現在、ローカルメディアのテキスト表示は<strong>完全自動連携モード</strong>で動作しています。<br/><br/>
          メディアファイル名（拡張子を除く）と完全に一致するショップIDを持つ店舗情報が自動的に表示されます。<br/>
          テキスト内容を変更したい場合は、CMS（管理画面）側で店舗情報を更新してください。
        </p>
      </div>

      {/* Legacy text settings UI removed */}
    </div>
  );
};
