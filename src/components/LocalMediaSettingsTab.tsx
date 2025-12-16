import React, { useEffect, useState } from 'react';
import type { LocalMediaTextSettings } from '../types/global';

interface LocalMediaSettingsTabProps {
  settings: LocalMediaTextSettings;
  onChangeSettings: (settings: LocalMediaTextSettings) => void;
}

export const LocalMediaSettingsTab: React.FC<LocalMediaSettingsTabProps> = ({
  settings,
  onChangeSettings,
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

  const handleTextChange = (filename: string, field: 'line1' | 'line2' | 'line1En' | 'line2En', value: string) => {
    // Clone the settings object
    const newSettings = { ...settings };
    
    // Get current setting for this file or create new
    const currentFileSettings = newSettings[filename] || { line1: '', line2: '' };
    
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
      <p style={{ color: "#aaa", marginBottom: 20, fontSize: 14 }}>
        動画ファイルごとのテキストを設定します。<br/>
        登録されているメディアファイルが自動的に表示されます。<br/>
        英語テキストが設定されている場合、言語切り替えに合わせて表示されます。
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {mediaFiles.length === 0 && (
          <div style={{ color: "#aaa", fontStyle: "italic" }}>
            メディアファイルが見つかりません (mediaフォルダを確認してください)
          </div>
        )}
        {mediaFiles.map(filename => (
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
                    value={settings[filename]?.line1 || ''}
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
                    value={settings[filename]?.line1En || ''}
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
                    value={settings[filename]?.line2 || ''}
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
                    value={settings[filename]?.line2En || ''}
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
        ))}
      </div>
    </div>
  );
};
