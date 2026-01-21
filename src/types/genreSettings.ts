export interface GenreSettings {
  ignoredKeywords: string[];
  maxItems: number;
  // カテゴリーごとの検索キーワード設定 (key: 'takeout' | 'alcohol' | 'meat' | 'sweets')
  categoryMapping?: Record<string, string[]>;
}
