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
