import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
    baseURL: API_URL,
    // A general timeout for requests that might get stuck without a network error
    timeout: 30000, // 30 seconds
});

// A map to store active request timers for the "slow response" toast
const requestTimers = new Map<any, ReturnType<typeof setTimeout>>();

// Request Interceptor to start a timer
api.interceptors.request.use(config => {
    const timer = setTimeout(() => {
        toast.info("Server may be starting up...", {
            description: "This can take a moment. Thank you for your patience.",
            duration: 15000 // Show for 15s
        });
    }, 8000); // 8 seconds

    // Use the config object itself as the key. This is unique per request.
    requestTimers.set(config, timer);

    return config;
}, error => {
    return Promise.reject(error);
});

// Response Interceptor to clear timers and handle errors
api.interceptors.response.use(
    response => {
        // Clear the timer if the request was successful
        if (requestTimers.has(response.config)) {
            clearTimeout(requestTimers.get(response.config));
            requestTimers.delete(response.config);
        }
        return response;
    },
    error => {
        // Clear the timer even if the request failed
        if (error.config && requestTimers.has(error.config)) {
            clearTimeout(requestTimers.get(error.config));
            requestTimers.delete(error.config);
        }
        
        // Handle specific network/timeout errors
        if (axios.isAxiosError(error)) {
            // No response received (network error, CORS, DNS issue) or a timeout occurred
            if (!error.response || error.code === 'ECONNABORTED') {
                 toast.error("The server is not responding.", {
                    description: "It might be temporarily down. If the issue persists, please contact pavalon.help@gmail.com",
                    duration: Infinity, // Keep this message until dismissed by user
                });
            }
        }

        return Promise.reject(error);
    }
);


export default api;
