import { Router } from 'express';
import type { Request, Response } from 'express';
import PriceService from './price-service.js';

const router = Router();

router.get('/:ticker/current', async (req: Request, res: Response) => {
  const ticker = req.params.ticker;
  if (!ticker) {
    return res.status(400).json({ error: 'Ticker symbol is required' });
  }

  const priceData = await PriceService.getCurrentPrice(ticker.toUpperCase());
  res.json(priceData);
});

router.get('/:ticker/history', async (req: Request, res: Response) => {
  const { ticker } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 120;

  if (!ticker) {
    return res.status(400).json({ error: 'Ticker symbol is required' });
  }

  if (isNaN(limit) || !(limit >= 1 && limit <= 120)) {
    return res.status(400).json({ error: 'Limit must be between 1 and 120' });
  }

  const history = await PriceService.getHistoricalPrices(ticker.toUpperCase(), limit);
  res.json(history);
});

export default router;
