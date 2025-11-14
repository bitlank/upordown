import { getEnvOrThrow } from '../utils.js';

const dbConfig = {
  host: getEnvOrThrow('DB_HOST'),
  port: Number(getEnvOrThrow('DB_PORT')),
  rootUser: getEnvOrThrow('DB_ROOT_USER'),
  rootPassword: getEnvOrThrow('DB_ROOT_PASSWORD'),
  appUser: getEnvOrThrow('DB_APP_USER'),
  appPassword: getEnvOrThrow('DB_APP_PASSWORD'),
  dbName: getEnvOrThrow('DB_NAME'),
} as const;

export default dbConfig;
