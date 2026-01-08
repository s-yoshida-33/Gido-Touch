import React, { useEffect, useState, useMemo } from 'react';
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
  settings,
  onChangeSettings,
  audioSettings,
  onChangeAudioSettings,
  shops,
}) => {
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);

  useEffect(() => {
    const loadFiles = async () => {
      if (!window.electronAPI?.getLocalMediaFiles) return;
      try {
        const files = await window.electronAPI.getLocalMediaFiles();
        // Extract filenames from URLs/paths
        const filenames = files.map(f => {
          try {
            // Handle file:// URLs
            if (f.startsWith('file://')) {
              const url = new URL(f);
              const pathname = url.pathname;
              // Decode URI component to handle spaces/special chars
              return decodeURIComponent(pathname.split('/').pop() || '');
            }
            // Handle raw paths (fallback)
            return f.split(/[/\\]/).pop() || f;
          } catch (e) {
            console.error('Failed to parse filename:', f, e);
            return f;
          }
        }).filter(Boolean); // Remove empty strings
        
        // Sort filenames
        filenames.sort();
        
        setMediaFiles(filenames);
      } catch (error) {
        console.error('Failed to load media files:', error);
      }
    };
    loadFiles();
  }, []);

  // Helper to generate default settings for a file based on shop data
  const getDefaultSettings = (filename: string) => {
    // Extract shopId from filename (e.g., "123.mp4" -> "123", "123-1.mp4" -> "123")
    // Remove extension first
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    // Get ID part (before first hyphen)
    const shopId = nameWithoutExt.split('-')[0];

    const shop = shops.find(s => s.shopId === shopId);
    
    if (!shop) {
      return { line1: '', line2: '', line1En: '', line2En: '' };
    }

    // Generate Line 1: Floor [Number] GenreMemo
    // Genre is removed. GenreMemo takes top 2 items if multiple separated by delimiters.
    const floors = shop.floors.join(',');
    
    // Split genreMemo by common delimiters (add others if needed, e.g. "、", ",", "／", "/")
    // Assuming the source data might have separators or we are just taking the raw string?
    // The user said: "Genre memo should be the first two items separated by /"
    // "If there is only one genre memo, show only one."
    // Let's assume shop.genreMemo might be a single string like "洋食|フライドチキン|ドリンク..." as in the user query example.
    
    let memos: string[] = [];
    if (shop.genreMemo) {
      // Split by common delimiters: |, /, 、, comma, space
      memos = shop.genreMemo.split(/[|/／,、\s]+/).filter(Boolean);
    }
    
    // Take first 2
    const displayMemos = memos.slice(0, 2).join(' / ');
    
    const line1 = `${floors} [${shop.number}] ${displayMemos}`;
    
    // Generate Line 2: Shop Name
    const line2 = shop.name;
    const line2En = shop.nameEn || '';

    // Generate Line 1 En (Optional, simple mapping for now)
    // Assuming genreMemoEn might exist or just leaving it empty/partial
    const line1En = ''; // Can be implemented if English genre data is available in Shop type

    return { line1, line2, line1En, line2En };
  };

  const handleTextChange = (filename: string, field: 'line1' | 'line2' | 'line1En' | 'line2En', value: string) => {
    // Clone the settings object
    const newSettings = { ...settings };
    
    // Get current setting for this file or create new with defaults if missing
    // If it was missing, we should populate other fields with defaults too, so user doesn't lose them
    const existing = newSettings[filename];
    const defaults = getDefaultSettings(filename);
    
    const currentFileSettings = existing || { 
      line1: defaults.line1, 
      line2: defaults.line2,
      line1En: defaults.line1En,
      line2En: defaults.line2En 
    };
    
    // Update the specific field
    newSettings[filename] = {
      ...currentFileSettings,
      [field]: value
    };
    
    onChangeSettings(newSettings);
  };

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
        テキスト設定
      </h3>
      <p style={{ color: "#aaa", marginBottom: 20, fontSize: 14 }}>
        動画・画像ファイルごとのテキストを設定します。<br/>
        ファイル名の先頭（ハイフン前）をショップIDとみなして初期値を自動表示します。<br/>
        英語テキストが設定されている場合、言語切り替えに合わせて表示されます。
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {mediaFiles.length === 0 && (
          <div style={{ color: "#aaa", fontStyle: "italic" }}>
            メディアファイルが見つかりません (mediaフォルダを確認してください)
          </div>
        )}
        {mediaFiles.map(filename => {
          const defaults = getDefaultSettings(filename);
          // If setting exists, use it. If not, use default.
          // Note: if setting exists but a field is missing/undefined, fallback to empty string (user cleared it) or default?
          // Requirement: "If not set, use default based on shop ID. If ID mismatch or no shop, empty."
          // Also "Arbitrarily changeable".
          // Strategy: Use 'value' prop with fallback to default ONLY if the key in settings is totally missing.
          // If key exists (even if properties are empty strings), use them.
          
          const entry = settings[filename];
          
          // Determine values to display
          const valLine1 = entry ? (entry.line1 ?? '') : defaults.line1;
          const valLine2 = entry ? (entry.line2 ?? '') : defaults.line2;
          const valLine1En = entry ? (entry.line1En ?? '') : defaults.line1En;
          const valLine2En = entry ? (entry.line2En ?? '') : defaults.line2En;

          return (
          <div key={filename} style={{ border: '1px solid #444', padding: 16, borderRadius: 8, backgroundColor: '#222' }}>
            <div style={{ marginBottom: 12, fontWeight: 'bold', borderBottom: '1px solid #444', paddingBottom: 8 }}>
              {filename}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Line 1 */}
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#aaa' }}>1行目 (16px bold)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={valLine1}
                    onChange={(e) => handleTextChange(filename, 'line1', e.target.value)}
                    placeholder="日本語: フロア [区画番号] ジャンルメモ"
                    style={{ 
                      flex: 1, 
                      padding: '8px 12px', 
                      backgroundColor: '#333', 
                      border: '1px solid #555', 
                      color: 'white', 
                      borderRadius: 4,
                      fontSize: 14
                    }}
                  />
                  <input
                    type="text"
                    value={valLine1En}
                    onChange={(e) => handleTextChange(filename, 'line1En', e.target.value)}
                    placeholder="English: Floors [Number] Genre Memo"
                    style={{ 
                      flex: 1, 
                      padding: '8px 12px', 
                      backgroundColor: '#333', 
                      border: '1px solid #555', 
                      color: 'white', 
                      borderRadius: 4,
                      fontSize: 14
                    }}
                  />
                </div>
              </div>
              
              {/* Line 2 */}
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#aaa' }}>2行目 (24px bold)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={valLine2}
                    onChange={(e) => handleTextChange(filename, 'line2', e.target.value)}
                    placeholder="日本語: 店舗名"
                    style={{ 
                      flex: 1, 
                      padding: '8px 12px', 
                      backgroundColor: '#333', 
                      border: '1px solid #555', 
                      color: 'white', 
                      borderRadius: 4,
                      fontSize: 14
                    }}
                  />
                  <input
                    type="text"
                    value={valLine2En}
                    onChange={(e) => handleTextChange(filename, 'line2En', e.target.value)}
                    placeholder="English: Shop Name"
                    style={{ 
                      flex: 1, 
                      padding: '8px 12px', 
                      backgroundColor: '#333', 
                      border: '1px solid #555', 
                      color: 'white', 
                      borderRadius: 4,
                      fontSize: 14
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
        })}
      </div>
    </div>
  );
};
