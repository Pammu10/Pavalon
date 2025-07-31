import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
    baseURL: API_URL,
    // A general timeout for requests that might get stuck without a network error
    timeout: 30000, // 30 seconds
});

const SERVER_ERROR_TOAST_ID = 'server-connection-error';

// --- State for Smart Error Handling ---
let consecutiveNetworkErrors = 0;
const requestTimers = new Map<any, ReturnType<typeof setTimeout>>();

// --- Interceptors ---

// Request Interceptor: Start a timer for slow responses.
api.interceptors.request.use(config => {
    const timer = setTimeout(() => {
        toast.info("Server seems to be taking a while...", {
            description: "This can happen during initial startup. Thanks for your patience.",
            duration: 15000
        });
    }, 8000); // 8 seconds

    requestTimers.set(config, timer);
    return config;
}, error => {
    return Promise.reject(error);
});

// Response Interceptor: Handle successful responses and errors.
api.interceptors.response.use(
    response => {
        // Clear the slow-response timer.
        if (requestTimers.has(response.config)) {
            clearTimeout(requestTimers.get(response.config));
            requestTimers.delete(response.config);
        }
        
        // --- Self-Healing: Reset on any successful call ---
        consecutiveNetworkErrors = 0;
        toast.dismiss(SERVER_ERROR_TOAST_ID);

        return response;
    },
    error => {
        // Clear the slow-response timer.
        if (error.config && requestTimers.has(error.config)) {
            clearTimeout(requestTimers.get(error.config));
            requestTimers.delete(error.config);
        }
        
        if (axios.isAxiosError(error)) {
            // --- Smart Escalation for Network Errors ---
            if (!error.response || error.code === 'ECONNABORTED') {
                consecutiveNetworkErrors++;

                if (consecutiveNetworkErrors === 1) {
                    // Graceful First Attempt: Temporary, less alarming message.
                    toast.warning("Server is taking a moment to respond...", {
                        description: "This can happen during startup. We'll keep trying.",
                        duration: 10000, // Show for 10 seconds
                    });
                } else if (consecutiveNetworkErrors >= 2) {
                    // Smart Escalation: Persistent, more serious error.
                    toast.error("The server is not responding.", {
                        id: SERVER_ERROR_TOAST_ID,
                        description: "It might be temporarily down. If the issue persists, please contact pavalon.help@gmail.com",
                        duration: Infinity,
                    });
                }
            } else {
                // If we get a response (e.g., 401, 404, 500), the server is up. Reset the counter.
                consecutiveNetworkErrors = 0;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
