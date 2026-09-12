import axios from 'axios';

/**
 * In development this stays empty and the Vite dev-server proxies `/api` and
 * `/socket.io` to the backend (see vite.config.ts). In production the SPA and
 * the API are on different origins, so VITE_API_URL points at the API host.
 */
export const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token from memory on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, attempt silent token refresh once
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url: string = originalRequest?.url || '';

    /**
     * `/auth/refresh` and `/auth/login` must never be retried through this
     * interceptor. A 401 from refresh *is* the "no valid session" answer, so
     * treating it as "token expired, go refresh" makes the handler call the
     * endpoint that just failed, fail again, and hard-redirect - which reloads
     * the SPA and starts the same sequence over. The caller gets the 401 and
     * decides what to do instead.
     */
    const isAuthEndpoint = url.includes('/auth/refresh') || url.includes('/auth/login');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${API_ORIGIN}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const newToken = data.data.accessToken;
        localStorage.setItem('accessToken', newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        // Only navigate if we are not already there - assigning `href` to the
        // current path still reloads the page, which is the other half of the
        // loop this guard prevents.
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
