/**
 * ジャンルメモのフィルタリング用ユーティリティ
 */

// デフォルトの除外キーワード（日本語）
export const DEFAULT_IGNORED_GENRE_KEYWORDS = [
  "グルメ",
  "フード",
  "フードコート",
  "レストラン",
  "グルメアリーナ",
  "SUZAKA蔵",
  "SUZUKA蔵",
  "レストラン・カフェ",
  "レストラン・グルメ",
  "エキトマチケット加盟店"
];

// パターンマッチで除外するキーワード
export const IGNORED_GENRE_PATTERNS = [
  /^waonpoint加盟店$/i,      // 大文字小文字区別なし
  /^aeonpayの使えるお店$/i,  // 大文字小文字区別なし
  /^\d+(?:F|f|階|層)$/       // 階数表現 (1F, 2階, 3層など)
];

// カテゴリー検索のデフォルトキーワード定義
export const DEFAULT_CATEGORY_MAPPINGS: Record<string, string[]> = {
  takeout: ["テイクアウト", "takeout", "お弁当", "弁当"],
  alcohol: ["酒", "アルコール", "alcohol", "居酒屋", "バー", "バル"],
  meat: ["肉", "meat", "ステーキ", "ハンバーグ", "焼肉", "とんかつ", "牛タン", "しゃぶしゃぶ"],
  sweets: ["スイーツ", "甘味", "デザート", "カフェ", "sweets", "cafe", "ケーキ", "クレープ", "アイス", "ソフトクリーム", "喫茶"]
};

/**
 * ジャンルメモの項目を表示すべきかどうかを判定する
 * @param genreMemoItem 分割されたジャンルメモの1項目
 * @param ignoredKeywords 除外キーワードの配列（指定がない場合はデフォルトを使用）
 * @returns true: 表示対象外（無視する）, false: 表示対象
 */
export function shouldIgnoreGenre(genreMemoItem: string, ignoredKeywords?: string[]): boolean {
  const normalized = genreMemoItem.trim();
  if (!normalized) return true;

  // キーワードチェック
  const keywordsToCheck = ignoredKeywords || DEFAULT_IGNORED_GENRE_KEYWORDS || [];
  
  // 安全策：配列でない場合は空配列として扱う
  const safeKeywords = Array.isArray(keywordsToCheck) ? keywordsToCheck : [];
  
  // 完全一致チェック (Setにして高速化)
  const keywordSet = new Set(safeKeywords);
  if (keywordSet.has(normalized)) return true;

  // パターンチェック
  for (const pattern of IGNORED_GENRE_PATTERNS) {
    if (pattern.test(normalized)) return true;
  }

  return false;
}

/**
 * ジャンルメモの配列をフィルタリングする
 * @param memos ジャンルメモの配列
 * @param ignoredKeywords 除外キーワードの配列（オプション）
 * @param maxItems 最大表示件数（オプション）。指定された場合、この件数まで切り詰めます。
 */
export function filterGenreMemos(memos: string[], ignoredKeywords?: string[], maxItems?: number): string[] {
  if (!Array.isArray(memos)) return [];
  
  const filtered = memos.filter(memo => !shouldIgnoreGenre(memo, ignoredKeywords));
  
  // Remove duplicates while preserving order
  const unique = Array.from(new Set(filtered));
  
  if (maxItems !== undefined && maxItems > 0) {
    return unique.slice(0, maxItems);
  }
  
  return unique;
}
