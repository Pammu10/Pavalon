import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
    logger.error('Unhandled request error', { message: err.message, path: req.path, method: req.method });
    res.status(500).json({ message: 'Internal server error.' });
}
