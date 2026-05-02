import axios, { AxiosError } from 'axios';

/**
 * Get API base URL based on environment
 * - Local dev in browser: use Vite same-origin proxy to avoid localhost/127.0.0.1 CORS mismatches
 * - Otherwise: prefer explicit environment configuration
 */
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    const isLocalDev = protocol === 'http:' && (hostname === '127.0.0.1' || hostname === 'localhost');
    if (isLocalDev) {
      return '/api';
    }
  }

  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  return configuredBaseUrl || '/api';
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
 * Automatically adds authentication token and selected child ID to requests if available
 */
apiClient.interceptors.request.use(
  (config) => {
    // 获取认证令牌
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 自动注入 selectedChildId 到请求参数
    // 只对非 /auth/ 和 /settings/ 路径注入，避免干扰获取用户信息和设置的请求
    // 同时避免在文件上传请求中注入，因为文件上传使用 multipart/form-data 格式
    // 只在请求体中没有 childId 时才注入
    const selectedChildIdStr = localStorage.getItem('selected_child_id');
    const url = config.url || '';
    const contentType = config.headers?.['Content-Type'];
    const isFileUpload = typeof contentType === 'string' ? contentType.includes('multipart/form-data') : false;
    const normalizedPath = url.split('?')[0].replace(/^\/api/, '');
    const skipChildInjection =
      normalizedPath === '/children' ||
      normalizedPath === '/login' ||
      normalizedPath === '/register' ||
      normalizedPath.startsWith('/auth/') ||
      normalizedPath.startsWith('/settings/');
    if (selectedChildIdStr && selectedChildIdStr !== 'null' && !skipChildInjection && !isFileUpload) {
      const selectedChildId = parseInt(selectedChildIdStr);
      if (!isNaN(selectedChildId)) {
        if (config.method?.toLowerCase() === 'get') {
          // GET 请求：添加到 query 参数，仅当 query 中没有 childId 时
          const urlHasChildId = (() => {
            try {
              const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
              return new URLSearchParams(query).has('childId');
            } catch {
              return url.includes('childId=');
            }
          })();
          if (!urlHasChildId && (!config.params || !('childId' in config.params))) {
            config.params = {
              ...config.params,
              childId: selectedChildId,
            };
          }
        } else {
          // 非 GET 请求：添加到 body 参数，仅当 body 中没有 childId 时
          if (!config.data || !('childId' in config.data)) {
            config.data = {
              ...config.data,
              childId: selectedChildId,
            };
          }
        }
      }
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
    // Handle auth-related failures - 清除认证状态，触发全局事件
    if (error.response?.status === 401 || error.response?.status === 431) {
      // 清除认证令牌
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      // 触发全局登出事件
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
