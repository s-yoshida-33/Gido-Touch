import { useEffect, useState } from 'react';
import { sseClient, type SwitchEventData } from '../api/sseClient';
import type { CurrentAsset, WspTimelineItem } from '../types/wsp';
import { logInfo, logWarn } from '../logs/logging';

interface UseCurrentAssetResult {
  asset: CurrentAsset | null;
  isLoading: boolean;
}

interface ApiTimelineItem {
  timeline_index: number;
  start_time: string;
  end_time: string;
  schedule_id: string;
  data: WspTimelineItem; // The actual item details are nested in 'data'
}

interface SwitchEventData {
  type: 'switch';
  timestamp: string;
  current_timeline: ApiTimelineItem;
}

function mapToCurrentAsset(item: ApiTimelineItem | WspTimelineItem): CurrentAsset | null {
  // Use explicit casting to handle the discriminated union properly with the index signature of WspTimelineItem
  const timelineItem = ((item as any).data || item) as WspTimelineItem;
  
  if (!timelineItem) return null;

  const mediaAsset = timelineItem.media_assets?.[0];
  if (!mediaAsset) {
    return null;
  }

  // Map to CurrentAsset
  // Note: API.md shows localPath, types/wsp.ts shows url, we might need to handle both
  const src = (mediaAsset as any).localPath || mediaAsset.url;
  const name = timelineItem.media_info?.[0]?.filename || mediaAsset.id;

  return {
    id: mediaAsset.id,
    src: src,
    duration: mediaAsset.duration,
    width: mediaAsset.width,
    height: mediaAsset.height,
    name: name,
    startTime: item.start_time,
    endTime: item.end_time,
    mediaType: mediaAsset.mediaType || mediaAsset.type,
    type: mediaAsset.type,
  };
}

/**
 * Polls wsp.exe API via Electron IPC and returns the current asset.
 * Default interval is configured in WSP_CONFIG.
 * 
 * UPDATE: Now uses SSE to receive real-time updates from the local API.
 * The pollIntervalMs parameter is kept for backward compatibility but ignored.
 */
export function useCurrentAsset(): UseCurrentAssetResult {
  const [asset, setAsset] = useState<CurrentAsset | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    sseClient.connect();

    const handleConnected = () => {
      logInfo('video', 'SSE Connected');
      setIsLoading(false);
    };

    const handleSwitch = (data: SwitchEventData) => {
      logInfo('video', 'Content switched via SSE', { timelineIndex: data.current_timeline?.timeline_index });
      
      const nextAsset = mapToCurrentAsset(data.current_timeline);
      
      if (nextAsset) {
          setAsset(prevAsset => {
            // Prevent unnecessary updates if the asset hasn't changed
            if (prevAsset && prevAsset.id === nextAsset.id && prevAsset.startTime === nextAsset.startTime) {
              return prevAsset;
            }

            logInfo('video', 'Asset updated via SSE', {
              assetId: nextAsset.id,
              src: nextAsset.src,
              name: nextAsset.name
            });
            return nextAsset;
          });
      } else {
         logWarn('video', 'Failed to map timeline item to asset via SSE');
         setAsset(null);
      }
      setIsLoading(false);
    };

    // Subscribe to events
    const unsubscribeConnected = sseClient.on('connected', handleConnected);
    const unsubscribeSwitch = sseClient.on('switch', handleSwitch);

    return () => {
      unsubscribeConnected();
      unsubscribeSwitch();
    };
  }, []);

  // Fetch initial state when mounted
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        if (window.wspApi) {
          const json = await window.wspApi.getCurrentTimeline();
          if (json && json.current_timeline) {
             const initialAsset = mapToCurrentAsset(json.current_timeline);
             if (initialAsset) {
                setAsset(initialAsset);
                logInfo('video', 'Initial asset fetched via IPC', { assetId: initialAsset.id });
             }
          }
        }
      } catch (e: any) {
        logWarn('video', 'Failed to fetch initial timeline via IPC', e?.message || e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitial();
  }, []);

  return { asset, isLoading };
}
