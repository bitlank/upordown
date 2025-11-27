import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.error('Error:', err);

  if (process.env.NODE_ENV !== 'development') {
    return res.status(500);
  }

  const errorResponse = {
    message: err.message || 'Internal Server Error',
    stack: err.stack,
  };

  return res.status(500).json(errorResponse);
}
