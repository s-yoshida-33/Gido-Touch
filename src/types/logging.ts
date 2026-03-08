/**
 * Log tags for categorizing log messages.
 *
 * Tags marked with [ALERT] are monitored by the Slack notification system
 * in main.rs. State transitions (ok→alert on WARN/ERROR, alert→ok on INFO)
 * trigger Slack notifications.
 */
export type LogTag =
  // System lifecycle
  | 'SYS_INIT'
  | 'SYS_SHUTDOWN'
  | 'SYSTEM'          // [ALERT] Uncaught global errors, unhandled rejections

  // Data fetching (Shop REST)
  | 'DATA_FETCH'      // [ALERT] Shop API communication errors
  | 'SHOP_MAP'        // Shop data processing

  // Asset resolution (image load, picto icons)
  | 'ASSET_RESOLVE'   // [ALERT] Asset/image resolution failures

  // SSE connection
  | 'sse'             // [ALERT] SSE connection errors

  // Application general
  | 'app'             // [ALERT] App-level data load / settings errors

  // Map rendering
  | 'map'             // [ALERT] Floor map image load errors

  // Shop list
  | 'shopList'        // [ALERT] Shop list rendering errors

  // Configuration
  | 'CONFIG'          // [ALERT] Settings file read/write errors

  // Auto-updater
  | 'UPDATER'         // [ALERT] Update check/download/install failures

  // CMS / Video
  | 'VIDEO'           // Video playback
  | 'CMS_SETTINGS'    // CMS settings

  // Error handling
  | 'RENDERER_ERROR'  // [ALERT] React ErrorBoundary caught errors
  | 'IPC_ERROR'
  | 'API_ERROR'       // API communication errors

  // UI / Analytics
  | 'SCREEN_VIEW'
  | 'TOUCH'           // Touch event tracking
  | 'idle'
  | 'repository'

  // User actions
  | 'USER_ACTION'

  // Media
  | 'MEDIA_SWAP'      // Content switching
  | 'MEDIA_DOWNLOAD'  // Media download from GitHub Releases

  // Catch-all for compatibility
  | string;

/**
 * Additional context attached to log entries.
 */
export interface LogContext {
  [key: string]: unknown;
}
