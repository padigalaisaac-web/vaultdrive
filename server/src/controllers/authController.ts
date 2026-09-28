import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/dbAdapter.js';
import { hashPassword, comparePassword, generateToken } from '../utils/crypto.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { User } from '../types/index.js';
import { config } from '../config/env.js';

export const register = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await db.query<User>('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      res.status(409).json({
        success: false,
        message: 'A user with this email address already exists.'
      });
      return;
    }

    const passwordHash = await hashPassword(password);
    const userId = uuidv4();
    const defaultQuota = config.defaultUserQuotaBytes;

    await db.query(
      `INSERT INTO users (id, email, name, password_hash, storage_quota, used_storage)
       VALUES ($1, $2, $3, $4, $5, 0)`,
      [userId, normalizedEmail, name.trim(), passwordHash, defaultQuota]
    );

    const token = generateToken({ userId, email: normalizedEmail });

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: {
        id: userId,
        email: normalizedEmail,
        name: name.trim(),
        storage_quota: defaultQuota,
        used_storage: 0
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed.'
    });
  }
};

export const login = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const userRes = await db.query<User>('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    if (userRes.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
      return;
    }

    const user = userRes.rows[0];
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
      return;
    }

    const token = generateToken({ userId: user.id, email: user.email });

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        storage_quota: Number(user.storage_quota),
        used_storage: Number(user.used_storage)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Login failed.'
    });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  res.status(200).json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      storage_quota: Number(req.user.storage_quota),
      used_storage: Number(req.user.used_storage),
      created_at: req.user.created_at
    }
  });
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { name } = req.body;
    if (!name || name.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Name is required' });
      return;
    }

    await db.query('UPDATE users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      name.trim(),
      req.user.id
    ]);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: req.user.id,
        email: req.user.email,
        name: name.trim()
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Current password and a new password (min 6 chars) are required.'
      });
      return;
    }

    const isMatch = await comparePassword(currentPassword, req.user.password_hash);
    if (!isMatch) {
      res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      return;
    }

    const newHash = await hashPassword(newPassword);
    await db.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      newHash,
      req.user.id
    ]);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
