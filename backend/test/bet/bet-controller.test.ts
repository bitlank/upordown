import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import betController from '../../src/bet/bet-controller.js';
import * as betService from '../../src/bet/bet-service.js';
import * as betRepository from '../../src/bet/bet-repository.js';
import { BetDirection, BetStatus } from '@shared/api-interfaces.js';
import { Request, Response, NextFunction } from 'express';

const app = express();
app.use((req: Request, res: Response, next: NextFunction) => {
  req.userId = 1;
  next();
});
app.use('/bet', betController);

vi.mock('../../src/bet/bet-service', () => ({
  getBetInfo: vi.fn(),
  isTickerSupported: vi.fn(),
  placeBet: vi.fn(),
}));

vi.mock('../../src/bet/bet-repository', () => ({
  findBets: vi.fn(),
}));

const mockGetBetInfo = betService.getBetInfo as vi.Mock;
const mockIsTickerSupported = betService.isTickerSupported as vi.Mock;
const mockPlaceBet = betService.placeBet as vi.Mock;
const mockFindBets = betRepository.findBets as vi.Mock;

describe('betController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /bet/info', () => {
    it('should return bet info', async () => {
      const betInfo = {
        tickers: [{ ticker: 'BTCUSDT', name: 'Bitcoin' }],
        betDeadline: 123456789,
        resolveAt: 987654321,
      };
      mockGetBetInfo.mockReturnValue(betInfo);

      const response = await supertest(app).get('/bet/info');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(betInfo);
      expect(mockGetBetInfo).toHaveBeenCalled();
    });
  });

  describe('GET /bet/open', () => {
    it('should return open bets', async () => {
      const bets = [
        {
          id: 1,
          ticker: 'BTCUSDT',
          openedAt: 123,
          resolveAt: 456,
          direction: BetDirection.Long,
          openPrice: 50000,
          resolutionPrice: null,
          status: BetStatus.Open,
          userId: 1,
        },
      ];
      mockFindBets.mockResolvedValue(bets);

      const response = await supertest(app).get('/bet/open');

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].ticker).toBe('BTCUSDT');
      expect(mockFindBets).toHaveBeenCalledWith({
        userId: 1,
        status: [BetStatus.Open],
      });
    });
  });

  describe('POST /bet/:ticker/:direction', () => {
    it('should place a bet', async () => {
      const bet = {
        id: 1,
        ticker: 'BTCUSDT',
        openedAt: 123,
        resolveAt: 456,
        direction: BetDirection.Long,
        openPrice: 50000,
        resolutionPrice: null,
        status: BetStatus.Open,
        userId: 1,
      };
      mockIsTickerSupported.mockReturnValue(true);
      mockPlaceBet.mockResolvedValue(bet);

      const response = await supertest(app)
        .post('/bet/BTCUSDT/long')
        .expect(201);

      expect(response.body.ticker).toBe('BTCUSDT');
      expect(mockPlaceBet).toHaveBeenCalledWith(
        1,
        'BTCUSDT',
        BetDirection.Long,
      );
    });

    it('should return 400 for invalid direction', async () => {
      await supertest(app).post('/bet/BTCUSDT/invalid').expect(400);
    });

    it('should return 400 for unsupported ticker', async () => {
      mockIsTickerSupported.mockReturnValue(false);
      await supertest(app).post('/bet/UNSUPPORTED/long').expect(400);
    });

    it('should return 400 when placeBet throws', async () => {
      mockIsTickerSupported.mockReturnValue(true);
      mockPlaceBet.mockRejectedValue(new Error('Invalid bet'));
      await supertest(app).post('/bet/BTCUSDT/long').expect(400);
    });
  });
});
