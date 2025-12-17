import type { WspCurrentTimelineResponse } from '../types/wsp';

type SseEventType = 'connected' | 'switch' | 'preload' | 'update' | 'heartbeat' | 'status_change' | 'shops';

export type SseConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Event payload types based on API.md
// Exporting types to suppress unused errors (TS6196) and for potential future usage
export interface SseEvent<T = any> {
  type: SseEventType;
  timestamp: string;
  data: T;
}

// Event payload types based on API.md
export interface ConnectedEvent {
  type: 'connected';
  timestamp: string;
  current_timeline_index: number;
  schedule_id: string;
}

export interface SwitchEvent {
  type: 'switch';
  timestamp: string;
  current_timeline: WspCurrentTimelineResponse['current_timeline'];
}

export interface UpdateEvent {
  type: 'update';
  timestamp: string;
  schedule_id: string;
  message: string;
}

export interface ShopsEvent {
  type: 'shops';
  timestamp: string;
  data: any[];
}

export interface HeartbeatEvent {
  timestamp: string;
  clients: number;
}

type SseListener<T> = (data: T) => void;
type BaseUrlFetcher = () => Promise<string>;

class SseClient {
  private eventSource: EventSource | null = null;
  private listeners: Map<SseEventType, Set<SseListener<any>>> = new Map();
  private reconnectTimer: number | undefined;
  private isConnecting: boolean = false;
  private _status: SseConnectionStatus = 'disconnected';
  private baseUrlFetcher: BaseUrlFetcher;
  private clientName: string;

  constructor(baseUrlFetcher: BaseUrlFetcher, clientName: string = 'SSE') {
    this.baseUrlFetcher = baseUrlFetcher;
    this.clientName = clientName;
  }

  public get status(): SseConnectionStatus {
    return this._status;
  }

  private setStatus(status: SseConnectionStatus) {
    if (this._status !== status) {
      this._status = status;
      this.notifyListeners('status_change', { status });
    }
  }

  public async connect() {
    if (this.eventSource || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.setStatus('connecting');

    try {
      const baseUrl = await this.baseUrlFetcher();
      
      const url = `${baseUrl}/api/events`;
      console.log(`[${this.clientName}] Connecting to ${url}`);
      
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log(`[${this.clientName}] Connection opened`);
        this.isConnecting = false;
        this.setStatus('connected');
      };

      this.eventSource.onerror = (error) => {
        console.error(`[${this.clientName}] Connection error:`, error);
        this.disconnect();
        this.isConnecting = false;
        this.setStatus('error');
        // Reconnect after 3 seconds
        this.reconnectTimer = window.setTimeout(() => {
          this.connect();
        }, 3000);
      };

      // Handle default 'message' event (when event field is missing or generic)
      this.eventSource.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          // Try to determine event type from payload
          // Expected format: { type: "shops", ... }
          if (data && data.type) {
             const eventType = data.type as SseEventType;
             // Only notify if it's a known event type
             // This acts as a fallback if the server didn't set the 'event' field in the SSE stream
             this.notifyListeners(eventType, data);
             
             // Also notify generic listeners if we had any (not implemented currently)
          } else {
             // console.log(`[${this.clientName}] Received generic message without type:`, data);
          }
        } catch (e) {
          console.error(`[${this.clientName}] Failed to parse message event data:`, e);
        }
      };

      // Setup specific event listeners (when event field is present)
      this.setupEventListener('connected');
      this.setupEventListener('switch');
      this.setupEventListener('preload');
      this.setupEventListener('update');
      this.setupEventListener('shops');
      this.setupEventListener('heartbeat');
    } catch (e) {
      console.error(`[${this.clientName}] Failed to connect:`, e);
      this.isConnecting = false;
      this.setStatus('error');
      // Reconnect after 3 seconds
      this.reconnectTimer = window.setTimeout(() => {
        this.connect();
      }, 3000);
    }
  }

  private setupEventListener(type: SseEventType) {
    if (!this.eventSource) return;

    this.eventSource.addEventListener(type, (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        this.notifyListeners(type, data);
      } catch (e) {
        console.error(`[${this.clientName}] Failed to parse ${type} event data:`, e);
      }
    });
  }

  public disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.setStatus('disconnected');
  }

  public on<T>(type: SseEventType, listener: SseListener<T>) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  private notifyListeners(type: SseEventType, data: any) {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach(listener => listener(data));
    }
  }
}

// Default SSE client for CMS API (8080)
export const sseClient = new SseClient(async () => {
  if (window.wspApi) {
    try {
      return await window.wspApi.getBaseUrl();
    } catch (e) {
      console.warn('[SSE] Failed to get CMS base URL from wspApi, using fallback', e);
    }
  }
  return 'http://localhost:8080';
}, 'CMS_SSE');

// Shop SSE client for Shop API (8090 - Bridge)
export const shopSseClient = new SseClient(async () => {
  if (window.electronAPI && window.electronAPI.getBridgeBaseUrl) {
    try {
      const bridgeUrl = await window.electronAPI.getBridgeBaseUrl();
      if (bridgeUrl) {
        return bridgeUrl;
      }
    } catch (e) {
      console.warn('[ShopSSE] Failed to get Bridge base URL, falling back to default', e);
    }
  }
  return 'http://localhost:8090';
}, 'Shop_SSE');
