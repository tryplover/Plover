import { Request, Response, NextFunction } from 'express';

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authToken = process.env.AUTH_TOKEN;
  if (authToken) {
    const clientToken = req.headers['x-plover-auth-token'];
    if (clientToken !== authToken) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }
  next();
};
