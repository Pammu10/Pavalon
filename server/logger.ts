const isProd = process.env.NODE_ENV === 'production';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';
type LogData = Record<string, unknown>;

function log(level: LogLevel, message: string, data?: LogData): void {
    if (isProd) {
        const output = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...data });
        level === 'error' ? console.error(output) : console.log(output);
    } else {
        const prefix = `[${level.toUpperCase()}]`;
        if (data !== undefined) {
            console.log(prefix, message, data);
        } else {
            console.log(prefix, message);
        }
    }
}

export const logger = {
    info: (message: string, data?: LogData) => log('info', message, data),
    warn: (message: string, data?: LogData) => log('warn', message, data),
    error: (message: string, data?: LogData) => log('error', message, data),
    debug: (message: string, data?: LogData) => log('debug', message, data),
};
