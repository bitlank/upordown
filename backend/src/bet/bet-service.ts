import { Bet } from './types';
import { createBet, getBet } from './bet-repository.js';
import priceService from '../price/price-service.js';
import { ApiBetInfo, BetDirection } from '@shared/api-interfaces.js';
import {
  getResolutionTime,
  RESOLUTION_INTERVAL,
  SUPPORTED_TICKERS,
} from './bet-config.js';
import resolveBets from './bet-resolution.js';

export function getBetInfo(): ApiBetInfo {
  const betDeadline = getResolutionTime();
  return {
    tickers: SUPPORTED_TICKERS,
    betDeadline: betDeadline,
    resolveAt: betDeadline + RESOLUTION_INTERVAL,
  };
}

export function isTickerSupported(ticker: string): boolean {
  return SUPPORTED_TICKERS.find((t) => t.ticker === ticker) !== undefined;
}

export async function placeBet(
  userId: number,
  ticker: string,
  direction: BetDirection,
): Promise<Bet> {
  const openedAt = Date.now();
  const resolveAt = getResolutionTime(1, openedAt);
  const openPrice = (await priceService.getPrice(ticker)).close;

  const id = await createBet(
    userId,
    ticker,
    direction,
    openPrice,
    openedAt,
    resolveAt,
  );

  const bet = await getBet(id);
  console.log(
    `Placed bet #${id}: ${bet.direction} on ${bet.ticker} resolving at ${bet.resolveAt}`,
  );

  return bet;
}

const RESOLUTION_JOB_DELAY = 500;

class BetService {
  private started: boolean = false;
  private timeout: NodeJS.Timeout | null = null;

  private getResolutionTimeRemaining(): number {
    const now = Date.now();
    return getResolutionTime(0, now) - now;
  }

  private async resolveNext() {
    try {
      this.timeout = null;
      await resolveBets();
    } catch (err) {
      console.error('Error resolving bets', err);
    }

    if (this.started) {
      const delay = this.getResolutionTimeRemaining() + RESOLUTION_JOB_DELAY;
      console.log(`Bet resolution job scheduled in ${delay} ms`);
      this.timeout = setTimeout(() => this.resolveNext(), delay);
    }
  }

  public async start() {
    if (this.started) {
      return;
    }
    this.started = true;
    console.log('Bet resolution service started');

    this.resolveNext();
  }

  public stop() {
    this.started = false;
    if (this.timeout) {
      clearInterval(this.timeout);
      this.timeout = null;

      console.log('Bet resolution service stopped');
    }
  }
}

export default new BetService();
