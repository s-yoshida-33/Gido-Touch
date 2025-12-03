// src/hooks/useRightTopVideoAsset.ts
import { useEffect, useState, useRef } from 'react';
import type { CurrentAsset } from '../types/wsp';
import { fetchRightTopVideoAsset } from '../repositories/wspRepository';
import { POLLING_INTERVALS } from '../config';
import { logInfo, logWarn, logError } from '../logs/logging';

interface UseRightTopVideoAssetResult {
  asset: CurrentAsset | null;
  isLoading: boolean;
}

type AssetStatus = 'ok' | 'noAsset' | 'error' | null;

/**
 * Polls right-top video CMS API via Electron IPC and returns the current asset.
 * Default interval is configured in POLLING_INTERVALS.VIDEO_MS.
 */
export function useRightTopVideoAsset(
  pollIntervalMs: number = POLLING_INTERVALS.VIDEO_MS,
): UseRightTopVideoAssetResult {
  const [asset, setAsset] = useState<CurrentAsset | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Keep track of last status to avoid spamming logs / Slack alerts
  const lastStatusRef = useRef<AssetStatus>(null);

  useEffect(() => {
    let isMounted = true;
    let timerId: number | undefined;

    const tick = async () => {
      const startTime = Date.now();
      try {
        const next = await fetchRightTopVideoAsset();
        const fetchDuration = Date.now() - startTime;
        if (!isMounted) return;

        if (next) {
          // Check if asset has changed
          const assetChanged = asset?.id !== next.id;
          
          // Status: ok (asset available)
          if (lastStatusRef.current !== 'ok') {
            logInfo('video', 'Fetched current right-top video asset', {
              assetId: next.id,
              src: next.src,
              duration: next.duration,
              name: next.name,
              fetchDurationMs: fetchDuration,
            });
          } else if (assetChanged) {
            // Asset changed - log the change
            logInfo('video', 'Right-top video asset changed', {
              oldAssetId: asset?.id,
              newAssetId: next.id,
              oldSrc: asset?.src,
              newSrc: next.src,
              fetchDurationMs: fetchDuration,
            });
          }
          lastStatusRef.current = 'ok';
        } else {
          // Status: noAsset (API OK but no current asset)
          if (lastStatusRef.current !== 'noAsset') {
            logWarn('video', 'No current right-top video asset returned by CMS', {
              fetchDurationMs: Date.now() - startTime,
            });
          }
          lastStatusRef.current = 'noAsset';
        }

        setAsset(next);
        setIsLoading(false);
      } catch (error: any) {
        const fetchDuration = Date.now() - startTime;
        if (!isMounted) return;

        // Status: error (API communication error)
        if (lastStatusRef.current !== 'error') {
          logError('video', 'Failed to fetch current right-top video asset', {
            error: error?.message,
            fetchDurationMs: fetchDuration,
          });
        }
        lastStatusRef.current = 'error';

        setIsLoading(false);
      } finally {
        if (!isMounted) return;
        timerId = window.setTimeout(tick, pollIntervalMs);
      }
    };

    tick();

    return () => {
      isMounted = false;
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    };
  }, [pollIntervalMs, asset?.id]);

  return { asset, isLoading };
}

