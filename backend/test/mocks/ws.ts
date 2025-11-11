import { WebSocketServer, WebSocket } from 'ws';
import { AddressInfo } from 'net';

export class MockWebSocketServer {
  private wss: WebSocketServer;

  private client?: WebSocket;
  private messages: any[] = [];

  private connectionResolve?: () => void;
  private messageResolve?: (value: any) => void;
  private closeResolve?: () => void;

  constructor() {
    console.log('Starting MockWebSocketServer...');
    this.wss = new WebSocketServer({ port: 0 });

    this.wss.on('connection', (ws) => {
      console.log('MockWebSocketServer: client connected');

      if (this.client) {
        throw new Error('MockWebSocketServer: only one client supported');
      }
      this.client = ws;

      if (this.connectionResolve) {
        this.connectionResolve();
        this.connectionResolve = undefined;
      }

      ws.on('message', (rawMessage) => {
        const message = JSON.parse(rawMessage.toString());
        console.log('MockWebSocketServer: received message:', message);
        if (this.messageResolve) {
          this.messageResolve(message);
          this.messageResolve = undefined;
        } else {
          this.messages.push(message);
        }
      });

      ws.on('close', () => {
        console.log('MockWebSocketServer: client disconnected');
        this.client = undefined;
        if (this.closeResolve) {
          this.closeResolve();
          this.closeResolve = undefined;
        }
      });
    });
  }

  public get url(): string {
    const address = this.wss.address() as AddressInfo;
    return `ws://localhost:${address.port}`;
  }

  public send(data: any) {
    if (!this.client) {
      throw new Error('MockWebSocketServer: no client connected');
    }
    const message = JSON.stringify(data);
    this.client.send(message);
  }

  public close(): Promise<void> {
    console.log('Closing MockWebSocketServer...');
    this.client?.close();
    return new Promise<void>((resolve) => {
      this.wss.close(() => {
        resolve();
      });
    });
  }

  public waitForConnection(): Promise<void> {
    return Promise.race([
      new Promise<void>((resolve) => {
        this.connectionResolve = resolve;
      }),
      new Promise<never>((_, reject) => setTimeout(() => {
          this.connectionResolve = undefined;
          reject(new Error('Timeout waiting for connection'));
      }, 5000))
    ]);
  }

  public waitForMessage(): Promise<any> {
    let message = this.messages.shift();
    if (message) {
      return Promise.resolve(message);
    }

    return Promise.race([
      new Promise<any>((resolve) => {
        this.messageResolve = resolve;
      }),
      new Promise<never>((_, reject) => setTimeout(() => {
          this.messageResolve = undefined;
          reject(new Error('Timeout waiting for message'));
      }, 5000))
    ]);
  }

  public waitForClose(): Promise<void> {
    return Promise.race([
      new Promise<void>((resolve) => {
        this.closeResolve = resolve;
      }),
      new Promise<never>((_, reject) => setTimeout(() => {
          this.closeResolve = undefined;
          reject(new Error('Timeout waiting for close'));
      }, 5000))
    ]);
  }
}
