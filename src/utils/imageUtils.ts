// src/utils/imageUtils.ts
import { invoke } from "@tauri-apps/api/core";

/**
 * Load a shop image via Tauri IPC (returns data URL or null).
 */
export async function getShopImageDataUrl(filePath: string): Promise<string | null> {
  try {
    return await invoke<string | null>('get_shop_image', { filePath });
  } catch {
    return null;
  }
}

/**
 * Build image path using shop_id if photo is relative or filename only.
 * Expected full path format: C:\Users\...\AppData\Roaming\TTI\BridgeWebPopper\files\shop\{shop_id}\photo2.png
 */
export function buildImagePath(photo: string | undefined, shopId: string | undefined): string {
  if (!photo) return "";
  
  // If already a full path (contains drive letter like C:\), return as is
  if (photo.match(/^[A-Za-z]:[\\/]/)) return photo;
  
  // If already a URL, return as is
  if (photo.startsWith("file://") || photo.startsWith("http://") || photo.startsWith("https://") || photo.startsWith("data:")) {
    return photo;
  }
  
  // Windows network path
  if (photo.startsWith("\\\\")) return photo;
  
  // Unix-style absolute path
  if (photo.startsWith("/")) return photo;
  
  // If shop_id is available and photo is relative or filename only, build path
  if (shopId) {
    if (photo.includes(`shop/${shopId}/`) || photo.includes(`shop\\${shopId}\\`) ||
        photo.includes(`files/shop/${shopId}/`) || photo.includes(`files\\shop\\${shopId}\\`)) {
      return photo;
    }
    
    const normalizedPhoto = photo.replace(/\\/g, "/");
    const cleanPhoto = normalizedPhoto.startsWith("/") ? normalizedPhoto.slice(1) : normalizedPhoto;
    
    if (!cleanPhoto.includes("/")) {
      return `files/shop/${shopId}/${cleanPhoto}`;
    }
    
    if (cleanPhoto.startsWith("files/shop/")) {
      return cleanPhoto;
    }
    return `files/shop/${shopId}/${cleanPhoto}`;
  }
  
  return photo;
}

/**
 * Convert a local file path to a file:// URL.
 */
export function toFileUrl(filePath: string): string {
  if (!filePath) return "";
  
  if (filePath.startsWith("file://") || filePath.startsWith("http://") || filePath.startsWith("https://") || filePath.startsWith("data:")) {
    return filePath;
  }
  
  const normalized = filePath.replace(/\\/g, "/");
  
  if (normalized.match(/^[A-Za-z]:\//)) {
    return `file:///${normalized}`;
  }
  
  if (normalized.startsWith("/")) {
    return `file://${normalized}`;
  }
  
  return `file:///${normalized}`;
}
