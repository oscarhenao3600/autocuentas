import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
});

// Interceptor to attach the token to every request
api.interceptors.request.use(
    (config) => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                if (user.token) {
                    config.headers.Authorization = `Bearer ${user.token}`;
                }
            } catch (error) {
                console.error('Error parsing user token:', error);
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Optional: Interceptor to handle global 401 Unauthorized responses
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('user');
            // Redirect to login could be handled here or in the UI layer
            window.location.href = '/login'; 
        }
        return Promise.reject(error);
    }
);

export default api;
