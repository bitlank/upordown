import { PriceData } from './types';
import binanceService, { BinanceStream } from './binance-service.js';

export const PRICE_MAX_AGE_MINUTES = 5;
const MINUTE_IN_MILLIS = 60 * 1000;
const PRICE_CACHE_TIMEOUT = PRICE_MAX_AGE_MINUTES * MINUTE_IN_MILLIS + 1000;

const PRICE_DATA_DELAY = 3000;

function truncateToSecond(timestamp: number): number {
  return Math.trunc(timestamp / 1000) * 1000;
}

class PriceCache {
  private cache: Map<number, PriceData> = new Map();

  public addPrice(price: PriceData) {
    this.cache.set(price.openAt, price);
  }

  public addPrices(prices: PriceData[]) {
    for (const price of prices) {
      this.addPrice(price);
    }
  }

  public getPrice(openAt?: number): PriceData | null {
    if (!openAt) {
      return this.cache.get(Math.max(...this.cache.keys())) || null;
    }
    return this.cache.get(openAt) || null;
  }

  public cleanup(): number {
    const cleanupBefore = Date.now() - PRICE_CACHE_TIMEOUT;
    let count = 0;

    for (const openAt of this.cache.keys()) {
      if (openAt < cleanupBefore) {
        this.cache.delete(openAt);
        count++;
      }
    }

    return count;
  }
}

class PriceService {
  private static instance: PriceService;
  private readonly lastAccessAt: Map<string, number> = new Map();
  private readonly priceCache: Map<string, PriceCache> = new Map();
  private readonly binanceStream = new BinanceStream((price: PriceData) => {
    const delay = Date.now() - (price.openAt + 1000);

    console.log(
      `Price data message for ${price.ticker} ${price.openAt} received with a delay of ${delay} ms`,
    );
    if (this.lastAccessAt.has(price.ticker)) {
      this.addToCache(price.ticker, [price]);
    }
  });

  private constructor() {
    setInterval(() => this.cleanup(), MINUTE_IN_MILLIS);
  }

  public static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  private deleteCache(ticker: string) {
    this.priceCache.delete(ticker);
  }

  private getCache(ticker: string): PriceCache | undefined {
    return this.priceCache.get(ticker);
  }

  private addToCache(ticker: string, prices: PriceData[]) {
    let cache = this.getCache(ticker);
    if (!cache) {
      cache = new PriceCache();
      this.priceCache.set(ticker, cache);
    }

    cache.addPrices(prices);
  }

  private getFromCache(ticker: string, openAt?: number): PriceData | null {
    return this.getCache(ticker)?.getPrice(openAt) || null;
  }

  private cleanup() {
    const cleanupBefore = Date.now() - PRICE_CACHE_TIMEOUT;
    for (const [ticker, lastAccessAt] of this.lastAccessAt.entries()) {
      if (lastAccessAt < cleanupBefore) {
        this.binanceStream.unsubscribePrice(ticker);
        this.lastAccessAt.delete(ticker);
        this.deleteCache(ticker);

        console.log(`Unsubscribed from inactive ticker: ${ticker}`);
      } else {
        const cleanedUp = this.getCache(ticker)?.cleanup();
        if ((cleanedUp || 0) > 0) {
          console.log(
            `Cleaned up ${cleanedUp} prices for ${ticker} from cache`,
          );
        }
      }
    }
  }

  public async getPrice(ticker: string, openAt?: number): Promise<PriceData> {
    const now = Date.now();
    this.lastAccessAt.set(ticker, now);

    const openAtNormalized = openAt ? truncateToSecond(openAt) : openAt;
    const cached = this.getFromCache(ticker, openAtNormalized);
    if (cached && (openAt || now - cached.openAt < PRICE_DATA_DELAY)) {
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
    this.addToCache(ticker, prices);

    console.log(`Price data fetched for ${ticker} ${price.openAt} at ${now}`);
    return price;
  }

  public async getRecentPrices(
    ticker: string,
    startAt: number,
  ): Promise<PriceData[]> {
    const now = Date.now();
    this.lastAccessAt.set(ticker, now);

    const prices: PriceData[] = [];
    let openAt = truncateToSecond(startAt);

    for (; openAt < now; openAt += 1000) {
      const cached = this.getFromCache(ticker, openAt);
      if (!cached) {
        break;
      }
      prices.push(cached);
    }

    if (now - openAt < PRICE_DATA_DELAY) {
      return prices;
    }

    this.binanceStream.subscribePrice(ticker);

    const fetchedPrices = await binanceService.fetchPrice({
      ticker,
      startAt: openAt,
    });

    console.log(
      `Fetched ${fetchedPrices.length} prices for ${ticker} ${startAt} at ${now}`,
    );

    this.addToCache(ticker, fetchedPrices);
    prices.push(...fetchedPrices);

    return prices;
  }
}

export default PriceService.getInstance();
