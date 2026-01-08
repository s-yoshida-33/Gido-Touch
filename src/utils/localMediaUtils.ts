import type { Shop } from '../types/shop';

/**
 * Generate default text settings for a media file based on its filename and shop data.
 * Filename format expected: "{shopId}-{suffix}.ext" or "{shopId}.ext"
 */
export const getDefaultMediaSettings = (filename: string, shops: Shop[]) => {
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
  const floors = shop.floors.join(',');
  
  // Genre memo handling
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

  // Generate Line 1 En (Optional)
  const line1En = ''; 

  return { line1, line2, line1En, line2En };
};

