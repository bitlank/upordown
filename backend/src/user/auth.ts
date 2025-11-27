import { getEnvOrThrow } from '../utils.js';
import { createUser, getUser } from './user-repository.js';
import { asyncHandler } from '../async-handler.js';
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

async function findOrCreateUser(id: number | null): Promise<number> {
  let userId = id;
  if (userId) {
    if (await getUser(userId)) {
      return userId;
    }
    console.log(`Cannot find user #${userId}, creating new`);
  }

  userId = await createUser();
  console.log(`User #${userId} created`);
  return userId;
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

  req.userId = userId;
  next();
}

async function routePostUserLogin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let userId = parseAndVerifyToken(req.headers.cookie);

  try {
    userId = await findOrCreateUser(userId);
  } catch (err) {
    return res.status(500).send({ error: 'Failed to get or create user' });
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

const authController = Router();
authController.post('/', asyncHandler(routePostUserLogin));
export default authController;
