declare namespace Express {
  interface Request {
    userId: number;
    ticker?: string;
  }
}
