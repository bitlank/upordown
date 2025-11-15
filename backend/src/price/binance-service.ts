import WebSocket from 'ws';
import { PriceData } from '@shared/api-interfaces';

interface BinanceKline {
  t: number; // Kline start time
  T: number; // Kline close time
  s: string; // Symbol
  i: string; // Interval
  o: string; // Open price
  h: string; // High price
  l: string; // Low price
  c: string; // Close price
  v: string; // Volume
}

interface BinanceKlineMessage {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  k: BinanceKline;
}

export class BinanceStream {
  private ws?: WebSocket;
  private wsPromise?: Promise<WebSocket>;
  private subscriptionIds: Map<string, number> = new Map();
  private nextSubscriptionId = 1;
  private readonly handler: (price: PriceData) => void;
  private readonly websocketUrl: string =
    'wss://data-stream.binance.vision:443/ws';

  public constructor(handler: (price: PriceData) => void, wsUrl?: string) {
    this.handler = handler;
    if (wsUrl) {
      this.websocketUrl = wsUrl;
    }
  }

  private parseKlineData(kline: BinanceKline): PriceData {
    return {
      ticker: kline.s,
      open: Number(kline.o),
      high: Number(kline.h),
      low: Number(kline.l),
      close: Number(kline.c),
      volume: Number(kline.v),
      openTime: kline.t,
      closeTime: kline.T,
    };
  }

  private closeWs() {
    const closeWs = (ws: WebSocket) => {
      ws.close();
      console.log('Closed inactive WebSocket connection');
      this.ws = undefined;
      this.wsPromise = undefined;
      this.subscriptionIds.clear();
    };

    if (this.wsPromise) {
      this.wsPromise.then(closeWs);
    }

    if (this.ws) {
      closeWs(this.ws);
    }
  }

  private initWs(ws: WebSocket): void {
    ws.on('error', (error) => {
      console.error('WebSocket error', error);
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      this.ws = undefined;
      this.wsPromise = undefined;
      this.subscriptionIds.clear();
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as BinanceKlineMessage;
        if (message?.e !== 'kline' || !message.k) {
          return;
        }

        const price = this.parseKlineData(message.k);
        this.handler(price);
      } catch (error) {
        console.error('Error processing WebSocket message', error);
      }
    });

    this.ws = ws;
    this.wsPromise = undefined;
  }

  private async ensureConnection(): Promise<WebSocket> {
    if (this.ws) {
      return this.ws;
    }

    if (this.wsPromise) {
      return this.wsPromise;
    }

    this.wsPromise = new Promise((resolve, reject) => {
      const ws = new WebSocket(this.websocketUrl);

      ws.once('open', () => {
        console.log('WebSocket connection established');
        this.initWs(ws);
        resolve(ws);
      });

      ws.once('error', (error) => {
        console.error('WebSocket connection error', error);
        reject(error);
      });
    });

    return this.wsPromise;
  }

  private async sendSubscription(ticker: string) {
    if (this.subscriptionIds.has(ticker)) {
      return;
    }

    try {
      const ws = await this.ensureConnection();
      const id = this.nextSubscriptionId++;

      ws.send(
        JSON.stringify({
          method: 'SUBSCRIBE',
          params: [`${ticker.toLowerCase()}@kline_1s`],
          id: id,
        }),
      );

      this.subscriptionIds.set(ticker, id);
    } catch (error) {
      console.error('Failed to subscribe to price stream', error);
      return;
    }
  }

  private sendUnsubscription(ticker: string): void {
    const id = this.subscriptionIds.get(ticker);
    if (!id || !this.ws) {
      return;
    }

    try {
      this.ws.send(
        JSON.stringify({
          method: 'UNSUBSCRIBE',
          params: [`${ticker.toLowerCase()}@kline_1s`],
          id: id,
        }),
      );

      this.subscriptionIds.delete(ticker);

      if (this.subscriptionIds.size == 0) {
        this.closeWs();
      }
    } catch (error) {
      console.error('Failed to unsubscribe from price stream', error);
      return;
    }
  }

  public async subscribePrice(ticker: string) {
    const normalizedTicker = ticker.toUpperCase();
    if (this.subscriptionIds.has(normalizedTicker)) {
      return;
    }

    await this.ensureConnection();
    this.sendSubscription(normalizedTicker);
  }

  public unsubscribePrice(ticker: string) {
    const normalizedTicker = ticker.toUpperCase();
    if (!this.subscriptionIds.has(normalizedTicker)) {
      return;
    }

    this.sendUnsubscription(normalizedTicker);
  }

  public close() {
    this.closeWs();
  }
}

export class BinanceService {
  private static instance: BinanceService;
  private readonly restUrl: string = 'https://data-api.binance.vision/api/v3';

  public constructor(restUrl?: string) {
    if (restUrl) {
      this.restUrl = restUrl;
    }
  }

  public static getInstance(): BinanceService {
    if (!BinanceService.instance) {
      BinanceService.instance = new BinanceService();
    }
    return BinanceService.instance;
  }

  public async fetchPrice(ticker: string, limit: number): Promise<PriceData[]> {
    const normalizedTicker = ticker.toUpperCase();
    const response = await fetch(
      `${this.restUrl}/klines?symbol=${normalizedTicker}&interval=1s&limit=1`,
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Failed to fetch price for ${normalizedTicker}: ${response.status} ${response.statusText} - ${errorBody}`,
      );
    }

    const klines = await response.json();
    if (!Array.isArray(klines) || klines.length === 0) {
      throw new Error(`Invalid response for ${normalizedTicker}`);
    }

    const prices: PriceData[] = [];
    for (const kline of klines) {
      const [openTime, open, high, low, close, volume, closeTime] = kline;
      const price: PriceData = {
        ticker: normalizedTicker,
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume),
        openTime: Number(openTime),
        closeTime: Number(closeTime),
      };
      prices.push(price);
    }
    return prices;
  }
}

export default BinanceService.getInstance();
