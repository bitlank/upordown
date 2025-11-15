import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUser } from '../../src/user/user-repository.js';
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
});
