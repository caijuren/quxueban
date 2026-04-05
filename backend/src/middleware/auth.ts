import { Request, Response, NextFunction } from 'express'
// @ts-ignore - jsonwebtoken types are complex
import * as jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { AppError } from './errorHandler'

// Extend Express Request type to include user info
export interface AuthRequest extends Request {
  user?: {
    userId: number
    role: string
    familyId: number
    name: string
    avatar: string
  }
}

/**
 * JWT Authentication Middleware
 * Extracts token from Authorization header (Bearer token)
 * Verifies token and attaches user info to request
 */
export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'No token provided. Please log in.')
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: number
      name: string
      role: string
      familyId: number
      avatar: string
    }

    // Attach user info to request
    (req as AuthRequest).user = {
      userId: decoded.id,
      role: decoded.role,
      familyId: decoded.familyId,
      name: decoded.name,
      avatar: decoded.avatar,
    }

    next()
  } catch {
    throw new AppError(401, 'Invalid or expired token. Please log in again.')
  }
}

/**
 * Role-based Access Control Middleware
 * Restricts access to specific user roles
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest

    if (!authReq.user) {
      throw new AppError(401, 'Authentication required')
    }

    if (!allowedRoles.includes(authReq.user.role)) {
      throw new AppError(403, 'You do not have permission to perform this action')
    }

    next()
  }
}

/**
 * Optional auth middleware - attaches user if token present but doesn't require it
 */
export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next()
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: number
      name: string
      role: string
      familyId: number
      avatar: string
    }

    (req as AuthRequest).user = {
      userId: decoded.id,
      role: decoded.role,
      familyId: decoded.familyId,
      name: decoded.name,
      avatar: decoded.avatar,
    }
  } catch {
    // Token invalid, but continue without user
  }

  next()
}

/**
 * Generate JWT token for user
 */
export const generateToken = (payload: {
  id: number
  name: string
  role: string
  familyId: number
  avatar: string
}): string => {
  // @ts-ignore - jsonwebtoken types are complex for expiresIn
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN })
}
