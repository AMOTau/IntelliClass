import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

if (!env.jwtSecret) {
  throw new Error('JWT_SECRET is not set. Add it to server/.env before starting the API.');
}

export function signAuthToken(payload) {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

export function verifyAuthToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
