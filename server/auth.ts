import jwt from 'jsonwebtoken';
import { User } from './types';
import { Socket } from 'socket.io';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-for-avalon';

export const generateToken = (user: User): string => {
    return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
};

// Middleware for Express
export const authMiddleware = (req: any, res: any, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7, authHeader.length);
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            next();
        } catch (err) {
            return res.status(401).json({ message: 'Token is not valid' });
        }
    } else {
        return res.status(401).json({ message: 'Authorization header required' });
    }
};

// Middleware for Socket.IO
export const authMiddlewareSocket = (socket: Socket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error: Token not provided.'));
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        (socket as any).user = decoded;
        next();
    } catch (err) {
        next(new Error('Authentication error: Invalid token.'));
    }
};