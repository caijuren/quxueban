import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../config/database';
import { AppError } from './errorHandler';

/**
 * Extended request interface with child context
 */
export interface ChildContextRequest extends AuthRequest {
  childContext?: {
    childId: number | null;
    isSelf: boolean;
  };
}

/**
 * Middleware to validate and set child context for requests
 * 
 * For child role: Forces childId to be the user's own ID
 * For parent role: Validates that the requested childId belongs to their family
 */
export async function validateChildAccess(
  req: ChildContextRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId, role, familyId } = req.user!;

    // Child role: Can only access their own data
    if (role === 'child') {
      req.childContext = { childId: userId, isSelf: true };
      return next();
    }

    // Parent role: Can access any child in their family
    // Get childId from query params or body
    const childIdFromQuery = req.query.childId;
    const childIdFromBody = req.body?.childId;
    const childIdParam = childIdFromQuery || childIdFromBody;

    if (childIdParam) {
      const childId = parseInt(childIdParam as string, 10);

      if (isNaN(childId)) {
        throw new AppError(400, 'Invalid childId format');
      }

      // Verify the child belongs to the parent's family
      const child = await prisma.user.findFirst({
        where: {
          id: childId,
          familyId,
          role: 'child',
          status: 'active',
        },
      });

      if (!child) {
        throw new AppError(403, '无权访问该孩子数据或孩子不存在');
      }

      req.childContext = { childId, isSelf: false };
    } else {
      // No childId specified - parent can access all children
      req.childContext = { childId: null, isSelf: false };
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require a specific childId in the request
 * Use this for endpoints that must operate on a specific child's data
 */
export function requireChildId(
  req: ChildContextRequest,
  _res: Response,
  next: NextFunction
): void {
  if (!req.childContext?.childId) {
    throw new AppError(400, 'Missing required parameter: childId');
  }
  next();
}

/**
 * Helper function to build Prisma where clause with child context
 */
export function buildChildWhereClause(
  familyId: number,
  childContext: { childId: number | null; isSelf: boolean },
  options: { allowAll?: boolean; tableAlias?: string } = {}
): Record<string, any> {
  const { allowAll = false, tableAlias } = options;
  const prefix = tableAlias ? `${tableAlias}.` : '';

  // Child can only see their own data
  if (childContext.isSelf) {
    return {
      [`${prefix}familyId`]: familyId,
      [`${prefix}childId`]: childContext.childId,
    };
  }

  // Parent specified a specific child
  if (childContext.childId) {
    return {
      [`${prefix}familyId`]: familyId,
      [`${prefix}childId`]: childContext.childId,
    };
  }

  // Parent viewing all children (only if allowed)
  if (allowAll) {
    return {
      [`${prefix}familyId`]: familyId,
    };
  }

  // Default: return no results for safety
  return {
    [`${prefix}familyId`]: familyId,
    [`${prefix}childId`]: -1, // Impossible condition
  };
}
