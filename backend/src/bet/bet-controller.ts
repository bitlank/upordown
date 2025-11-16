import { Bet } from './types';
import { getBetInfo, placeBet } from './bet-service.js';
import { getBets } from './bet-repository.js';
import { ApiBet, BetDirection, BetStatus } from '@shared/api-interfaces';
import { Router, Request, Response } from 'express';
import { parseEnum } from 'src/utils';

function toApiBet(bet: Bet): ApiBet {
  return {
    ticker: bet.ticker,
    openedAt: new Date(bet.openedAt),
    resolveAt: new Date(bet.resolveAt),
    direction: bet.direction,
    openPrice: bet.openPrice,
    resolutionPrice: bet.resolutionPrice,
    status: bet.status,
  };
}

async function routeGetBetInfo(req: Request, res: Response) {
  const info = getBetInfo();
  res.send(info);
}

async function routeGetOpenBets(req: Request, res: Response) {
  const bets = await getBets({
    userId: (req as any).userId,
    status: [BetStatus.Open],
  });
  const apiBets: ApiBet[] = bets.map((bet) => toApiBet(bet));
  res.send(apiBets);
}

async function routePostPlaceBet(req: Request, res: Response) {
  const ticker = req.params['ticker'];
  const direction = parseEnum(BetDirection, req.params['direction']);
  if (!direction) {
    return res.status(400).send({ error: 'Invalid direction' });
  }

  try {
    await placeBet(req.userId, ticker, direction);
  } catch (err) {
    console.error(`Error placing bet for user #${req.userId}`, err);
    return res.status(400).send({ error: 'Invalid bet' });
  }

  res.status(201).send();
}

const betController = Router();
betController.get('/info', routeGetBetInfo);
betController.get('/open', routeGetOpenBets);
betController.post('/:ticker/:direction', routePostPlaceBet);
export default betController;
