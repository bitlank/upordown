import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userController } from '../../src/user/user-controller.js';
import * as userRepository from '../../src/user/user-repository.js';
import supertest from 'supertest';
import express from 'express';

const app = express();
app.use((req, res, next) => {
  req.userId = 1;
  next();
});
app.use('/user', userController);

vi.mock('../../src/user/user-repository', () => ({
  getUser: vi.fn(),
}));

const mockGetUser = userRepository.getUser as vi.Mock;

describe('userController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /user', () => {
    it('should return user data', async () => {
      const user = { id: 1, score: 100, createdAt: Date.now() };
      mockGetUser.mockResolvedValue(user);

      const response = await supertest(app).get('/user');

      expect(response.status).toBe(200);
      expect(response.body.score).toBe(user.score);
      expect(mockGetUser).toHaveBeenCalledWith(1);
    });
  });
});
