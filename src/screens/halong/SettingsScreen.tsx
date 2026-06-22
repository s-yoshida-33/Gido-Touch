// src/screens/halong/SettingsScreen.tsx
import { useState, useEffect } from 'react';
import { BlackScreenSettingsTab } from '../../components/BlackScreenSettingsTab';
import type { BlackScreenSettings } from '../../types/blackScreenSettings';
import { DEFAULT_BLACK_SCREEN_SETTINGS } from '../../types/blackScreenSettings';
import {
  loadGlobalSettings,
  saveGlobalSettings,
  loadMallSettings,
  saveMallSettings,
  getDefaultMallSettingsFile,
} from '../../utils/settings';
import type { MallSettingsFile } from '../../utils/settings';

type Tab = 'basic' | 'floor' | 'blackScreen';

interface HalongSettingsScreenProps {
  visible: boolean;
  onClose: () => void;
  onSave: (settings: MallSettingsFile, hostname: string) => void;
  hostname: string;
  currentFloorSetting: string;
  blackScreenSettings: BlackScreenSettings;
}

const FLOORS = ['1F', '2F', '3F', '4F'] as const;

export function HalongSettingsScreen({
  visible,
  onClose,
  onSave,
  hostname: initialHostname,
  currentFloorSetting: initialFloor,
  blackScreenSettings: initialBlackScreen,
}: HalongSettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>('basic');
  const [hostname, setHostname] = useState(initialHostname);
  const [currentFloorSetting, setCurrentFloorSetting] = useState(initialFloor);
  const [blackScreenSettings, setBlackScreenSettings] = useState<BlackScreenSettings>(initialBlackScreen);
  const [saving, setSaving] = useState(false);

  // Sync props → local state when screen opens
  useEffect(() => {
    if (visible) {
      setHostname(initialHostname);
      setCurrentFloorSetting(initialFloor);
      setBlackScreenSettings(initialBlackScreen);
      setActiveTab('basic');
    }
  }, [visible, initialHostname, initialFloor, initialBlackScreen]);

  if (!visible) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Update global settings (hostname)
      const global = await loadGlobalSettings();
      await saveGlobalSettings({ ...global, hostname });

      // 2. Update mall settings
      const existing = await loadMallSettings('halong');
      const defaults = getDefaultMallSettingsFile();
      const updated: MallSettingsFile = {
        ...(existing ?? defaults),
        currentFloorSetting,
        blackScreenSettings,
      };
      await saveMallSettings('halong', updated);

      onSave(updated, hostname);
      onClose();
    } catch (e) {
      console.error('Failed to save halong settings', e);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'basic', label: '基本設定' },
    { id: 'floor', label: 'フロア設定' },
    { id: 'blackScreen', label: 'ブラックスクリーン' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        style={{
          width: 640,
          maxHeight: '90vh',
          backgroundColor: '#1e1e1e',
          borderRadius: 12,
          border: '1px solid #3a3a3a',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 0',
            borderBottom: '1px solid #2a2a2a',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#ffffff' }}>設定</h1>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                fontSize: 22,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 6,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0 }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '10px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid #007aff' : '2px solid transparent',
                  color: activeTab === tab.id ? '#007aff' : '#888',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', color: '#ffffff' }}>
          {activeTab === 'basic' && (
            <div>
              <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 600 }}>基本設定</h2>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 6 }}>
                  ホスト名（S3 アセット取得先）
                </label>
                <input
                  type="text"
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                  placeholder="例: https://dl.tti.ninja"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    backgroundColor: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#666', lineHeight: 1.5 }}>
                  アセット（画像・マップ）の配信元 URL です。空欄の場合はデフォルト URL が使用されます。
                </p>
              </div>
            </div>
          )}

          {activeTab === 'floor' && (
            <div>
              <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 600 }}>フロア設定</h2>

              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 10 }}>
                  起動時に表示するフロア
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {FLOORS.map((floor) => (
                    <button
                      key={floor}
                      onClick={() => setCurrentFloorSetting(floor)}
                      style={{
                        flex: 1,
                        padding: '16px 0',
                        backgroundColor: currentFloorSetting === floor ? '#007aff' : '#2a2a2a',
                        border: currentFloorSetting === floor ? '2px solid #007aff' : '2px solid #444',
                        borderRadius: 10,
                        color: currentFloorSetting === floor ? '#fff' : '#aaa',
                        fontSize: 18,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {floor}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'blackScreen' && (
            <BlackScreenSettingsTab
              settings={blackScreenSettings}
              onChangeSettings={setBlackScreenSettings}
            />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #2a2a2a',
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              backgroundColor: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: 8,
              color: '#ccc',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 28px',
              backgroundColor: saving ? '#005bb5' : '#007aff',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.8 : 1,
              transition: 'background-color 0.15s',
            }}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
