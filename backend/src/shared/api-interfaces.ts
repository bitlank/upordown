export interface ApiPriceData {
  ticker: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openAt: number;
  closeAt: number;
}

export interface ApiUser {
  createdAt: number;
  score: number;
  betsOpen: number;
  betsWon: number;
  betsLost: number;
}

export interface ApiTickerInfo {
  ticker: string;
  displayName: string;
}

export interface ApiBetInfo {
  tickers: ApiTickerInfo[];
  betDeadline: number;
  resolveAt: number;
}

export enum BetDirection {
  Long = 'long',
  Short = 'short',
}

export enum BetStatus {
  Open = 'open',
  Won = 'won',
  Lost = 'lost',
}

export interface ApiBet {
  ticker: string;
  openedAt: number;
  resolveAt: number;
  direction: BetDirection;
  openPrice: number;
  resolutionPrice: number | null;
  status: BetStatus;
}
