import { fetch } from "@tauri-apps/plugin-http";
import { logInfo, logError, logDebug } from "../logs/logging";

export type SseConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (data: any) => void;

/**
 * SSE client implemented over Tauri HTTP plugin's fetch (streaming).
 *
 * The native EventSource API cannot reach http://localhost from the
 * Tauri WebView because it is a cross-origin request without CORS headers.
 * Using the Tauri HTTP plugin routes the request through Rust, bypassing CORS.
 */
class SSEService {
  private abortController: AbortController | null = null;
  private listeners: Map<string, Set<Listener>> = new Map();
  private isDestroyed = false;
  // disconnect()による意図的なabort()かどうかを区別するためのフラグ。
  // Tauriのplugin-http経由のfetchは、abort()時にブラウザ標準のAbortError
  // (error.name === "AbortError")ではなく別形状のエラー("Request cancelled"等)
  // を投げるため、error.name判定だけでは意図的な切断を検知できない
  // （実機検証で発覚: on-preモードでの明示的disconnect()がERRORログとして
  // 記録され、さらに不要な再接続まで試みていた）。
  private intentionalDisconnect = false;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private _status: SseConnectionStatus = 'disconnected';
  private url: string;
  private name: string;
  private logTag: string;
  private reconnectAttempt: number = 0;
  private static readonly BASE_DELAY_MS = 3000;
  private static readonly MAX_DELAY_MS = 60000;

  public get status(): SseConnectionStatus {
    return this._status;
  }

  private setStatus(status: SseConnectionStatus) {
    if (this._status !== status) {
      this._status = status;
      this.emit('status_change', { status });
    }
  }

  constructor(url: string, name: string = 'SSE', autoConnect: boolean = true, logTag: string = 'SSE') {
    this.url = url;
    this.name = name;
    this.logTag = logTag;
    if (autoConnect) {
      this.connect();
    }
  }

  public async connect() {
    if (this.isDestroyed) return;
    if (this._status === 'connecting' || this._status === 'connected') return;

    this.setStatus('connecting');

    try {
      logDebug(this.logTag, `[${this.name}] Connecting to SSE endpoint via Tauri HTTP`, { url: this.url });

      this.abortController = new AbortController();

      const response = await fetch(this.url, {
        method: "GET",
        headers: { "Accept": "text/event-stream" },
        signal: this.abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed: HTTP ${response.status}`);
      }

      this.setStatus('connected');
      this.reconnectAttempt = 0;
      logInfo(this.logTag, `[${this.name}] SSE connection opened`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (delimited by double newlines)
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.trim()) continue;
          this.parseAndDispatch(part);
        }
      }

      logDebug(this.logTag, `[${this.name}] SSE stream ended`);
      this.setStatus('disconnected');
      this.reconnect();

    } catch (error: unknown) {
      const wasIntentional = this.intentionalDisconnect;
      this.intentionalDisconnect = false;

      if (wasIntentional || (error instanceof Error && error.name === "AbortError")) {
        logDebug(this.logTag, `[${this.name}] SSE connection aborted (intentional disconnect)`);
        return;
      }
      logError(this.logTag, `[${this.name}] SSE Error occurred`, { error: error instanceof Error ? error.message : String(error) });
      this.setStatus('error');
      this.reconnect();
    }
  }

  /**
   * Parse a single SSE block and dispatch to listeners.
   */
  private parseAndDispatch(block: string) {
    let eventType = "message";
    const dataLines: string[] = [];

    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      } else if (line.startsWith(":")) {
        // SSE comment — ignore (keepalive)
      }
    }

    if (dataLines.length === 0) return;

    const rawData = dataLines.join("\n");

    // Heartbeat events — silently ignore
    if (eventType === "heartbeat") return;

    try {
      const data = JSON.parse(rawData);
      logDebug(this.logTag, `[${this.name}] Received ${eventType} event`, data);

      // Dispatch to the specific event type listeners
      this.emit(eventType, data);

      // Also dispatch to "update" as a catch-all for generic handlers
      if (eventType !== "connected" && eventType !== "status_change" && eventType !== "update") {
        this.emit("update", { type: eventType, ...data });
      }
    } catch {
      // Non-JSON data — ignore
    }
  }

  private reconnect() {
    if (this.isDestroyed) return;

    this.disconnect();

    if (this.retryTimeout) return;

    const delay = Math.min(
      SSEService.BASE_DELAY_MS * Math.pow(2, this.reconnectAttempt),
      SSEService.MAX_DELAY_MS,
    );
    const jitter = Math.random() * delay * 0.3;
    const finalDelay = Math.round(delay + jitter);
    this.reconnectAttempt++;

    logDebug(this.logTag, `[${this.name}] Scheduling reconnect in ${finalDelay}ms (attempt ${this.reconnectAttempt})...`);
    this.retryTimeout = setTimeout(() => {
      this.retryTimeout = null;
      this.connect();
    }, finalDelay);
  }

  public disconnect() {
    if (this.abortController) {
      this.intentionalDisconnect = true;
      this.abortController.abort();
      this.abortController = null;
    }
    // Clear pending reconnection timer to prevent reconnecting after disconnect
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    if (this._status !== 'disconnected') {
      this.setStatus('disconnected');
    }
  }

  public on(event: string, callback: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: unknown) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          logError(this.logTag, `[${this.name}] Error in event listener`, { error: e });
        }
      });
    }
  }

  public destroy() {
    this.isDestroyed = true;
    this.disconnect();
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.listeners.clear();
  }
}

// Bridge API SSE (Shop data) — auto-connect
export const shopSseService = new SSEService(
  'http://localhost:8090/api/events',
  'Shop_SSE',
  true,
  'DATA_SYNC',
);

// CMS Timeline API SSE — conditionally connected (controlled by cmsSettings.enabled)
export const cmsSseService = new SSEService(
  'http://localhost:48080/api/timeline/stream',
  'CMS_SSE',
  false,
  'CMS_DELIVERY',
);

export { SSEService };
