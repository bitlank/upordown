import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PriceData } from '../../shared/src/api-interfaces';

describe('MarketDataService', () => {
  let MarketDataService: any;
  let BinanceStreamMock: any;
  let priceHandler: (price: PriceData) => void;
  let fetchPrice: any;
  const now = Date.now();

  const fakePriceRest: PriceData = {
    ticker: 'BTCUSDT',
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 1,
    openTime: now - 2000,
    closeTime: now - 2000
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
    fetchPrice = vi.fn().mockResolvedValue([fakePriceRest]);

    BinanceStreamMock = vi.fn().mockImplementation((handler) => {
      priceHandler = handler;
      return {
        subscribePrice: vi.fn().mockResolvedValue(undefined),
        unsubscribePrice: vi.fn(),
        close: vi.fn(),
      };
    });

    vi.doMock('../src/services/binance-service', () => ({
      __esModule: true,
      default: { fetchPrice },
      BinanceStream: BinanceStreamMock,
    }));

    MarketDataService = (await import('../src/services/market-data-service')).default;
  });

  it('getCurrentPrice returns REST price, then uses cache', async () => {
    const result = await MarketDataService.getCurrentPrice('BTCUSDT');
    expect(result).toEqual(fakePriceRest);
    expect(fetchPrice).toHaveBeenCalledWith('BTCUSDT', 1);

    fetchPrice.mockClear();
    const result2 = await MarketDataService.getCurrentPrice('BTCUSDT');
    expect(fetchPrice).not.toHaveBeenCalled();
    expect(result2).toEqual(fakePriceRest);
  });

  it('returns updated price after BinanceStream sends new price', async () => {
    await MarketDataService.getCurrentPrice('BTCUSDT');

    const fakePriceStream: PriceData = {
      ticker: 'BTCUSDT',
      open: 200,
      high: 210,
      low: 190,
      close: 205,
      volume: 2,
      openTime: fakePriceRest.openTime + 1000,
      closeTime: fakePriceRest.closeTime + 1000
    };
    priceHandler(fakePriceStream);

    fetchPrice.mockClear();
    const result = await MarketDataService.getCurrentPrice('BTCUSDT');
    expect(fetchPrice).not.toHaveBeenCalled();
    expect(result).toEqual(fakePriceStream);
    expect(result.close).not.toBe(fakePriceRest.close);
    expect(result.closeTime).not.toBe(fakePriceRest.closeTime);
  });
});
