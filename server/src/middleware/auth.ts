import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/crypto.js';
import { db } from '../db/dbAdapter.js';
import { User } from '../types/index.js';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token && typeof req.query.token === 'string') {
      // Useful for direct stream / preview tags like <video src="..."/>
      token = req.query.token;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication token is required.'
      });
      return;
    }

    const payload = verifyToken(token);
    const userRes = await db.query<User>('SELECT * FROM users WHERE id = $1', [payload.userId]);

    if (!userRes.rows || userRes.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Invalid session or user not found.'
      });
      return;
    }

    req.user = userRes.rows[0];
    next();
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.'
    });
  }
};
