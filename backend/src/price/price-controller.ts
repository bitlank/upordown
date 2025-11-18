import { PriceData } from './types';
import PriceService, { PRICE_MAX_AGE_MINUTES } from './price-service.js';
import { SUPPORTED_TICKERS } from '../bet/bet-service.js';
import { ApiPriceData } from '@shared/api-interfaces.js';
import { Router, Request, Response } from 'express';

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

async function routeGetPriceCurrent(req: Request, res: Response) {
  const ticker = req.params.ticker;
  if (!ticker) {
    return res.status(400).json({ error: 'Ticker symbol is required' });
  }

  if (!SUPPORTED_TICKERS.includes(ticker)) {
    return res.status(400).json({ error: 'Unsupported ticker' });
  }

  const priceData = await PriceService.getPrice(ticker.toUpperCase());
  res.json(toApiPriceData(priceData));
}

async function routeGetPriceRecent(req: Request, res: Response) {
  const tickerParam = req.params.ticker;
  const ticker = tickerParam ? tickerParam.toUpperCase() : null;

  if (!ticker) {
    return res.status(400).json({ error: 'Ticker symbol is required' });
  }
  if (!SUPPORTED_TICKERS.includes(ticker)) {
    return res.status(400).json({ error: 'Unsupported ticker' });
  }

  const startAtParam = req.params.startAt;
  const startAt = startAtParam ? parseInt(startAtParam as string) : null;

  if (!startAt || isNaN(startAt)) {
    return res.status(400).json({ error: 'Invalid start at value' });
  }
  const startSince = Date.now() - startAt;
  if (startSince < 0 || startSince > PRICE_MAX_AGE_MINUTES * 60 * 1000) {
    return res
      .status(400)
      .json({ error: `Start at must fall within the last ${PRICE_MAX_AGE_MINUTES} minutes`});
  }

  const history = await PriceService.getRecentPrices(ticker, startAt);
  res.json(history.map((priceData) => toApiPriceData(priceData)));
}

const priceController = Router();
priceController.get('/:ticker/current', routeGetPriceCurrent);
priceController.get('/:ticker/recent/:startAt', routeGetPriceRecent);
export default priceController;
