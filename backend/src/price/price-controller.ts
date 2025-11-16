import { PriceData } from './types';
import PriceService from './price-service.js';
import { ApiPriceData } from '@shared/api-interfaces';
import { Router, Request, Response } from 'express';

function toApiPriceData(priceData: PriceData): ApiPriceData {
  return {
    ticker: priceData.ticker,
    open: priceData.open,
    high: priceData.high,
    low: priceData.low,
    close: priceData.close,
    volume: priceData.volume,
    openAt: new Date(priceData.openAt),
    closeAt: new Date(priceData.closeAt),
  };
}

async function routeGetPriceCurrent(req: Request, res: Response) {
  const ticker = req.params.ticker;
  if (!ticker) {
    return res.status(400).json({ error: 'Ticker symbol is required' });
  }

  const priceData = await PriceService.getPrice(ticker.toUpperCase());
  res.json(toApiPriceData(priceData));
}

async function routeGetPriceHistory(req: Request, res: Response) {
  const { ticker } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 120;

  if (!ticker) {
    return res.status(400).json({ error: 'Ticker symbol is required' });
  }

  if (isNaN(limit) || !(limit >= 1 && limit <= 120)) {
    return res.status(400).json({ error: 'Limit must be between 1 and 120' });
  }

  const history = await PriceService.getHistoricalPrices(
    ticker.toUpperCase(),
    limit,
  );
  res.json(history.map((priceData) => toApiPriceData(priceData)));
}

const priceController = Router();
priceController.get('/:ticker/current', routeGetPriceCurrent);
priceController.get('/:ticker/history', routeGetPriceHistory);
export default priceController;
