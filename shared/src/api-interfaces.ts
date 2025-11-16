export interface ApiPriceData {
  ticker: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openAt: Date;
  closeAt: Date;
}

export interface ApiUser {
  createdAt: Date;
  score: number;
}

export interface ApiBetInfo {
  tickers: string[];
  nextResolveAt: Date;
}

export enum BetDirection {
  Long = "long",
  Short = "short",
}

export enum BetStatus {
  Open = "open",
  Won = "won",
  Lost = "lost",
}

export interface ApiBet {
  ticker: string;
  openedAt: Date;
  resolveAt: Date;
  direction: BetDirection;
  openPrice: number;
  resolutionPrice: number | null;
  status: BetStatus;
}
