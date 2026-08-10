import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import type { Request, Response, NextFunction } from 'express'

const JWT_SECRET = process.env.JWT_SECRET || 'cadenza-local-dev-secret-change-me'

export interface JwtPayload {
  id: string
  email: string
  account_type: 'teacher' | 'student' | 'family'
  display_name: string
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10)
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash)
}

export function generateToken(user: JwtPayload): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '30d' })
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token' })
    return
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET) as JwtPayload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.account_type)) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    next()
  }
}
