import { PriceData } from './types';
import PriceService, { PRICE_MAX_AGE_MINUTES } from './price-service.js';
import { isTickerSupported } from '../bet/bet-service.js';
import { asyncHandler } from '../async-handler.js';
import { ApiPriceData } from '../shared/api-interfaces.js';
import { Router, Request, Response, NextFunction } from 'express';

function toApiPriceData(priceData: PriceData): ApiPriceData {
  return {
    ticker: priceData.ticker,
    open: priceData.open,
    high: priceData.high,
    low: priceData.low,
    close: priceData.close,
    volume: priceData.volume,
    openAt: priceData.openAt,
    closeAt: priceData.closeAt,
  };
}

async function getTicker(req: Request, res: Response, next: NextFunction) {
  const ticker = req.params.ticker?.toUpperCase();
  if (!ticker) {
    return res.status(400).json({ error: 'Ticker symbol is required' });
  }
  if (!isTickerSupported(ticker)) {
    return res.status(400).json({ error: 'Unsupported ticker' });
  }

  req.ticker = ticker;

  next();
}

async function routeGetPriceCurrent(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const ticker = req.ticker as string;

  try {
    const priceData = await PriceService.getPrice(ticker);
    res.json(toApiPriceData(priceData));
  } catch (err) {
    console.error(`Error fetching price for ${ticker}`, err);
    return res.status(500).json({ error: 'Failed to fetch price' });
  }
}

async function routeGetPriceRecent(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const ticker = req.ticker as string;

  const startAtParam = req.params.startAt;
  const startAt = startAtParam ? parseInt(startAtParam as string) : null;

  if (!startAt || isNaN(startAt)) {
    return res.status(400).json({ error: 'Invalid start at value' });
  }
  const startSince = Date.now() - startAt;
  if (startSince < 0 || startSince > PRICE_MAX_AGE_MINUTES * 60 * 1000) {
    return res.status(400).json({
      error: `Start at must fall within the last ${PRICE_MAX_AGE_MINUTES} minutes`,
    });
  }

  try {
    const history = await PriceService.getRecentPrices(ticker, startAt);
    res.json(history.map((priceData) => toApiPriceData(priceData)));
  } catch (err) {
    console.error(`Error fetching price history for ${ticker}`, err);
    return res.status(500).json({ error: 'Failed to fetch price history' });
  }
}

const priceController = Router();
priceController.get(
  '/:ticker/current',
  getTicker,
  asyncHandler(routeGetPriceCurrent),
);
priceController.get(
  '/:ticker/recent/:startAt',
  getTicker,
  asyncHandler(routeGetPriceRecent),
);

export default priceController;
