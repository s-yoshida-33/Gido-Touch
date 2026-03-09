import { useEffect, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { cmsSseService } from '../services/SSEService';
import type { CurrentAsset } from '../types/wsp';
import { logInfo, logWarn, logDebug } from '../logs/logging';

interface UseCurrentAssetResult {
  asset: CurrentAsset | null;
  isLoading: boolean;
}

/**
 * CMS Timeline SSE event payload (from /api/timeline/stream).
 * event: item_changed
 */
interface CmsTimelineEvent {
  event_type: 'item_changed';
  current_media_id: string;
  current_media_name: string;
  current_media_type: string; // 'image' | 'video'
  current_media_local_path: string;
  next_media_id: string;
  next_media_local_path: string;
  timeline_count: number;
  timestamp: string;
}

/**
 * Convert a local file path to a Tauri asset protocol URL.
 * Strips file:// prefix if present, then uses convertFileSrc.
 */
function toAssetUrl(filePath: string): string {
  if (!filePath) return "";
  if (filePath.startsWith("http://") || filePath.startsWith("https://") || filePath.startsWith("data:") || filePath.startsWith("asset:")) {
    return filePath;
  }
  let cleaned = filePath;
  if (cleaned.startsWith("file:///")) {
    cleaned = cleaned.slice(8);
  } else if (cleaned.startsWith("file://")) {
    cleaned = cleaned.slice(7);
  }
  return convertFileSrc(cleaned);
}

function mapCmsEventToAsset(event: CmsTimelineEvent): CurrentAsset | null {
  if (!event.current_media_id) return null;

  const src = toAssetUrl(event.current_media_local_path);

  return {
    id: event.current_media_id,
    src,
    duration: 0, // Not provided by new API
    width: 0,
    height: 0,
    name: event.current_media_name,
    startTime: event.timestamp,
    endTime: '',
    mediaType: event.current_media_type,
    type: event.current_media_type,
  };
}

/**
 * Receives real-time content updates from CMS Timeline API via SSE.
 * Listens to event: item_changed on http://localhost:48080/api/timeline/stream.
 * 
 * @param enabled Whether CMS integration is enabled (from cmsSettings)
 */
export function useCurrentAsset(enabled: boolean = true): UseCurrentAssetResult {
  const [asset, setAsset] = useState<CurrentAsset | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Connect to CMS SSE
    cmsSseService.connect();

    const handleItemChanged = (data: CmsTimelineEvent) => {
      logDebug('VIDEO', 'CMS item_changed via SSE', {
        mediaId: data.current_media_id,
        mediaType: data.current_media_type,
        mediaName: data.current_media_name,
      });

      const nextAsset = mapCmsEventToAsset(data);

      if (nextAsset) {
        setAsset(prevAsset => {
          if (prevAsset && prevAsset.id === nextAsset.id && prevAsset.src === nextAsset.src) {
            return prevAsset;
          }
          return nextAsset;
        });
      } else {
        logWarn('VIDEO', 'Failed to map CMS event to asset');
        setAsset(null);
      }
      setIsLoading(false);
    };

    const handleConnected = () => {
      logInfo('VIDEO', 'CMS SSE Connected');
      setIsLoading(false);
    };

    const unsubscribeItemChanged = cmsSseService.on('item_changed', handleItemChanged);
    const unsubscribeConnected = cmsSseService.on('connected', handleConnected);

    // Timeout fallback: if no data received within 10s, stop loading spinner
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 10000);

    return () => {
      unsubscribeItemChanged();
      unsubscribeConnected();
      clearTimeout(timeout);
      cmsSseService.disconnect();
    };
  }, [enabled]);

  return { asset, isLoading };
}
