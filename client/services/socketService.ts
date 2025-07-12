

import { io, Socket } from "socket.io-client";
import { ServerToClientEvents, ClientToServerEvents } from '@/types';

// Use a Next.js public environment variable
const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";

class SocketService {
    public socket: Socket<ServerToClientEvents, ClientToServerEvents>;

    constructor() {
        this.socket = io(SERVER_URL, {
            autoConnect: false, // Wait for auth before connecting
            transports: ['websocket'],
        });
        console.log("Socket Service Initialized");

        this.socket.on('connect', () => {
            console.log("Connected to server with ID:", this.socket.id);
        });

        this.socket.on('disconnect', () => {
            console.log("Disconnected from server");
        });

        this.socket.on('error', (message: string) => {
            console.error("[Socket Error]:", message);
        });
    }

    connect(token: string) {
        if (this.socket.connected) return;
        
        this.socket.auth = { token };
        this.socket.connect();
    }

    disconnect() {
        if (this.socket.connected) {
            this.socket.disconnect();
        }
    }

    emit<T extends Extract<keyof ClientToServerEvents, string>>(event: T, ...args: Parameters<ClientToServerEvents[T]>) {
        console.log(`[CLIENT EMIT] ${event}:`, args);
        this.socket.emit(event, ...args);
    }
    
    on<T extends Extract<keyof ServerToClientEvents, string>>(event: T, callback: ServerToClientEvents[T]) {
        this.socket.on(event, callback as any);
    }

    off<T extends Extract<keyof ServerToClientEvents, string>>(event: T) {
        this.socket.off(event);
    }
}

export const socketService = new SocketService();
