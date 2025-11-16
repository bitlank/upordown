import { PriceData } from './types';
import binanceService, { BinanceStream } from './binance-service.js';

class PriceCache {
  private price?: PriceData;

  public add(price: PriceData) {
    if (!this.price || this.price.openAt <= price.openAt) {
      this.price = price;
    }
  }

  public get(openAt?: number): PriceData | null {
    if (this.price && (!openAt || this.price.openAt == openAt)) {
      return this.price;
    }
    return null;
  }
}

class PriceService {
  private static instance: PriceService;
  private readonly lastAccessAt: Map<string, number> = new Map();
  private readonly priceCache: Map<string, PriceCache> = new Map();
  private readonly timeoutMillis = 5 * 60 * 1000;
  private readonly binanceStream = new BinanceStream((price: PriceData) => {
    const delay = Date.now() - (price.openAt + 1000);

    console.log(
      `Price data message for ${price.ticker} ${price.openAt} received with a delay of ${delay} ms`,
    );
    if (this.lastAccessAt.has(price.ticker)) {
      this.priceCache.get(price.ticker)?.add(price);
    }
  });

  private constructor() {
    setInterval(() => this.cleanup(), 60000);
  }

  public static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  private cleanup() {
    const now = Date.now();
    for (const [ticker, lastAccessAt] of this.lastAccessAt.entries()) {
      if (now - lastAccessAt > this.timeoutMillis) {
        this.binanceStream.unsubscribePrice(ticker);
        this.lastAccessAt.delete(ticker);
        this.priceCache.delete(ticker);
        console.log(`Unsubscribed from inactive ticker: ${ticker}`);
      }
    }
  }

  private addToCache(ticker: string, price: PriceData) {
    let cache = this.priceCache.get(ticker);
    if (!cache) {
      cache = new PriceCache();
      this.priceCache.set(ticker, cache);
    }

    cache.add(price);
  }

  private getFromCache(ticker: string, openAt?: number): PriceData | null {
    return this.priceCache.get(ticker)?.get(openAt) || null;
  }

  public async getPrice(ticker: string, openAt?: number): Promise<PriceData> {
    const now = Date.now();
    this.lastAccessAt.set(ticker, now);

    const openAtNormalized = openAt
      ? (Math.trunc(openAt / 1000) - 1) * 1000
      : openAt;
    const cached = this.getFromCache(ticker, openAtNormalized);
    if (cached && (openAt || now - cached.openAt < 3000)) {
      return cached;
    }

    this.binanceStream.subscribePrice(ticker);

    const prices = await binanceService.fetchPrice({
      ticker,
      startAt: openAtNormalized,
      limit: 1,
    });

    const price = prices[0];
    if (!price) {
      throw new Error(
        `Fetched empty price data for ${ticker} ${openAtNormalized || ''} at ${now}`,
      );
    }
    this.addToCache(ticker, price);

    console.log(`Price data fetched for ${ticker} ${price.openAt} at ${now}`);
    return price;
  }

  public async getHistoricalPrices(
    ticker: string,
    limit: number,
  ): Promise<PriceData[]> {
    return [await this.getPrice(ticker)];
  }
}

export default PriceService.getInstance();
