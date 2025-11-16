import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createUser,
  getUser,
  updateUserScore,
} from '../../src/user/user-repository.js';
import { getPool } from '../../src/db/db-pool.js';
import { ResultSetHeader } from 'mysql2';

vi.mock('../../src/db/db-pool', () => ({
  getPool: vi.fn(),
}));

const mockGetPool = getPool as vi.Mock;

describe('User Repository', () => {
  let mockExecute: vi.Mock;

  beforeEach(() => {
    mockExecute = vi.fn();
    mockGetPool.mockReturnValue({
      execute: mockExecute,
    });
    vi.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a user and return the insertId', async () => {
      const mockResult = {
        fieldCount: 0,
        affectedRows: 1,
        insertId: 123,
        info: '',
        serverStatus: 2,
        warningStatus: 0,
        changedRows: 0,
      } as ResultSetHeader;
      mockExecute.mockResolvedValue([mockResult]);

      const userId = await createUser();

      expect(userId).toBe(123);
    });
  });

  describe('getUser', () => {
    it('should return the user if user is found', async () => {
      const mockRow = { id: 1, created_at: Date.now(), score: 100 };
      mockExecute.mockResolvedValue([[mockRow]]);

      const user = await getUser(1);

      expect(user).not.toBeNull();
      expect(user?.id).toBe(mockRow.id);
      expect(user?.createdAt).toBe(mockRow.created_at);
      expect(user?.score).toBe(mockRow.score);
    });

    it('should return null if user is not found', async () => {
      mockExecute.mockResolvedValue([[]]);

      const score = await getUser(1);

      expect(score).toBe(null);
    });
  });

  describe('updateUserScore', () => {
    it('should return true if the score was updated', async () => {
      const mockResult = {
        fieldCount: 0,
        affectedRows: 1,
        insertId: 0,
        info: '',
        serverStatus: 2,
        warningStatus: 0,
        changedRows: 1,
      } as ResultSetHeader;
      mockExecute.mockResolvedValue([mockResult]);

      const result = await updateUserScore(1, 50);

      expect(result).toBe(true);
    });

    it('should return false if no rows were affected', async () => {
      const mockResult = {
        fieldCount: 0,
        affectedRows: 0,
        insertId: 0,
        info: '',
        serverStatus: 2,
        warningStatus: 0,
        changedRows: 0,
      } as ResultSetHeader;
      mockExecute.mockResolvedValue([mockResult]);

      const result = await updateUserScore(1, 50);

      expect(result).toBe(false);
    });
  });
});
