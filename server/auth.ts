
import express from 'express';
import jwt from 'jsonwebtoken';
import { User } from './types';
import { Socket } from 'socket.io';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-for-avalon';

export const generateToken = (user: User): string => {
    return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
};

// Middleware for Express to protect routes
export const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7); // "Bearer ".length
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            // Attach user to request object
            (req as any).user = decoded;
            next();
        } catch (err) {
            return res.status(401).json({ message: 'Token is not valid' });
        }
    } else {
        return res.status(401).json({ message: 'Authorization header is required' });
    }
};

// Middleware for Socket.IO to authenticate connections
export const authMiddlewareSocket = (socket: Socket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('Authentication error: Token not provided.'));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Attach user to socket object
        (socket as any).user = decoded;
        next();
    } catch (err) {
        next(new Error('Authentication error: Invalid token.'));
    }
};
