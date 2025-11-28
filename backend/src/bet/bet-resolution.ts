import { Bet } from './types.js';
import { getResolutionTime } from './bet-config.js';
import { updateBet, findBets } from './bet-repository.js';
import { getPool } from '../db/db-pool.js';
import priceService, { PRICE_INTERVAL } from '../price/price-service.js';
import { updateUserStats } from '../user/user-repository.js';
import { groupBy } from '../utils.js';
import { BetStatus, BetDirection } from '../shared/api-interfaces.js';
import { Connection } from 'mysql2/promise.js';

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

async function resolveBet(connection: Connection, bet: Bet, price: number) {
  const newStatus = getBetStatus(bet, price);

  connection.beginTransaction();
  try {
    if (
      !(await updateBet(bet.id, BetStatus.Open, newStatus, price, connection))
    ) {
      connection.rollback();
      console.log(`Bet #${bet.id} already resolved!`);
      return;
    }

    await updateUserStats(
      bet.userId,
      newStatus === BetStatus.Won ? 1 : 0,
      newStatus === BetStatus.Lost ? 1 : 0,
      connection,
    );
    connection.commit();

    console.log(`Resolved bet #${bet.id} as ${newStatus}`);
  } catch (err) {
    connection.rollback();
    console.error(`Failed to resolve bet #${bet.id}`, err);
  }
}

async function getResolutionPrice(
  ticker: string,
  resolveAt: number,
): Promise<number | null> {
  const openAt = resolveAt - PRICE_INTERVAL;
  try {
    return (await priceService.getPrice(ticker, openAt)).close;
  } catch (err) {
    console.error(`Error fetching price for ${ticker}`, err);
    return null;
  }
}

async function resolveBetGroup(ticker: string, resolveAt: number, bets: Bet[]) {
  const resolutionPrice = await getResolutionPrice(ticker, resolveAt);
  if (!resolutionPrice) {
    return;
  }

  const connection = await getPool().getConnection();
  try {
    for (const bet of bets) {
      await resolveBet(connection, bet, resolutionPrice);
    }
  } finally {
    connection.release();
  }
}

async function resolveBets() {
  const lastResolveAt = getResolutionTime(-1);

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

export default resolveBets;
