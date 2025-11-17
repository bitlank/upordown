import { PriceData } from './types';
import PriceService from './price-service.js';
import { ApiPriceData } from '@shared/api-interfaces';
import { Router, Request, Response } from 'express';
import { SUPPORTED_TICKERS } from 'src/bet/bet-service';

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
  if (startSince < 0 || startSince > 2 * 60 * 1000) {
    return res
      .status(400)
      .json({ error: 'Start at must fall within the last 2 minutes' });
  }

  const history = await PriceService.getRecentPrices(ticker, startAt);
  res.json(history.map((priceData) => toApiPriceData(priceData)));
}

const priceController = Router();
priceController.get('/:ticker/current', routeGetPriceCurrent);
priceController.get('/:ticker/recent/:startAt', routeGetPriceRecent);
export default priceController;
