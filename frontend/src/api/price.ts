import type { ApiPriceData } from "@shared/api-interfaces";
import { fetchJson } from "./fetch";

export async function fetchCurrentPrice(ticker: string): Promise<ApiPriceData> {
  return await fetchJson(`/price/${ticker}/current`);
}

export async function fetchRecentPrices(
  ticker: string,
  startAt: number,
): Promise<ApiPriceData[]> {
  return await fetchJson(`/price/${ticker}/recent/${startAt}`);
}
