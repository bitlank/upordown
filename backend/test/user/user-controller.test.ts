import { describe, it, expect, vi, beforeEach } from 'vitest';
import userController from '../../src/user/user-controller.js';
import * as userRepository from '../../src/user/user-repository.js';
import * as betRepository from '../../src/bet/bet-repository.js';
import supertest from 'supertest';
import express from 'express';

const app = express();
app.use((req, res, next) => {
  req.userId = 1;
  next();
});
app.use('/user', userController);

vi.mock('../../src/utils', () => ({
  getEnvOrThrow: vi.fn(),
}));

vi.mock('../../src/user/user-repository', () => ({
  getUser: vi.fn(),
}));

vi.mock('../../src/bet/bet-repository', () => ({
  getBetStats: vi.fn(),
}));

const mockGetUser = userRepository.getUser as vi.Mock;
const mockGetBetStats = betRepository.getBetStats as vi.Mock;

describe('userController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /user', () => {
    it('should return user data', async () => {
      const user = { id: 1, score: 100, createdAt: Date.now() };
      mockGetUser.mockResolvedValue(user);
      const betStats = { open: 10, won: 5, lost: 3 };
      mockGetBetStats.mockResolvedValue(betStats);

      const response = await supertest(app).get('/user');

      expect(response.status).toBe(200);
      expect(response.body.score).toBe(user.score);
      expect(response.body.betsOpen).toBe(betStats.open);
      expect(response.body.betsWon).toBe(betStats.won);
      expect(response.body.betsLost).toBe(betStats.lost);
      expect(mockGetUser).toHaveBeenCalledWith(1);
      expect(mockGetBetStats).toHaveBeenCalledWith(1);
    });
  });
});
