import { PriceData } from './types';
import binanceService, { BinanceStream } from './binance-service.js';

const PRICE_DATA_DELAY = 3000;

function truncateToSecond(timestamp: number): number {
  return Math.trunc(timestamp / 1000) * 1000;
}

class PriceCache {
  private price?: PriceData;

  public addPrice(price: PriceData) {
    if (!this.price || this.price.openAt <= price.openAt) {
      this.price = price;
    }
  }

  public addPrices(prices: PriceData[]) {
    this.addPrice(prices[prices.length - 1]);
  }

  public getPrice(openAt?: number): PriceData | null {
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
      this.addToCache(price.ticker, [price]);
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
    const now = Date.now();
    for (const [ticker, lastAccessAt] of this.lastAccessAt.entries()) {
      if (now - lastAccessAt > this.timeoutMillis) {
        this.binanceStream.unsubscribePrice(ticker);
        this.lastAccessAt.delete(ticker);
        this.deleteCache(ticker);
        console.log(`Unsubscribed from inactive ticker: ${ticker}`);
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
    if (fetchedPrices.length === 0) {
      throw new Error(
        `Fetched empty price data for ${ticker} ${openAt || ''} at ${now}`,
      );
    }

    console.log(
      `Fetched ${fetchedPrices.length} prices for ${ticker} ${startAt} at ${now}`,
    );

    this.addToCache(ticker, fetchedPrices);
    prices.push(...fetchedPrices);

    return prices;
  }
}

export default PriceService.getInstance();
