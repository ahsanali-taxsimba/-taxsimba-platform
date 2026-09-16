// File: src/lib/axios-client.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getSession } from 'next-auth/react';
import { authConfig } from './auth-config';

// Base axios instance without interceptors
const baseAxios: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
          'Authorization': token,
          'X-User-Role': session.user.role || '',
          'X-User-ID': session.user.id || '',
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
        callbackUrl: authConfig.defaultRedirects.unauthorized 
      });
    }
  }
  
  if (error.response?.status === 403) {
    console.error('❌ Forbidden: Insufficient permissions');
    // Don't redirect — let the calling component handle the error
    // and show a proper message to the user instead of silently redirecting
  }
  
  // Log errors for debugging
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

// Helper function for logging
const logRequest = (method: string, url: string, data?: any, hasAuth?: boolean) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🚀 Client API Request:', {
      method: method.toUpperCase(),
      url,
      fullURL: `${process.env.NEXT_PUBLIC_API_URL}${url}`,
      data,
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
  // GET method
  get: async <T = any>(url: string, auth: boolean = true, config?: AxiosRequestConfig) => {
    try {
      const headers = auth ? await getAuthHeaders() : {};
      const requestConfig = {
        ...config,
        headers: { ...headers, ...config?.headers },
      };
      
      logRequest('GET', url, undefined, auth);
      const response = await baseAxios.get<T>(url, requestConfig);
      logResponse('GET', url, response.status, response.data);
      
      return response;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // POST method
  post: async <T = any>(url: string, data?: any, auth: boolean = true, config?: AxiosRequestConfig) => {
    try {
      const headers = auth ? await getAuthHeaders() : {};
      const requestConfig = {
        ...config,
        headers: { ...headers, ...config?.headers },
      };
      
      logRequest('POST', url, data, auth);
      const response = await baseAxios.post<T>(url, data, requestConfig);
      logResponse('POST', url, response.status, response.data);
      
      return response;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // PUT method
  put: async <T = any>(url: string, data?: any, auth: boolean = true, config?: AxiosRequestConfig) => {
    try {
      const headers = auth ? await getAuthHeaders() : {};
      const requestConfig = {
        ...config,
        headers: { ...headers, ...config?.headers },
      };
      
      logRequest('PUT', url, data, auth);
      const response = await baseAxios.put<T>(url, data, requestConfig);
      logResponse('PUT', url, response.status, response.data);
      
      return response;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // PATCH method
  patch: async <T = any>(url: string, data?: any, auth: boolean = true, config?: AxiosRequestConfig) => {
    try {
      const headers = auth ? await getAuthHeaders() : {};
      const requestConfig = {
        ...config,
        headers: { ...headers, ...config?.headers },
      };
      
      logRequest('PATCH', url, data, auth);
      const response = await baseAxios.patch<T>(url, data, requestConfig);
      logResponse('PATCH', url, response.status, response.data);
      
      return response;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // DELETE method
  delete: async <T = any>(url: string, auth: boolean = true, config?: AxiosRequestConfig) => {
    try {
      const headers = auth ? await getAuthHeaders() : {};
      const requestConfig = {
        ...config,
        headers: { ...headers, ...config?.headers },
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