export const SUPPORTED_TICKERS = [
  { ticker: 'BTCUSDT', displayName: 'BTC/USD' },
  { ticker: 'ETHUSDT', displayName: 'ETH/USD' },
  { ticker: 'SOLUSDT', displayName: 'SOL/USD' },
];

const MINUTE_IN_MILLIS = 60 * 1000;

export const RESOLUTION_INTERVAL = MINUTE_IN_MILLIS;

export function getResolutionTime(
  count: number = 0,
  timestamp: number = Date.now(),
): number {
  return (
    Math.ceil(timestamp / RESOLUTION_INTERVAL + count) * RESOLUTION_INTERVAL
  );
}
