import express from 'express';
import morgan from 'morgan';
import priceController from './price/price-controller.js';
import betController from './bet/bet-controller.js';
import { userController } from './user/user-controller.js';
import { authController, authMiddleware } from './user/auth.js';
import runMigrations from './db/db-migrations.js';
import { initializePool } from './db/db-pool.js';
import betService from './bet/bet-service.js';

await runMigrations();
await initializePool();
betService.start();

const app = express();
const port = process.env.LISTEN_PORT || 3000;

app.use(morgan('tiny'));

// Add CORS headers for development
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept',
  );
  next();
});

app.get('*', (_req, res, next) => {
  // Cache GET responses for max 1 second
  res.setHeader('Cache-Control', 'public, max-age=1, must-revalidate');
  next();
});

// Health check endpoint
app.get('/', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authController);
app.use('/price', authMiddleware, priceController);
app.use('/bet', authMiddleware, betController);
app.use('/user', authMiddleware, userController);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Oops!' });
  },
);

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
