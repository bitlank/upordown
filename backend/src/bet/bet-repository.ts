import { Bet } from './types';
import { getPool } from '../db/db-pool.js';
import { parseEnumOrThrow } from 'src/utils.js';
import { BetDirection, BetStatus } from '@shared/api-interfaces';
import { RowDataPacket, ResultSetHeader, Connection } from 'mysql2/promise';

function mapBet(row: RowDataPacket): Bet {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    ticker: row.ticker,
    openedAt: (row.opened_at as Date).getTime(),
    resolveAt: (row.resolve_at as Date).getTime(),
    direction: parseEnumOrThrow(BetDirection, row.direction),
    openPrice: Number(row.open_price),
    resolutionPrice: Number(row.resolution_price),
    status: parseEnumOrThrow(BetStatus, row.status),
  };
}

export async function createBet(
  userId: number,
  ticker: string,
  direction: BetDirection,
  openPrice: number,
  openedAt: number,
  resolveAt: number,
  connection?: Connection,
): Promise<number> {
  const conn = connection ? connection : getPool();
  const [result] = await conn.execute<ResultSetHeader>(
    `
      INSERT INTO bets (user_id, ticker, direction, open_price, opened_at, resolve_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      userId,
      ticker,
      direction,
      openPrice,
      new Date(openedAt),
      new Date(resolveAt),
      BetStatus.Open,
    ],
  );

  return result.insertId;
}

export async function getBet(
  id: number,
  connection?: Connection,
): Promise<Bet> {
  const conn = connection ? connection : getPool();
  const [rows] = await conn.execute<RowDataPacket[]>(
    `
      SELECT *
      FROM bets
      WHERE id = ?
    `,
    [id],
  );

  return mapBet(rows[0]);
}

export interface BetQuery {
  userId?: number;
  status?: BetStatus[];
  resolveAtMax?: number;
}

export async function findBets(
  betQuery: BetQuery,
  connection?: Connection,
): Promise<Bet[]> {
  let query: string[] = [];
  const params = [];

  if (betQuery.userId) {
    query.push('user_id = ?');
    params.push(betQuery.userId);
  }

  if (betQuery.status && betQuery.status.length > 0) {
    const placeholders = betQuery.status.map(() => '?').join(', ');
    query.push(`status IN (${placeholders})`);
    params.push(...betQuery.status);
  }

  if (betQuery.resolveAtMax) {
    query.push('resolve_at <= ?');
    params.push(new Date(betQuery.resolveAtMax));
  }

  const queryString = query.length > 0 ? 'WHERE ' + query.join(' AND ') : '';
  const conn = connection ? connection : getPool();
  const [rows] = await conn.execute<RowDataPacket[]>(
    `
      SELECT *
      FROM bets
      ${queryString}
    `,
    params,
  );

  const bets = rows.map((row) => mapBet(row));
  return bets;
}

export async function updateBet(
  betId: number,
  oldStatus: BetStatus,
  newStatus: BetStatus,
  resolutionPrice: number,
  connection?: Connection,
): Promise<boolean> {
  const conn = connection ? connection : getPool();
  const [result] = await conn.execute<ResultSetHeader>(
    `
      UPDATE bets
      SET status = ?, resolution_price = ?
      WHERE id = ? AND status = ?
    `,
    [newStatus, resolutionPrice, betId, oldStatus],
  );

  return (result.affectedRows || 0) === 1;
}
