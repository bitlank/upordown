import { BetDirection, BetStatus } from '../shared/api-interfaces';

export interface Bet {
  id: number;
  userId: number;
  ticker: string;
  openedAt: number;
  resolveAt: number;
  direction: BetDirection;
  openPrice: number;
  resolutionPrice: number | null;
  status: BetStatus;
}
