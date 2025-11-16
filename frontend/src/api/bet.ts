import type { Bet } from '../../../backend/src/bet/bet-repository';

export async function getBetInfo(): Promise<{ supportedTickers: string[]; nextBetTimestamp: Date }> {
  const response = await fetch('/api/bet/info');
  return response.json();
}

export async function getOpenBets(): Promise<Bet[]> {
  const response = await fetch('/api/bet/open');
  return response.json();
}

export async function placeBet(ticker: string, direction: 'long' | 'short'): Promise<void> {
  await fetch(`/api/bet/${ticker}/${direction}`, {
    method: 'POST',
  });
}
