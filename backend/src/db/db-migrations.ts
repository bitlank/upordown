import dbConfig from './db-config.js';
import {
  Connection,
  ConnectionOptions,
  createConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';

const migrations = [
  `
    CREATE USER '${dbConfig.appUser}'@'%'
    IDENTIFIED BY '${dbConfig.appPassword}';
  `,
  `
    GRANT SELECT, INSERT, UPDATE, DELETE
    ON ${dbConfig.dbName}.*
    TO '${dbConfig.appUser}'@'%';
  `,
  `
    CREATE TABLE users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      created_at DATETIME NOT NULL,
      score INT NOT NULL
    );
  `,
  `
    CREATE TABLE bets (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      ticker VARCHAR(255) NOT NULL,
      opened_at DATETIME NOT NULL,
      resolve_at DATETIME NOT NULL,
      direction VARCHAR(10) NOT NULL,
      open_price DECIMAL(10, 4) NOT NULL,
      resolution_price DECIMAL(10, 4),
      status VARCHAR(10) NOT NULL,
      open BOOLEAN AS (IF(status = 'open', TRUE, NULL)),
      UNIQUE(user_id, ticker, open),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `,
  `
    CREATE INDEX idx_bets_user_status ON bets (user_id, status);
  `,
  `
    CREATE INDEX idx_bets_status_resolve_at ON bets (status, resolve_at);
  `,
];

async function setUpMigrationsTable(conn: Connection): Promise<boolean> {
  const [result] = await conn.execute<ResultSetHeader>(`
    CREATE TABLE IF NOT EXISTS schema_history (
      migration_id INT PRIMARY KEY,
      applied_at DATETIME NOT NULL
    )
  `);

  return (result.affectedRows || 0) > 0;
}

async function getLastMigrationId(conn: Connection): Promise<number> {
  const [[row]] = await conn.execute<RowDataPacket[]>(`
    SELECT MAX(migration_id) AS max_id
    FROM schema_history
  `);

  const id = row?.max_id ?? 0;
  return id;
}

async function applyMigration(conn: Connection, id: number): Promise<void> {
  await conn.execute(migrations[id - 1]);
  await conn.execute(
    `
    INSERT INTO schema_history (migration_id, applied_at)
    VALUES (?, ?)
  `,
    [id, new Date()],
  );
}

async function runMigrations(): Promise<void> {
  const options: ConnectionOptions = {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.rootUser,
    password: dbConfig.rootPassword,
    database: dbConfig.dbName,
  };

  let connection: Connection;
  try {
    connection = await createConnection(options);
  } catch (err) {
    throw new Error('Failed to connect to the DB', { cause: err });
  }

  try {
    console.log('Connected to the DB');

    try {
      if (await setUpMigrationsTable(connection)) {
        console.log('Migrations table created');
      }
    } catch (err) {
      throw new Error('Failed to create migrations table', { cause: err });
    }

    await connection.beginTransaction();
    let id = await getLastMigrationId(connection);

    if (id > migrations.length) {
      throw new Error(
        `Database schema version #${id} is higher than migrations.`,
      );
    }

    while (id < migrations.length) {
      id++;

      try {
        console.log(`Applying migration for database schema version #${id}`);
        await applyMigration(connection, id);
        await connection.commit();
        console.log(`Database schema migrated to version #${id}`);
      } catch (err) {
        throw new Error(`Failed to apply migration #${id}`, { cause: err });
      }

      await connection.beginTransaction();
      id = await getLastMigrationId(connection);
    }

    await connection.commit();
    console.log(`Database schema is up to date at version #${id}`);
  } finally {
    await connection.end();
  }
}

export default runMigrations;
