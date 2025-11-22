import { Bet } from './types';
import { createBet, findBets, getBet, updateBet } from './bet-repository.js';
import { updateUserScore } from '../user/user-repository.js';
import priceService from '../price/price-service.js';
import { groupBy } from '../utils.js';
import { getPool } from '../db/db-pool.js';
import { ApiBetInfo, BetDirection, BetStatus } from '@shared/api-interfaces.js';

const SUPPORTED_TICKERS = [
  { ticker: 'BTCUSDT', displayName: 'BTC/USD' },
  { ticker: 'ETHUSDT', displayName: 'ETH/USD' },
  { ticker: 'SOLUSDT', displayName: 'SOL/USD' },
];

const MINUTE_IN_MILLIS = 60 * 1000;
const RESULUTION_JOB_DELAY = 500;

function getNextMinute(timestamp: number = Date.now()): number {
  return Math.ceil(timestamp / MINUTE_IN_MILLIS) * MINUTE_IN_MILLIS;
}

function getResolutionJobDelay(): number {
  const now = Date.now();
  return getNextMinute(now) - now + RESULUTION_JOB_DELAY;
}

function getBetStatus(bet: Bet, resolutionPrice: number): BetStatus {
  const priceChangeSign = Math.sign(resolutionPrice - bet.openPrice);
  const directionMappings: Record<number, BetDirection | null> = {
    [1]: BetDirection.Long,
    [0]: null,
    [-1]: BetDirection.Short,
  };
  const priceDirection = directionMappings[priceChangeSign];

  return bet.direction === priceDirection ? BetStatus.Won : BetStatus.Lost;
}

async function resolveBetGroup(ticker: string, resolveAt: number, bets: Bet[]) {
  let resolutionPrice: number;
  try {
    const openAt = resolveAt - 1000;
    resolutionPrice = (await priceService.getPrice(ticker, openAt)).close;
  } catch (err) {
    console.error(`Error fetching price for ${ticker}`, err);
    return;
  }

  for (const bet of bets) {
    const newStatus = getBetStatus(bet, resolutionPrice);
    const scoreChange = newStatus === BetStatus.Won ? 1 : -1;

    const connection = await getPool().getConnection();
    try {
      connection.beginTransaction();

      const resolved = await updateBet(
        bet.id,
        BetStatus.Open,
        newStatus,
        resolutionPrice,
        connection,
      );
      if (!resolved) {
        console.log(`Bet #${bet.id} already resolved!`);
        continue;
      }

      await updateUserScore(bet.userId, scoreChange, connection);
      connection.commit();

      console.log(`Resolved bet #${bet.id} as ${newStatus}`);
    } catch (err) {
      console.error(`Failed to resolve bet #${bet.id}`, err);
    } finally {
      connection.release();
    }
  }
}

async function resolveBets() {
  const lastResolveAt = getNextMinute() - MINUTE_IN_MILLIS;

  console.log(`Resolving bets at ${lastResolveAt}`);
  const betsToResolve = await findBets({
    status: [BetStatus.Open],
    resolveAtMax: lastResolveAt,
  });
  if (betsToResolve.length === 0) {
    console.log('No bets to resolve');
    return;
  }

  for (const [ticker, betGroupByTicker] of groupBy(
    betsToResolve,
    (b) => b.ticker,
  )) {
    for (const [resolveAt, betGroupByTime] of groupBy(
      betGroupByTicker,
      (b) => b.resolveAt,
    )) {
      console.log(
        `Resolving ${betGroupByTime.length} bets for ${ticker} at ${resolveAt}`,
      );
      await resolveBetGroup(ticker, resolveAt, betGroupByTime);
    }
  }
}

export function getBetInfo(): ApiBetInfo {
  const betDeadline = getNextMinute();
  return {
    tickers: SUPPORTED_TICKERS,
    betDeadline: betDeadline,
    resolveAt: betDeadline + MINUTE_IN_MILLIS,
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
  const resolveAt = getNextMinute(openedAt) + MINUTE_IN_MILLIS;
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

class BetService {
  private static instance: BetService;
  private started: boolean = false;
  private timeout: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): BetService {
    if (!BetService.instance) {
      BetService.instance = new BetService();
    }
    return BetService.instance;
  }

  private async resolveNext() {
    try {
      this.timeout = null;
      await resolveBets();
    } catch (err) {
      console.error('Error resolving bets', err);
    }

    if (this.started) {
      const delay = getResolutionJobDelay();
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

export default BetService.getInstance();
