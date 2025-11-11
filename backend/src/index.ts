import express from 'express';
import priceController from './controllers/price-controller.js';

const app = express();
const port = process.env.LISTEN_PORT || 3000;

// Add CORS headers for development
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Health check endpoint
app.get('/', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/price', priceController);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Oops!' });
});

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
