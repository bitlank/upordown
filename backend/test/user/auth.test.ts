import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import * as userRepository from '../../src/user/user-repository.js';
import { getEnvOrThrow } from '../../src/utils.js';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction, Router } from 'express';
import express from 'express';
import request from 'supertest';

vi.mock('../../src/utils', () => ({
  getEnvOrThrow: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock('../../src/user/user-repository', () => ({
  createUser: vi.fn(),
  getUser: vi.fn(),
}));

const mockGetEnvOrThrow = getEnvOrThrow as vi.Mock;
const mockJwtSign = jwt.sign as vi.Mock;
const mockJwtVerify = jwt.verify as vi.Mock;
const mockCreateUser = userRepository.createUser as vi.Mock;
const mockGetUser = userRepository.getUser as vi.Mock;

describe('Auth', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('authMiddleware', () => {
    let authMiddleware: (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => void;

    beforeAll(async () => {
      mockGetEnvOrThrow.mockReturnValue('test-secret');

      const authModule = await import('../../src/user/auth.js');
      authMiddleware = authModule.authMiddleware;
    });

    it('should call next() if the token is valid', () => {
      const req = { headers: { cookie: 'token=valid-token' } } as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as NextFunction;
      mockJwtVerify.mockReturnValue({ userId: 123 });

      authMiddleware(req, res, next);

      expect(mockJwtVerify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect((req as any).userId).toBe(123);
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 if no token is provided', () => {
      const req = { headers: {} } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if the token is invalid', () => {
      const req = { headers: { cookie: 'token=invalid-token' } } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;
      mockJwtVerify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authController', () => {
    let app: express.Application;
    let authController: Router;

    beforeAll(async () => {
      mockGetEnvOrThrow.mockReturnValue('test-secret');

      const authModule = await import('../../src/user/auth.js');
      authController = authModule.authController;

      app = express();
      app.use('/auth', authController);
    });

    it('should return 200 and not create a new user if a valid token is present', async () => {
      const userId = 123;

      mockGetUser.mockResolvedValue({ id: userId });
      mockJwtVerify.mockReturnValue({ userId: userId });
      mockJwtSign.mockReturnValue('new-token');

      const response = await request(app)
        .post('/auth')
        .set('Cookie', 'token=old-token')
        .expect(200, { status: 'ok' });

      expect(mockJwtVerify).toHaveBeenCalledWith('old-token', 'test-secret');
      expect(mockGetUser).toHaveBeenCalledWith(userId);
      expect(mockCreateUser).not.toHaveBeenCalled();
      expect(response.headers['set-cookie'][0]).toContain('token=new-token');
    });

    it('should create a new user, set the token cookie, and return 200 if no token is present', async () => {
      const userId = 456;

      mockCreateUser.mockResolvedValue(userId);
      mockJwtSign.mockReturnValue('new-token');

      const response = await request(app)
        .post('/auth')
        .expect(200, { status: 'ok' });

      expect(mockCreateUser).toHaveBeenCalled();
      expect(mockJwtSign).toHaveBeenCalledWith(
        { userId: userId },
        'test-secret',
      );
      expect(response.headers['set-cookie'][0]).toContain('token=new-token');
    });

    it('should create a new user if the user does not exist', async () => {
      const oldUserId = 321;
      const newUserId = 654;

      mockGetUser.mockResolvedValue(null);
      mockCreateUser.mockResolvedValue(newUserId);

      mockJwtVerify.mockReturnValue({ userId: oldUserId });
      mockJwtSign.mockReturnValue('new-token');

      const response = await request(app)
        .post('/auth')
        .set('Cookie', 'token=old-token')
        .expect(200, { status: 'ok' });

      expect(mockJwtVerify).toHaveBeenCalledWith('old-token', 'test-secret');
      expect(mockGetUser).toHaveBeenCalledWith(oldUserId);
      expect(mockCreateUser).toHaveBeenCalled();
      expect(mockJwtSign).toHaveBeenCalledWith(
        { userId: newUserId },
        'test-secret',
      );
      expect(response.headers['set-cookie'][0]).toContain('token=new-token');
    });

    it('should ignore an invalid token, create a new user, and return 200', async () => {
      const userId = 789;

      mockJwtVerify.mockImplementationOnce(() => {
        throw new Error('JWT malformed');
      });
      mockJwtSign.mockReturnValue('new-token');
      mockCreateUser.mockResolvedValue(userId);

      const response = await request(app)
        .post('/auth')
        .set('Cookie', 'token=invalid-token')
        .expect(200, { status: 'ok' });

      expect(mockJwtVerify).toHaveBeenCalledWith(
        'invalid-token',
        'test-secret',
      );
      expect(mockCreateUser).toHaveBeenCalled();
      expect(response.headers['set-cookie'][0]).toContain('token=new-token');
    });

    it('should return 500 if user creation fails', async () => {
      const dbError = new Error('Database connection failed');
      mockCreateUser.mockRejectedValue(dbError);

      await request(app).post('/auth').expect(500);

      expect(mockCreateUser).toHaveBeenCalled();
    });
  });
});
