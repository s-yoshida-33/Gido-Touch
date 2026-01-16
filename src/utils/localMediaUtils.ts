import type { Shop } from '../types/shop';
import { filterGenreMemos } from './genreUtils';

/**
 * Generate default text settings for a media file based on its filename and shop data.
 * Filename format expected: "{shopId}-{suffix}.ext" or "{shopId}.ext"
 */
export const getDefaultMediaSettings = (filename: string, shops: Shop[]) => {
  // Extract shopId from filename (e.g., "123.mp4" -> "123")
  // Remove extension first
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  // Use filename directly as shopId (no longer splitting by hyphen)
  const shopId = nameWithoutExt;

  // Find shop by shopId ONLY
  // Removed number check to prevent mismatching (e.g. shopId 411 vs number 411)
  const shop = shops.find(s => String(s.shopId) === String(shopId));
  
  if (!shop) {
    return { line1: '', line2: '', line1En: '', line2En: '' };
  }

  // Generate Line 1: Floor [Number] GenreMemo
  const floors = shop.floors.join(',');
  
  // Genre memo handling
  let memos: string[] = [];
  if (shop.genreMemo) {
    // Split by common delimiters: |, /, 、, comma, space
    memos = shop.genreMemo.split(/[|/／,、\s]+/).filter(Boolean);
  }
  
  // Filter based on rules and take first 3
  const filteredMemos = filterGenreMemos(memos);
  const displayMemos = filteredMemos.slice(0, 3).join(' / ');
  
  const line1 = `${floors} [${shop.number}] ${displayMemos}`;
  
  // Generate Line 2: Shop Name
  const line2 = shop.name;
  const line2En = shop.nameEn || '';

  // Generate Line 1 En (Optional)
  const line1En = ''; 

  return { line1, line2, line1En, line2En };
};
