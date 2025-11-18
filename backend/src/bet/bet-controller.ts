import { Bet } from './types';
import { getBetInfo, placeBet } from './bet-service.js';
import { findBets } from './bet-repository.js';
import { parseEnum } from '../utils.js';
import { asyncWrapper } from '../request-wrapper.js';
import { ApiBet, BetDirection, BetStatus } from '@shared/api-interfaces.js';
import { Router, Request, Response, NextFunction } from 'express';

function toApiBet(bet: Bet): ApiBet {
  return {
    ticker: bet.ticker,
    openedAt: bet.openedAt,
    resolveAt: bet.resolveAt,
    direction: bet.direction,
    openPrice: bet.openPrice,
    resolutionPrice: bet.resolutionPrice,
    status: bet.status,
  };
}

async function routeGetBetInfo(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const info = getBetInfo();

  res.send(info);
}

async function routeGetOpenBets(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const bets = await findBets({
    userId: (req as any).userId,
    status: [BetStatus.Open],
  });
  const apiBets = bets.map((bet) => toApiBet(bet));

  res.send(apiBets);
}

async function routePostPlaceBet(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const ticker = req.params['ticker'];
  const direction = parseEnum(BetDirection, req.params['direction']);
  if (!direction) {
    return res.status(400).send({ error: 'Invalid direction' });
  }

  try {
    const bet = await placeBet(req.userId, ticker, direction);
    return res.status(201).send(toApiBet(bet));
  } catch (err) {
    console.error(`Error placing bet for user #${req.userId}`, err);
    return res.status(400).send({ error: 'Invalid bet' });
  }
}

const betController = Router();
betController.get('/info', asyncWrapper(routeGetBetInfo));
betController.get('/open', asyncWrapper(routeGetOpenBets));
betController.post('/:ticker/:direction', asyncWrapper(routePostPlaceBet));
export default betController;
