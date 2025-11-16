import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PriceData } from '../../src/price/types';

describe('PriceService', () => {
  let PriceService: any;
  let BinanceStreamMock: any;
  let priceHandler: (price: PriceData) => void;
  let subscribePrice: any;
  let fetchPrice: any;
  const now = Date.now();
  const prevSecond = Math.trunc(now / 1000) * 1000;

  const fakePriceRest: PriceData = {
    ticker: 'BTCUSDT',
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 1,
    openAt: prevSecond - 1000,
    closeAt: prevSecond - 1,
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();

    ((subscribePrice = vi.fn().mockResolvedValue(undefined)),
      (BinanceStreamMock = vi.fn().mockImplementation((handler) => {
        priceHandler = handler;
        return {
          subscribePrice: subscribePrice,
          unsubscribePrice: vi.fn(),
          close: vi.fn(),
        };
      })));

    fetchPrice = vi.fn().mockResolvedValue([fakePriceRest]);

    vi.doMock('../../src/price/binance-service', () => ({
      __esModule: true,
      default: { fetchPrice: fetchPrice },
      BinanceStream: BinanceStreamMock,
    }));

    PriceService = (await import('../../src/price/price-service')).default;
  });

  it('getPrice returns REST price, then uses cache', async () => {
    const result = await PriceService.getPrice('BTCUSDT', now);
    expect(result).toEqual(fakePriceRest);
    expect(fetchPrice).toHaveBeenCalledWith({
      ticker: 'BTCUSDT',
      startAt: fakePriceRest.openAt,
      limit: 1,
    });
    expect(subscribePrice).toHaveBeenCalled();

    fetchPrice.mockClear();
    const result2 = await PriceService.getPrice('BTCUSDT', now);
    expect(result2).toEqual(fakePriceRest);
    expect(fetchPrice).not.toHaveBeenCalled();
  });

  it('returns updated price after BinanceStream sends new price', async () => {
    await PriceService.getPrice('BTCUSDT', now);

    const fakePriceStream: PriceData = {
      ticker: 'BTCUSDT',
      open: 200,
      high: 210,
      low: 190,
      close: 205,
      volume: 2,
      openAt: fakePriceRest.openAt + 1000,
      closeAt: fakePriceRest.closeAt + 1000,
    };
    priceHandler(fakePriceStream);

    fetchPrice.mockClear();
    const result = await PriceService.getPrice('BTCUSDT', now + 1000);
    expect(result).toEqual(fakePriceStream);
    expect(result.close).not.toBe(fakePriceRest.close);
    expect(result.closeAt).not.toBe(fakePriceRest.closeAt);
    expect(fetchPrice).not.toHaveBeenCalled();
    expect(subscribePrice).toHaveBeenCalled();
  });
});
