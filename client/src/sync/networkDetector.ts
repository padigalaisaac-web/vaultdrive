import { NetworkStatus } from '../types/index.js';

type NetworkListener = (status: NetworkStatus) => void;

class NetworkDetector {
  private currentStatus: NetworkStatus = navigator.onLine ? 'ONLINE' : 'OFFLINE';
  private listeners: Set<NetworkListener> = new Set();
  private pingIntervalId: number | null = null;
  private isChecking: boolean = false;

  constructor() {
    window.addEventListener('online', () => this.handleNetworkEvent(true));
    window.addEventListener('offline', () => this.handleNetworkEvent(false));
    this.startHeartbeat();
  }

  public getStatus(): NetworkStatus {
    return this.currentStatus;
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(status: NetworkStatus) {
    this.currentStatus = status;
    this.listeners.forEach(fn => fn(status));
  }

  private async handleNetworkEvent(isOnline: boolean) {
    if (!isOnline) {
      this.notifyListeners('OFFLINE');
      return;
    }
    // Verify server connectivity
    await this.checkServerConnectivity();
  }

  public async checkServerConnectivity(): Promise<boolean> {
    if (!navigator.onLine) {
      if (this.currentStatus !== 'OFFLINE') {
        this.notifyListeners('OFFLINE');
      }
      return false;
    }

    if (this.isChecking) return this.currentStatus === 'ONLINE';
    this.isChecking = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch('/api/sync/ping', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        if (this.currentStatus !== 'ONLINE' && this.currentStatus !== 'SYNCING') {
          this.notifyListeners('ONLINE');
        }
        this.isChecking = false;
        return true;
      } else {
        if (this.currentStatus !== 'SERVER_UNAVAILABLE') {
          this.notifyListeners('SERVER_UNAVAILABLE');
        }
        this.isChecking = false;
        return false;
      }
    } catch {
      if (this.currentStatus !== 'SERVER_UNAVAILABLE' && this.currentStatus !== 'OFFLINE') {
        this.notifyListeners('SERVER_UNAVAILABLE');
      }
      this.isChecking = false;
      return false;
    }
  }

  private startHeartbeat() {
    if (this.pingIntervalId) clearInterval(this.pingIntervalId);
    this.pingIntervalId = window.setInterval(() => {
      this.checkServerConnectivity();
    }, 15000);
  }
}

export const networkDetector = new NetworkDetector();
