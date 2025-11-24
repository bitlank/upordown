import { describe, it, expect, vi, beforeEach } from 'vitest';
import resolveBets from '../../src/bet/bet-resolution.js';
import * as betConfig from '../../src/bet/bet-config.js';
import * as betRepository from '../../src/bet/bet-repository.js';
import { getPool } from '../../src/db/db-pool.js';
import priceService, { PRICE_INTERVAL } from '../../src/price/price-service.js';
import * as userRepository from '../../src/user/user-repository.js';
import { BetDirection, BetStatus } from '@shared/api-interfaces.js';
import { Bet } from '../../src/bet/types.js';

vi.mock('../../src/bet/bet-config', () => ({
  getResolutionTime: vi.fn(),
}));

vi.mock('../../src/bet/bet-repository', () => ({
  updateBet: vi.fn(),
  findBets: vi.fn(),
}));

vi.mock('../../src/db/db-pool', () => ({
  getPool: vi.fn(() => ({
    getConnection: vi.fn(() => ({
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      release: vi.fn(),
    })),
  })),
}));

vi.mock('../../src/price/price-service', () => ({
  PRICE_INTERVAL: 1000,
  default: {
    getPrice: vi.fn(),
  },
}));

vi.mock('../../src/user/user-repository', () => ({
  updateUserScore: vi.fn(),
}));

const mockGetResolutionTime = betConfig.getResolutionTime as vi.Mock;
const mockUpdateBet = betRepository.updateBet as vi.Mock;
const mockFindBets = betRepository.findBets as vi.Mock;
const mockGetPrice = priceService.getPrice as vi.Mock;
const mockUpdateUserScore = userRepository.updateUserScore as vi.Mock;
const mockGetPool = getPool as vi.Mock;

describe('bet-resolution', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mockGetPool.mockReturnValue({
      getConnection: vi.fn(() => ({
        beginTransaction: vi.fn(),
        commit: vi.fn(),
        release: vi.fn(),
      })),
    });

    mockGetPrice.mockImplementation((ticker, openAt) => {
      if (ticker === 'BTCUSDT' && openAt === 179000) {
        return { close: 1100 };
      }
      if (ticker === 'ETHUSDT' && openAt === 179000) {
        return { close: 150 };
      }
      if (ticker === 'BTCUSDT' && openAt === 239000) {
        return { close: 1050 };
      }
      return null;
    });
  });

  describe('resolveBets', () => {
    const mockBet1: Bet = {
      id: 1,
      ticker: 'BTCUSDT',
      openedAt: 120000,
      resolveAt: 180000,
      direction: BetDirection.Long,
      openPrice: 1000,
      resolutionPrice: null,
      status: BetStatus.Open,
      userId: 1,
    };
    const mockBet2: Bet = {
      id: 2,
      ticker: 'ETHUSDT',
      openedAt: 120000,
      resolveAt: 180000,
      direction: BetDirection.Short,
      openPrice: 200,
      resolutionPrice: null,
      status: BetStatus.Open,
      userId: 2,
    };
    const mockBet3: Bet = {
      id: 3,
      ticker: 'BTCUSDT',
      openedAt: 180000,
      resolveAt: 240000,
      direction: BetDirection.Long,
      openPrice: 1100,
      resolutionPrice: null,
      status: BetStatus.Open,
      userId: 3,
    };

    it('should resolve multiple bets grouped by ticker and resolution time', async () => {
      mockGetResolutionTime.mockReturnValueOnce(240000);
      mockFindBets.mockResolvedValueOnce([mockBet1, mockBet2, mockBet3]);

      mockUpdateBet.mockResolvedValue(true);
      mockUpdateUserScore.mockResolvedValue(true);

      await resolveBets();

      expect(mockGetResolutionTime).toHaveBeenCalledWith(-1);
      expect(mockFindBets).toHaveBeenCalledWith({
        status: [BetStatus.Open],
        resolveAtMax: 240000,
      });

      const updateBetCalls = new Map(
        mockUpdateBet.mock.calls.map((call) => [call[0], call]),
      );
      const updateScoreCalls = new Map(
        mockUpdateUserScore.mock.calls.map((call) => [call[0], call]),
      );

      expect(updateBetCalls.get(mockBet1.id)).toEqual([
        mockBet1.id,
        BetStatus.Open,
        BetStatus.Won,
        1100,
        expect.anything(),
      ]);
      expect(updateScoreCalls.get(mockBet1.userId)).toEqual([
        mockBet1.userId,
        1,
        expect.anything(),
      ]);

      expect(updateBetCalls.get(mockBet2.id)).toEqual([
        mockBet2.id,
        BetStatus.Open,
        BetStatus.Won,
        150,
        expect.anything(),
      ]);
      expect(updateScoreCalls.get(mockBet2.userId)).toEqual([
        mockBet2.userId,
        1,
        expect.anything(),
      ]);

      expect(updateBetCalls.get(mockBet3.id)).toEqual([
        mockBet3.id,
        BetStatus.Open,
        BetStatus.Lost,
        1050,
        expect.anything(),
      ]);
      expect(updateScoreCalls.get(mockBet3.userId)).toEqual([
        mockBet3.userId,
        -1,
        expect.anything(),
      ]);
    });
  });
});
