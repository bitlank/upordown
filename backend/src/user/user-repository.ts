import { User } from './types';
import { getPool } from '../db/db-pool';
import { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export async function createUser(connection?: Connection): Promise<number> {
  const conn = connection ? connection : getPool();
  const [result] = await conn.execute<ResultSetHeader>(
    `
      INSERT INTO users (created_at, score)
      VALUES (?, ?)
    `,
    [new Date(), 0],
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
    score: Number(row.score),
  };
}

export async function updateUserScore(
  userId: number,
  amount: number,
  connection?: Connection,
): Promise<boolean> {
  const conn = connection ? connection : getPool();
  const [result] = await conn.execute<ResultSetHeader>(
    `
      UPDATE users
      SET score = score + ?
      WHERE id = ?
    `,
    [amount, userId],
  );

  return (result.affectedRows || 0) === 1;
}
