export interface GenreSettings {
  ignoredKeywords: string[];
  maxItems: number;
  // カテゴリーごとの検索キーワード設定 (key: 'takeout' | 'alcohol' | 'meat' | 'sweets')
  categoryMapping?: Record<string, string[]>;
  // 非表示にするショップID（API上に残っていてもアプリ側で表示しない）
  hiddenShopIds?: string[];
}
