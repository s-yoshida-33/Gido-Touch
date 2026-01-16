/**
 * ジャンルメモのフィルタリング用ユーティリティ
 */

// 完全一致で除外するキーワード（日本語）
export const IGNORED_GENRE_KEYWORDS = new Set([
  "グルメ",
  "フード",
  "フードコート",
  "レストラン",
  "グルメアリーナ",
  "SUZAKA蔵",
  "SUZUKA蔵",
  "レストラン・カフェ",
  "レストラン・グルメ"
]);

// パターンマッチで除外するキーワード
export const IGNORED_GENRE_PATTERNS = [
  /^waonpoint加盟店$/i,      // 大文字小文字区別なし
  /^aeonpayの使えるお店$/i,  // 大文字小文字区別なし
  /^\d+(?:F|f|階|層)$/       // 階数表現 (1F, 2階, 3層など)
];

/**
 * ジャンルメモの項目を表示すべきかどうかを判定する
 * @param genreMemoItem 分割されたジャンルメモの1項目
 * @returns true: 表示対象外（無視する）, false: 表示対象
 */
export function shouldIgnoreGenre(genreMemoItem: string): boolean {
  const normalized = genreMemoItem.trim();
  if (!normalized) return true;

  // 完全一致チェック
  if (IGNORED_GENRE_KEYWORDS.has(normalized)) return true;

  // パターンチェック
  for (const pattern of IGNORED_GENRE_PATTERNS) {
    if (pattern.test(normalized)) return true;
  }

  return false;
}

/**
 * ジャンルメモの配列をフィルタリングする
 */
export function filterGenreMemos(memos: string[]): string[] {
  return memos.filter(memo => !shouldIgnoreGenre(memo));
}
