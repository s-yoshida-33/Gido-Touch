import type { WspCurrentTimelineResponse } from '../types/wsp';

type SseEventType = 'connected' | 'switch' | 'preload' | 'update' | 'heartbeat';

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

export interface HeartbeatEvent {
  timestamp: string;
  clients: number;
}

type SseListener<T> = (data: T) => void;

import { getApiBaseUrl } from '../config';

// ... existing code ...

class SseClient {
  private eventSource: EventSource | null = null;
  private listeners: Map<SseEventType, Set<SseListener<any>>> = new Map();
  private reconnectTimer: number | undefined;
  private isConnecting: boolean = false;

  constructor() {}

  public async connect() {
    if (this.eventSource || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    try {
      const baseUrl = await getApiBaseUrl();
      const url = `${baseUrl}/api/events`;
      console.log(`[SSE] Connecting to ${url}`);
      
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log('[SSE] Connection opened');
        this.isConnecting = false;
      };

      this.eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        this.disconnect();
        this.isConnecting = false;
        // Reconnect after 3 seconds
        this.reconnectTimer = window.setTimeout(() => {
          this.connect();
        }, 3000);
      };

      // Setup event listeners
      this.setupEventListener('connected');
      this.setupEventListener('switch');
      this.setupEventListener('preload');
      this.setupEventListener('update');
      this.setupEventListener('heartbeat');
    } catch (e) {
      console.error('[SSE] Failed to connect:', e);
      this.isConnecting = false;
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
        console.error(`[SSE] Failed to parse ${type} event data:`, e);
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

export const sseClient = new SseClient();

