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
  createdAt: number;
  score: number;
}
