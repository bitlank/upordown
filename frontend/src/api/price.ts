import type { PriceData } from '@shared/api-interfaces';

export async function fetchCurrentPrice(ticker: string): Promise<PriceData> {
  const res = await fetch(`/api/price/${ticker}/current`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch price');

  let price: PriceData;
  try {
    price = await res.json();
  } catch (err) {
    throw new Error('Failed to parse price data');
  }

  if (typeof price.close !== 'number') {
    throw new Error('Invalid price data');
  }

  return price;
}
