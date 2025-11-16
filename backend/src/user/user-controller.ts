import { User } from './types';
import { getUser } from './user-repository';
import { ApiUser } from '@shared/api-interfaces';
import { Request, Response, Router } from 'express';

export const userRouter = Router();

function toApiUser(user: User): ApiUser {
  return {
    createdAt: user.createdAt,
    score: user.score,
  };
}

async function routeGetUser(req: Request, res: Response) {
  const userId = req.userId;
  const user = await getUser(userId);
  if (!user) {
    console.log(`Cannot find user #${userId}`);
    return res.status(404).send({ error: 'User not found' });
  }
  res.status(200).send(toApiUser(user));
}

export const userController = Router();
userController.get('/', routeGetUser);
