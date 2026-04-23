import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { LocalMediaTextSettings } from '../types/global';
import type { AudioSettings } from '../types/audioSettings';
import type { Shop } from '../types/shop';
import type { CmsSettings } from '../types/cmsSettings';

interface LocalMediaSettingsTabProps {
  settings: LocalMediaTextSettings;
  onChangeSettings: (settings: LocalMediaTextSettings) => void;
  audioSettings: AudioSettings;
  onChangeAudioSettings: (settings: AudioSettings) => void;
  cmsSettings: CmsSettings;
  onChangeCmsSettings: (settings: CmsSettings) => void;
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
  cmsSettings,
  onChangeCmsSettings,
}) => {
  const [soundFiles, setSoundFiles] = useState<string[]>([]);

  useEffect(() => {
    invoke<string[]>('list_sound_files')
      .then(setSoundFiles)
      .catch(() => setSoundFiles([]));
  }, []);

  const selectedFile = audioSettings.touchSoundFile ?? 'touch-sound-1.wav';

  return (
    <div style={{ color: "#ffffff" }}>
      <h2 style={{ marginTop: 0, marginBottom: 24, fontSize: 20, fontWeight: 600 }}>
        ローカルメディア設定
      </h2>
      
      {/* CMS Settings */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, borderBottom: "1px solid #444", paddingBottom: 8 }}>
          CMS連携設定
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ToggleSwitch
            checked={cmsSettings.enabled}
            onChange={(checked) => onChangeCmsSettings({ ...cmsSettings, enabled: checked })}
            label="CMS枠（WSP連携）を表示する"
          />
          <ToggleSwitch
            checked={cmsSettings.categorySearchEnabled ?? true}
            onChange={(checked) => onChangeCmsSettings({ ...cmsSettings, categorySearchEnabled: checked })}
            label="カテゴリー検索を表示する"
          />
        </div>
        <p style={{ color: "#aaa", fontSize: 12, marginTop: 8 }}>
          ※オフにするとCMSとの通信も停止します。
        </p>
      </div>

      {/* Audio Settings */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, borderBottom: "1px solid #444", paddingBottom: 8 }}>
          オーディオ設定
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ToggleSwitch
            checked={!audioSettings.localMediaMuted}
            onChange={(checked) => onChangeAudioSettings({ ...audioSettings, localMediaMuted: !checked })}
            label="ローカルメディアの音声を有効にする"
          />
          <ToggleSwitch
            checked={!audioSettings.cmsMuted}
            onChange={(checked) => onChangeAudioSettings({ ...audioSettings, cmsMuted: !checked })}
            label="CMS配信の音声を有効にする"
          />
          <ToggleSwitch
            checked={audioSettings.touchSoundEnabled ?? false}
            onChange={(checked) => onChangeAudioSettings({ ...audioSettings, touchSoundEnabled: checked })}
            label="タッチ音を有効にする"
          />
        </div>
        {(audioSettings.touchSoundEnabled ?? false) && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#aaa' }}>音量</span>
              <span style={{ fontSize: 12, color: '#aaa' }}>{audioSettings.touchSoundVolume ?? 100}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={audioSettings.touchSoundVolume ?? 100}
              onChange={(e) =>
                onChangeAudioSettings({ ...audioSettings, touchSoundVolume: Number(e.target.value) })
              }
              style={{ width: '100%', accentColor: '#007aff' }}
            />
          </div>
        )}
        {(audioSettings.touchSoundEnabled ?? false) && (
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>音声ファイルを選択</span>
            {soundFiles.length === 0 ? (
              <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
                音声ファイルが見つかりません（medias/sounds/ を確認してください）
              </p>
            ) : (
              soundFiles.map((file) => (
                <div
                  key={file}
                  onClick={() => onChangeAudioSettings({ ...audioSettings, touchSoundFile: file })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    backgroundColor: file === selectedFile ? '#1a3a5c' : '#333',
                    border: `1px solid ${file === selectedFile ? '#007aff' : '#555'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 13 }}>{file}</span>
                  {file === selectedFile && (
                    <span style={{ color: '#007aff', fontSize: 13, fontWeight: 600 }}>✓</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
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
