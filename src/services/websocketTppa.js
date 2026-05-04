import { useSettingsStore } from '../store/settingsStore';
import { apiStore } from '@/store/store';

const backendProtokol = 'ws';
const backendPfad = '/v2/tppa';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.statusCallback = null;
    this.messageCallback = null;
    this.backendUrl = null;
    this.reconnectDelay = 2000; // 2 Sekunden
    this.shouldReconnect = true;
  }

  setStatusCallback(callback) {
    this.statusCallback = callback;
  }

  setMessageCallback(callback) {
    this.messageCallback = callback;
  }

  isOpen() {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  connect() {
    this.shouldReconnect = true;

    const settingsStore = useSettingsStore();
    const store = apiStore();
    const backendPort = store.apiPort;
    const backendHost = settingsStore.connection.ip || window.location.hostname;
    this.backendUrl = `${backendProtokol}://${backendHost}:${backendPort}${backendPfad}`;

    console.log('ws url: ', this.backendUrl);

    this.socket = new WebSocket(this.backendUrl);

    this.socket.onopen = () => {
      console.log('WebSocket TPPA connected.');
      if (this.statusCallback) {
        this.statusCallback('connected');
      }
    };

    this.socket.onmessage = (event) => {
      //console.log('Nachricht empfangen:', event.data);
      try {
        const message = JSON.parse(event.data);
        //console.log('Geparste Nachricht:', message);
        if (this.messageCallback) {
          this.messageCallback(message);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
        if (this.statusCallback) {
          this.statusCallback('Error receiving message');
        }
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket-Error:', error);
      if (this.statusCallback) {
        this.statusCallback('Error: ' + error.message);
      }
    };

    this.socket.onclose = () => {
      console.log('WebSocket closed.');
      if (this.statusCallback) {
        this.statusCallback('Closed');
      }

      if (this.shouldReconnect && store.isBackendReachable) {
        console.log(`Attempting to reconnect in ${this.reconnectDelay / 1000} seconds...`);
        setTimeout(() => this.connect(), this.reconnectDelay);
      }
    };
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.socket) {
      this.socket.close();
    }
  }

  sendMessage(message) {
    if (this.socket && this.socket.readyState === 1) {
      this.socket.send(message);
    } else {
      console.error('WebSocket TPPA is not connected. Message could not be sent.');
      if (this.statusCallback) {
        this.statusCallback('Error: WebSocket TPPA not connected');
      }
    }
  }
}

const websocketService = new WebSocketService();
export default websocketService;
