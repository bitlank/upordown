import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PriceData } from '@shared/api-interfaces';

describe('PriceService', () => {
  let PriceService: any;
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

    BinanceStreamMock = vi.fn().mockImplementation((handler) => {
      priceHandler = handler;
      return {
        subscribePrice: vi.fn().mockResolvedValue(undefined),
        unsubscribePrice: vi.fn(),
        close: vi.fn(),
      };
    });

    fetchPrice = vi.fn().mockResolvedValue([fakePriceRest]);

    vi.doMock('../../src/price/binance-service', () => ({
        __esModule: true,
        default: { fetchPrice: fetchPrice },
        BinanceStream: BinanceStreamMock,
      }));

    PriceService = (await import('../../src/price/price-service')).default;
  });

  it('getCurrentPrice returns REST price, then uses cache', async () => {
    const result = await PriceService.getCurrentPrice('BTCUSDT');
    expect(result).toEqual(fakePriceRest);
    expect(fetchPrice).toHaveBeenCalledWith('BTCUSDT', 1);

    fetchPrice.mockClear();
    const result2 = await PriceService.getCurrentPrice('BTCUSDT');
    expect(fetchPrice).not.toHaveBeenCalled();
    expect(result2).toEqual(fakePriceRest);
  });

  it('returns updated price after BinanceStream sends new price', async () => {
    await PriceService.getCurrentPrice('BTCUSDT');

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
    const result = await PriceService.getCurrentPrice('BTCUSDT');
    expect(fetchPrice).not.toHaveBeenCalled();
    expect(result).toEqual(fakePriceStream);
    expect(result.close).not.toBe(fakePriceRest.close);
    expect(result.closeTime).not.toBe(fakePriceRest.closeTime);
  });
});
