import axios, { AxiosError } from 'axios';

/**
 * Get API base URL based on environment
 * - Development: uses Vite proxy (/api -> localhost:3000)
 * - Production: uses environment variable VITE_API_BASE_URL
 */
const getBaseUrl = () => {
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_API_BASE_URL || '/api';
  }
  return '/api';
};

/**
 * Axios instance configured for API requests
 */
export const apiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 60000, // 60秒超时，等待Render休眠唤醒
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor
 * Automatically adds authentication token to requests if available
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor
 * Handles common error scenarios like 401 unauthorized
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle 401 Unauthorized - 清除认证状态，触发全局事件
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_state');
      localStorage.removeItem('auth_token');
      // 触发全局登出事件，让 AuthProvider 更新状态
      window.dispatchEvent(new Event('auth:logout'));
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.error('Access forbidden');
    }

    // Handle 500 Internal Server Error
    if (error.response?.status === 500) {
      console.error('Server error occurred');
    }

    return Promise.reject(error);
  }
);

/**
 * Type-safe error handler for API errors
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message || 'An error occurred';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
}

export default apiClient;
