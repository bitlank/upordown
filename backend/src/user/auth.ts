import { getEnvOrThrow } from '../utils.js';
import { createUser, getUser } from './user-repository.js';
import jwt from 'jsonwebtoken';
import {
  CookieOptions,
  NextFunction,
  Request,
  Response,
  Router,
} from 'express';

const jwtSecret = getEnvOrThrow('JWT_SECRET');

export function generateToken(userId: number): string {
  const payload = { userId };
  const token = jwt.sign(payload, jwtSecret);
  return token;
}

function verifyToken(token: string): number {
  try {
    const decoded = jwt.verify(token, jwtSecret) as { userId: number };
    return Number(decoded.userId);
  } catch (error) {
    throw new Error('Invalid token', { cause: error });
  }
}

function parseTokenFromCookie(cookieHeader?: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const token: string | undefined = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith('token='))
    .map((cookie) => cookie.split('=')[1])[0];

  return token || null;
}

function parseAndVerifyToken(cookieHeader?: string): number | null {
  const token = parseTokenFromCookie(cookieHeader);
  if (!token) {
    console.log('No token cookie found');
    return null;
  }

  try {
    const userId = verifyToken(token);
    return userId;
  } catch (err) {
    console.error('Token verification failed: ', err);
    return null;
  }
}

async function createNewUser(): Promise<number | null> {
  let userId: number | null = null;
  try {
    userId = await createUser();
    return userId;
  } catch (err) {
    console.error('Error creating new user:', err);
    return null;
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userId = parseAndVerifyToken(req.headers.cookie);
  if (userId === null) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  (req as any).userId = userId;
  next();
}

async function routePostUserLogin(req: Request, res: Response) {
  let userId = parseAndVerifyToken(req.headers.cookie);
  if (userId) {
    if (!await getUser(userId)) {
      console.error(`Cannot find user #${userId}, creating new`)
      userId = null;
    }
  }
  if (!userId) {
    userId = await createNewUser();
    if (!userId) {
      return res.status(500).send({ error: 'Failed to create new user' });
    }
    console.log(`User #${userId} created`);
  }

  const token = generateToken(userId);

  const oneYearInTheFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const cookieOptions: CookieOptions = {
    expires: oneYearInTheFuture,
    httpOnly: true,
    //secure: true,
    sameSite: 'strict',
  };
  res.cookie('token', token, cookieOptions);

  res.status(200).send({ status: 'ok' });
}

export const authController = Router();
authController.post('/', routePostUserLogin);
