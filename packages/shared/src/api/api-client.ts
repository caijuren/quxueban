import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';

/**
 * Get API base URL based on environment
 * - Development: uses direct backend URL
 * - Production: uses environment variable VITE_API_BASE_URL
 */
const getBaseUrl = () => {
  return import.meta.env.VITE_API_BASE_URL || '/api';
};

/**
 * Axios instance configured for API requests
 */
const baseUrl = getBaseUrl();
console.log('API base URL:', baseUrl);

// Store CSRF token
let csrfToken: string | null = null;

export const apiClient = axios.create({
  baseURL: baseUrl,
  timeout: 60000, // 60秒超时，等待Render休眠唤醒
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor
 * Automatically adds authentication token, CSRF token, and selected child ID to requests if available
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add CSRF token to headers
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    // 自动注入 selectedChildId 到请求参数
    // 只对非 /auth/、/settings/、/children/ 和 /upload/ 路径注入，避免干扰相关操作
    // 同时避免在文件上传请求中注入，因为文件上传使用 multipart/form-data 格式
    // 只在请求体中没有 childId 时才注入
    const selectedChildIdStr = localStorage.getItem('selected_child_id');
    const url = config.url || '';
    const contentType = config.headers?.['Content-Type'];
    const isFileUpload = typeof contentType === 'string' && contentType.includes('multipart/form-data');
    console.log('API request URL:', url);
    console.log('Should inject childId:', selectedChildIdStr && selectedChildIdStr !== 'null' && !url.includes('/auth/') && !url.includes('/settings/') && !url.includes('/children/') && !url.includes('/upload/') && !isFileUpload);
    if (selectedChildIdStr && selectedChildIdStr !== 'null' && !url.includes('/auth/') && !url.includes('/settings/') && !url.includes('/children/') && !url.includes('/upload/') && !isFileUpload) {
      const selectedChildId = parseInt(selectedChildIdStr);
      if (!isNaN(selectedChildId)) {
        if (config.method?.toLowerCase() === 'get') {
          // GET 请求：添加到 query 参数，仅当 query 中没有 childId 时
          if (!config.params || !('childId' in config.params)) {
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
 * Also extracts and stores CSRF token from response headers
 */
apiClient.interceptors.response.use(
  (response) => {
    // Extract CSRF token from response header
    const token = response.headers['x-csrf-token'] as string;
    if (token) {
      csrfToken = token;
    }
    return response;
  },
  (error: AxiosError) => {
    // Handle 401 Unauthorized - 清除认证状态，触发全局事件
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_state');
      localStorage.removeItem('auth_token');
      // 触发全局登出事件，让 AuthProvider 更新状态
      window.dispatchEvent(new Event('auth:logout'));
      toast.error('登录已过期，请重新登录');
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      toast.error('无权访问该资源');
    }

    // Handle 404 Not Found
    if (error.response?.status === 404) {
      toast.error('请求的资源不存在');
    }

    // Handle 409 Conflict
    if (error.response?.status === 409) {
      toast.error('资源已存在，无法重复创建');
    }

    // Handle 500 Internal Server Error
    if (error.response?.status === 500) {
      toast.error('服务器内部错误，请稍后再试');
    }

    // Handle network errors
    if (!error.response) {
      toast.error('网络连接失败，请检查网络设置');
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
