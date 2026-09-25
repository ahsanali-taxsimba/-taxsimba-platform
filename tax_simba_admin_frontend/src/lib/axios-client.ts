// File: src/lib/axios-client.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getSession } from 'next-auth/react';
import { authConfig } from './auth-config';

/**
 * Do NOT set Content-Type on the instance defaults.
 * A default of application/json causes axios transformRequest to JSON.stringify
 * FormData (File → {}), which arrives at Multer as an empty body and yields
 * "file is required" on draft upload.
 */
const baseAxios: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  // Uploads (PDF/DOC) can exceed the previous 10s ceiling on slow networks.
  timeout: 120000,
});

/** True for browser FormData and Node form-data packages. */
export function isMultipartBody(data: unknown): boolean {
  if (data == null || typeof data !== 'object') return false;
  if (typeof FormData !== 'undefined' && data instanceof FormData) return true;
  // Node `form-data` package (tests / SSR): duck-type
  const maybe = data as { append?: unknown; getHeaders?: unknown; pipe?: unknown };
  return typeof maybe.append === 'function' && typeof maybe.getHeaders === 'function';
}

/**
 * Build per-request headers.
 * For FormData: omit Content-Type entirely (false) so the runtime sets
 * multipart/form-data; boundary=… — never set multipart/form-data manually.
 * For JSON bodies: set application/json when not already provided.
 */
export function buildRequestHeaders(
  authHeaders: Record<string, string | undefined>,
  config: AxiosRequestConfig | undefined,
  data: unknown,
): Record<string, string | boolean | undefined> {
  const headers: Record<string, string | boolean | undefined> = {};
  for (const [k, v] of Object.entries(authHeaders || {})) {
    if (typeof v === 'string') headers[k] = v;
  }
  const extra = config?.headers as Record<string, string | boolean | undefined> | undefined;
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (typeof v === 'string' || typeof v === 'boolean' || v === undefined) {
        headers[k] = v;
      }
    }
  }

  if (isMultipartBody(data)) {
    // Axios: `false` removes the header so instance/default JSON cannot win.
    // Manual "multipart/form-data" without a boundary also breaks uploads — strip it.
    headers['Content-Type'] = false;
    headers['content-type'] = false;
  } else if (!headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

// Helper function to get auth headers
const getAuthHeaders = async () => {
  if (typeof window !== 'undefined') {
    try {
      const session = await getSession();

      if (session?.user?.accessToken) {
        const token = session.user.accessToken.startsWith('Bearer ')
          ? session.user.accessToken
          : `Bearer ${session.user.accessToken}`;

        return {
          Authorization: token,
        };
      }
    } catch (error) {
      console.warn('Failed to get session for API request:', error);
    }
  }
  return {};
};

// Helper function for error handling
const handleApiError = async (error: any) => {
  if (error.response?.status === 401) {
    console.warn('❌ Unauthorized - redirecting to login');

    if (typeof window !== 'undefined') {
      const { signOut } = await import('next-auth/react');
      await signOut({
        redirect: true,
        callbackUrl: authConfig.defaultRedirects.unauthorized,
      });
    }
  }

  if (error.response?.status === 403) {
    console.error('❌ Forbidden: Insufficient permissions');
    // Don't redirect — let the calling component handle the error
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Client API Error:', {
      method: error.config?.method?.toUpperCase(),
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data,
    });
  }

  throw error;
};

const logRequest = (method: string, url: string, data?: any, hasAuth?: boolean) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🚀 Client API Request:', {
      method: method.toUpperCase(),
      url,
      fullURL: `${process.env.NEXT_PUBLIC_API_URL}${url}`,
      data: isMultipartBody(data) ? '[FormData]' : data,
      hasAuth,
    });
  }
};

const logResponse = (method: string, url: string, status: number, data: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Client API Response:', {
      method: method.toUpperCase(),
      url,
      status,
      data,
    });
  }
};

// Client axios with simple auth parameter
export const clientAxios = {
  get: async <T = any>(url: string, auth: boolean = true, config?: AxiosRequestConfig) => {
    try {
      const headers = auth ? await getAuthHeaders() : {};
      const requestConfig = {
        ...config,
        headers: buildRequestHeaders(headers, config, undefined),
      };

      logRequest('GET', url, undefined, auth);
      const response = await baseAxios.get<T>(url, requestConfig);
      logResponse('GET', url, response.status, response.data);

      return response;
    } catch (error) {
      return handleApiError(error);
    }
  },

  post: async <T = any>(url: string, data?: any, auth: boolean = true, config?: AxiosRequestConfig) => {
    try {
      const headers = auth ? await getAuthHeaders() : {};
      const multipart = isMultipartBody(data);
      const requestConfig: AxiosRequestConfig = {
        ...config,
        headers: buildRequestHeaders(headers, config, data) as AxiosRequestConfig['headers'],
        ...(multipart
          ? {
              maxBodyLength: Infinity,
              maxContentLength: Infinity,
            }
          : {}),
      };

      logRequest('POST', url, data, auth);
      const response = await baseAxios.post<T>(url, data, requestConfig);
      logResponse('POST', url, response.status, response.data);

      return response;
    } catch (error) {
      return handleApiError(error);
    }
  },

  put: async <T = any>(url: string, data?: any, auth: boolean = true, config?: AxiosRequestConfig) => {
    try {
      const headers = auth ? await getAuthHeaders() : {};
      const multipart = isMultipartBody(data);
      const requestConfig: AxiosRequestConfig = {
        ...config,
        headers: buildRequestHeaders(headers, config, data) as AxiosRequestConfig['headers'],
        ...(multipart
          ? {
              maxBodyLength: Infinity,
              maxContentLength: Infinity,
            }
          : {}),
      };

      logRequest('PUT', url, data, auth);
      const response = await baseAxios.put<T>(url, data, requestConfig);
      logResponse('PUT', url, response.status, response.data);

      return response;
    } catch (error) {
      return handleApiError(error);
    }
  },

  patch: async <T = any>(url: string, data?: any, auth: boolean = true, config?: AxiosRequestConfig) => {
    try {
      const headers = auth ? await getAuthHeaders() : {};
      const requestConfig = {
        ...config,
        headers: buildRequestHeaders(headers, config, data),
      };

      logRequest('PATCH', url, data, auth);
      const response = await baseAxios.patch<T>(url, data, requestConfig);
      logResponse('PATCH', url, response.status, response.data);

      return response;
    } catch (error) {
      return handleApiError(error);
    }
  },

  delete: async <T = any>(url: string, auth: boolean = true, config?: AxiosRequestConfig) => {
    try {
      const headers = auth ? await getAuthHeaders() : {};
      const requestConfig = {
        ...config,
        headers: buildRequestHeaders(headers, config, undefined),
      };

      logRequest('DELETE', url, undefined, auth);
      const response = await baseAxios.delete<T>(url, requestConfig);
      logResponse('DELETE', url, response.status, response.data);

      return response;
    } catch (error) {
      return handleApiError(error);
    }
  },
};

export default clientAxios;
