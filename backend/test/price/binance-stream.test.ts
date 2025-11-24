import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BinanceStream } from '../../src/price/binance-service.js';
import { MockWebSocketServer } from '../mocks/ws.js';
import { PriceData } from '../shared/api-interfaces.js';

describe('BinanceStream', () => {
  let mockServer: MockWebSocketServer;

  beforeEach(() => {
    mockServer = new MockWebSocketServer();
  });

  afterEach(async () => {
    await mockServer.close();
  });

  it('connects to the WebSocket server and subscribes to a ticker', async () => {
    const stream = new BinanceStream(() => {}, mockServer.url);
    await stream.subscribePrice('BTCUSDT');

    console.log('Waiting for subscribe message...');
    const message = await mockServer.waitForMessage();
    expect(message.method).toBe('SUBSCRIBE');
    expect(message.params).toEqual(['btcusdt@kline_1s']);
  });

  it('handles incoming kline messages', async () => {
    let resolvePrice!: (price: PriceData) => void;
    const receivedPrice: Promise<PriceData> = new Promise((resolve) => {
      resolvePrice = resolve;
    });

    const stream = new BinanceStream(resolvePrice, mockServer.url);
    await stream.subscribePrice('BTCUSDT');

    const klineMessage = {
      e: 'kline',
      k: {
        t: 1625097600000,
        T: 1625097659999,
        s: 'BTCUSDT',
        i: '1s',
        o: '34000',
        h: '34001',
        l: '33999',
        c: '34000.5',
        v: '10',
      },
    };
    mockServer.send(klineMessage);

    await receivedPrice.then((price) => {
      expect(price.ticker).toBe('BTCUSDT');
      expect(price.close).toBe(34000.5);
    });
  });

  it('unsubscribes from a ticker', async () => {
    const stream = new BinanceStream(() => {}, mockServer.url);
    await stream.subscribePrice('BTCUSDT');
    await mockServer.waitForMessage();

    stream.unsubscribePrice('BTCUSDT');
    const unsubscribeMessage = await mockServer.waitForMessage();
    expect(unsubscribeMessage.method).toBe('UNSUBSCRIBE');
    expect(unsubscribeMessage.params).toEqual(['btcusdt@kline_1s']);
  });

  it('closes the connection when the last ticker is unsubscribed', async () => {
    const stream = new BinanceStream(() => {}, mockServer.url);
    await stream.subscribePrice('BTCUSDT');
    await mockServer.waitForMessage();

    stream.unsubscribePrice('BTCUSDT');
    await mockServer.waitForMessage();
    await mockServer.waitForClose();
  });
});
