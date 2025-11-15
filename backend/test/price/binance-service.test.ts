import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BinanceService } from '../../src/price/binance-service.js';

describe('BinanceService.fetchPrice', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses klines array response into PriceData', async () => {
    const fakeKlines = [
      [
        1600000000000,
        '100.0',
        '110.0',
        '90.0',
        '105.0',
        '123.4',
        1600000001000,
      ],
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(fakeKlines),
      }),
    );

    const svc = new BinanceService();
    const prices = await svc.fetchPrice('BTCUSDT', 1);

    expect(prices).toHaveLength(1);
    const p = prices[0];
    expect(p.ticker).toBe('BTCUSDT');
    expect(p.close).toBe(105.0);
  });

  it('throws an error for a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Not Found'),
      }),
    );

    const svc = new BinanceService();
    await expect(svc.fetchPrice('BTCUSDT', 1)).rejects.toThrow();
  });

  it('throws an error for an empty klines array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    const svc = new BinanceService();
    await expect(svc.fetchPrice('BTCUSDT', 1)).rejects.toThrow(
      'Invalid response for BTCUSDT',
    );
  });
});
