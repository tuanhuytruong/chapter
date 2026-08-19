import type { NextFunction, Request, Response } from "express";

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
    googleAuth?: { state: string; nonce: string; verifier: string; intent: "login" | "signup" | "link"; userId?: string; expiresAt: number };
  }
}

export interface AuthRequest extends Request {
  user: SessionUser;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  (req as AuthRequest).user = req.session.user;
  next();
}

export function userFrom(req: Request): SessionUser {
  return (req as AuthRequest).user;
}

export function requireOwner(req: Request, res: Response, ownerId: string | null): boolean {
  if (!ownerId || userFrom(req).id !== ownerId) {
    res.status(403).json({ error: "Only the owner may modify this resource" });
    return false;
  }
  return true;
}

export function avatarFor(username: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username)}`;
}
