import { useEffect, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { cmsSseService } from '../services/SSEService';
import type { CurrentAsset } from '../types/wsp';
import { logInfo, logWarn, logDebug } from '../logs/logging';

const LOG_TAG = 'CMS_DELIVERY' as const;

interface UseCurrentAssetResult {
  asset: CurrentAsset | null;
  nextAsset: CurrentAsset | null;
  isLoading: boolean;
  /** true while waiting for a valid event after receiving a null item_changed (schedule recalculation) */
  isScheduleRecalculating: boolean;
}

/**
 * CMS Timeline SSE event payload (from /api/timeline/stream).
 * event: item_changed
 *
 * During hourly schedule recalculation, current_media_* fields may be null.
 */
interface CmsTimelineEvent {
  event_type: 'item_changed';
  current_media_id: string | null;
  current_media_name: string | null;
  current_media_type: string | null;
  current_media_local_path: string | null;
  next_media_id: string | null;
  next_media_local_path: string | null;
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

  const src = toAssetUrl(event.current_media_local_path ?? '');

  return {
    id: event.current_media_id,
    src,
    duration: 0,
    width: 0,
    height: 0,
    name: event.current_media_name ?? '',
    startTime: event.timestamp,
    endTime: '',
    mediaType: event.current_media_type ?? '',
    type: event.current_media_type ?? '',
  };
}

function mapCmsEventToNextAsset(event: CmsTimelineEvent): CurrentAsset | null {
  if (!event.next_media_id || !event.next_media_local_path) return null;

  const src = toAssetUrl(event.next_media_local_path);

  return {
    id: event.next_media_id,
    src,
    duration: 0,
    width: 0,
    height: 0,
    name: '',
    startTime: '',
    endTime: '',
    mediaType: '',
    type: '',
  };
}

const NULL_GRACE_PERIOD_MS = 30000;

/**
 * Receives real-time content updates from CMS Timeline API via SSE.
 * Listens to event: item_changed on http://localhost:48080/api/timeline/stream.
 *
 * Returns the current asset and the next asset (for preloading).
 *
 * When receiving an item_changed with null current_media (schedule recalculation),
 * the hook keeps the current asset and enters a 30-second grace period.
 * If a valid event arrives within 30s, playback resumes seamlessly.
 * If the grace period expires, the asset is cleared.
 *
 * @param enabled Whether CMS integration is enabled (from cmsSettings)
 */
export function useCurrentAsset(enabled: boolean = true): UseCurrentAssetResult {
  const [asset, setAsset] = useState<CurrentAsset | null>(null);
  const [nextAsset, setNextAsset] = useState<CurrentAsset | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScheduleRecalculating, setIsScheduleRecalculating] = useState<boolean>(false);
  const nullGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const clearNullGraceTimer = () => {
      if (nullGraceTimerRef.current !== null) {
        clearTimeout(nullGraceTimerRef.current);
        nullGraceTimerRef.current = null;
      }
    };

    // Connect to CMS SSE
    cmsSseService.connect();

    const handleItemChanged = (data: CmsTimelineEvent) => {
      logDebug(LOG_TAG, 'CMS item_changed via SSE', {
        mediaId: data.current_media_id,
        mediaType: data.current_media_type,
        mediaName: data.current_media_name,
        nextMediaId: data.next_media_id,
      });

      const isNullEvent = !data.current_media_id;

      if (isNullEvent) {
        // Schedule recalculation: CMS sends null during hourly recalc.
        // Keep the current asset displayed (video paused on last frame)
        // and wait up to 30 seconds for a valid event.
        if (nullGraceTimerRef.current !== null) {
          logDebug(LOG_TAG, 'Null grace period already active, ignoring duplicate null event');
          return;
        }

        logInfo(LOG_TAG, 'Received null item_changed (schedule recalculation), entering grace period', {
          timestamp: data.timestamp,
          timelineCount: data.timeline_count,
          nextMediaId: data.next_media_id,
        });
        setIsScheduleRecalculating(true);

        nullGraceTimerRef.current = setTimeout(() => {
          nullGraceTimerRef.current = null;
          logWarn(LOG_TAG, 'Null grace period expired without valid event — treating as no asset', {
            gracePeriodMs: NULL_GRACE_PERIOD_MS,
          });
          setIsScheduleRecalculating(false);
          setAsset(null);
          setNextAsset(null);
        }, NULL_GRACE_PERIOD_MS);

        // Update nextAsset even during grace period if provided
        const mappedNextAsset = mapCmsEventToNextAsset(data);
        setNextAsset(prevNext => {
          if (!mappedNextAsset) return prevNext;
          if (prevNext && prevNext.id === mappedNextAsset.id && prevNext.src === mappedNextAsset.src) {
            return prevNext;
          }
          return mappedNextAsset;
        });

        return;
      }

      // Valid event received — clear grace period if active
      if (nullGraceTimerRef.current !== null) {
        logInfo(LOG_TAG, 'Valid item_changed received during grace period — resuming playback', {
          mediaId: data.current_media_id,
        });
        clearNullGraceTimer();
      }
      setIsScheduleRecalculating(false);

      const mappedAsset = mapCmsEventToAsset(data);
      const mappedNextAsset = mapCmsEventToNextAsset(data);

      if (mappedAsset) {
        setAsset(prevAsset => {
          if (prevAsset && prevAsset.id === mappedAsset.id && prevAsset.src === mappedAsset.src) {
            return prevAsset;
          }
          return mappedAsset;
        });
      } else {
        logWarn(LOG_TAG, 'Failed to map CMS event to asset (non-null id but mapping failed)');
        setAsset(null);
      }

      setNextAsset(prevNext => {
        if (!mappedNextAsset) return null;
        if (prevNext && prevNext.id === mappedNextAsset.id && prevNext.src === mappedNextAsset.src) {
          return prevNext;
        }
        return mappedNextAsset;
      });

      setIsLoading(false);
    };

    const handleConnected = () => {
      logInfo(LOG_TAG, 'CMS SSE Connected');
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
      clearNullGraceTimer();
      cmsSseService.disconnect();
    };
  }, [enabled]);

  return { asset, nextAsset, isLoading, isScheduleRecalculating };
}
