const allowedOrigins = [
    'http://localhost:3000',
    'https://pavalononline.pramodhkrishna.dev',
    'https://localhost',
];

export const config = {
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    allowedOrigins,
    corsOptions: {
        origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
            if (origin && origin.endsWith('.vercel.app')) {
                return callback(null, true);
            }
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
    },
    game: {
        reconnectTimeout: 60_000,
        restartCooldown: 120_000,
        restartVoteDuration: 30_000,
    },
};
