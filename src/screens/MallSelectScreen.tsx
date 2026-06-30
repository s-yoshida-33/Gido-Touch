// src/screens/MallSelectScreen.tsx
// 初回起動時のモール選択画面
import React, { useState } from 'react';
import mallsConfig from '../config/malls.json';
import type { MallId } from '../hooks/useMallAssets';

interface MallSelectScreenProps {
  onSelect: (mallId: MallId) => void;
}

const MallSelectScreen: React.FC<MallSelectScreenProps> = ({ onSelect }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = () => {
    if (!selectedId || isSubmitting) return;
    setIsSubmitting(true);
    onSelect(selectedId);
  };

  return (
    <div style={styles.container}>
      <div style={styles.overlay} />
      <div style={styles.content}>
        <h1 style={styles.title}>Gido Touch</h1>
        <p style={styles.subtitle}>モールを選択してください</p>

        <div style={styles.mallList}>
          {mallsConfig.map((mall) => {
            const isSelected = selectedId === mall.id;
            return (
              <button
                key={mall.id}
                onClick={() => setSelectedId(mall.id)}
                style={{
                  ...styles.mallButton,
                  ...(isSelected ? styles.mallButtonSelected : {}),
                }}
              >
                <div style={styles.mallName}>{mall.nameJa}</div>
                <div style={styles.mallNameEn}>{mall.nameEn}</div>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleConfirm}
          disabled={!selectedId || isSubmitting}
          style={{
            ...styles.confirmButton,
            ...(!selectedId || isSubmitting ? styles.confirmButtonDisabled : {}),
          }}
        >
          {isSubmitting ? '設定中...' : '決定'}
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100000,
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0%, transparent 70%)',
    pointerEvents: 'none' as const,
  },
  content: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '32px',
    padding: '60px 80px',
    borderRadius: '24px',
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  },
  title: {
    fontSize: '48px',
    fontWeight: 700,
    color: '#ffffff',
    margin: 0,
    letterSpacing: '2px',
  },
  subtitle: {
    fontSize: '20px',
    color: 'rgba(255, 255, 255, 0.7)',
    margin: 0,
  },
  mallList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    width: '100%',
    minWidth: '400px',
  },
  mallButton: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '4px',
    padding: '24px 40px',
    borderRadius: '16px',
    border: '2px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  mallButtonSelected: {
    border: '2px solid #4fc3f7',
    background: 'rgba(79, 195, 247, 0.15)',
    boxShadow: '0 0 20px rgba(79, 195, 247, 0.2)',
  },
  mallName: {
    fontSize: '24px',
    fontWeight: 700,
  },
  mallNameEn: {
    fontSize: '14px',
    opacity: 0.6,
    fontWeight: 400,
  },
  confirmButton: {
    padding: '16px 64px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #4fc3f7, #0288d1)',
    color: '#ffffff',
    fontSize: '20px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginTop: '8px',
    letterSpacing: '4px',
  },
  confirmButtonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
};

export default MallSelectScreen;
