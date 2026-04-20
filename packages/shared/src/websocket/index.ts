// WebSocket client for real-time communication
export class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string;
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 2000;
  private isConnecting = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.isConnecting || (this.socket && this.socket.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    
    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        // Emit connect event
        this.handleMessage({ type: 'connect', data: null });
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.socket.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        this.attemptReconnect();
      };

      this.socket.onerror = (error) => {
        console.warn('WebSocket error:', error);
        this.isConnecting = false;
      };
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.warn('Max reconnect attempts reached. WebSocket connection failed.');
    }
  }

  private handleMessage(message: any): void {
    const { type, data } = message;
    if (type && this.messageHandlers.has(type)) {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(data);
          } catch (error) {
            console.error('Error in message handler:', error);
          }
        });
      }
    }
  }

  on(type: string, handler: (data: any) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)?.push(handler);
  }

  off(type: string, handler: (data: any) => void): void {
    if (this.messageHandlers.has(type)) {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        const filteredHandlers = handlers.filter(h => h !== handler);
        if (filteredHandlers.length > 0) {
          this.messageHandlers.set(type, filteredHandlers);
        } else {
          this.messageHandlers.delete(type);
        }
      }
    }
  }

  send(type: string, data: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify({ type, data }));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    } else {
      console.warn('WebSocket not connected, message not sent');
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}

// Create and export a singleton instance
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
export const wsClient = new WebSocketClient(WS_URL);
