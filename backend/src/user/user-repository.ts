import { User } from './types';
import { getPool } from '../db/db-pool.js';
import { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export async function createUser(connection?: Connection): Promise<number> {
  const conn = connection ? connection : getPool();
  const [result] = await conn.execute<ResultSetHeader>(
    `
      INSERT INTO users (created_at, bets_won, bets_lost)
      VALUES (?, ?, ?)
    `,
    [new Date(), 0, 0],
  );

  return result.insertId;
}

export async function getUser(
  userId: number,
  connection?: Connection,
): Promise<User | null> {
  const conn = connection ? connection : getPool();
  const [[row]] = await conn.execute<RowDataPacket[]>(
    `
      SELECT *
      FROM users
      WHERE id = ?
    `,
    [userId],
  );

  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    createdAt: (row.created_at as Date).getTime(),
    betsWon: Number(row.bets_won),
    betsLost: Number(row.bets_lost),
  };
}

export async function updateUserStats(
  userId: number,
  betsWon: number,
  betsLost: number,
  connection?: Connection,
): Promise<boolean> {
  const conn = connection ? connection : getPool();
  const [result] = await conn.execute<ResultSetHeader>(
    `
      UPDATE users
      SET
        bets_won = bets_won + ?,
        bets_lost = bets_lost + ?
      WHERE id = ?
    `,
    [betsWon, betsLost, userId],
  );

  return (result.affectedRows || 0) === 1;
}
