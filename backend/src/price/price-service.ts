import binanceService, { BinanceStream } from './binance-service.js';
import { PriceData } from '@shared/api-interfaces';

class PriceService {
  private static instance: PriceService;
  private readonly lastAccessTime: Map<string, number> = new Map();
  private readonly prices: Map<string, PriceData> = new Map();
  private readonly timeoutMillis = 5 * 60 * 1000;
  private readonly binanceStream = new BinanceStream((price: PriceData) => {
    if (
      price.closeTime > (this.prices.get(price.ticker)?.closeTime || 0) &&
      this.lastAccessTime.has(price.ticker)
    ) {
      this.prices.set(price.ticker, price);
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
    for (const [ticker, lastAccessTime] of this.lastAccessTime.entries()) {
      if (now - lastAccessTime > this.timeoutMillis) {
        this.binanceStream.unsubscribePrice(ticker);
        this.lastAccessTime.delete(ticker);
        this.prices.delete(ticker);
        console.log(`Unsubscribed from inactive ticker: ${ticker}`);
      }
    }
  }

  public async getCurrentPrice(ticker: string): Promise<PriceData> {
    this.lastAccessTime.set(ticker, Date.now());

    const cached = this.prices.get(ticker);
    if (cached && Date.now() - cached.closeTime < 5000) {
      return cached;
    }

    this.binanceStream.subscribePrice(ticker);

    console.log(`Fetching current price for ${ticker} from REST API`);
    const prices = await binanceService.fetchPrice(ticker, 1);
    const price = prices[0];
    this.prices.set(ticker, price);
    return price;
  }

  public async getHistoricalPrices(
    ticker: string,
    limit: number,
  ): Promise<PriceData[]> {
    return [await this.getCurrentPrice(ticker)];
  }
}

export default PriceService.getInstance();
