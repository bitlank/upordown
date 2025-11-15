export interface PriceData {
  ticker: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openTime: number;
  closeTime: number;
}

export interface ApiUser {
  createdAt: number;
  score: number;
}
