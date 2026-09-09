// File: src/lib/axios.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { getSession } from 'next-auth/react';
import { authConfig, checkRouteAccess } from './auth-config';

// Create axios instance with base configuration
const axiosInstance: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor optimized for NextAuth
axiosInstance.interceptors.request.use(
  async (config) => {
    if (typeof window !== 'undefined') {
      try {
        const session = await getSession();
        
        if (session) {
          // NextAuth typically stores the session token automatically
          // You can access user data like: session.user.email, session.user.role, etc.
          
          // If you have a custom token in your session (from JWT callback)
          if ((session as any).accessToken) {
            config.headers.Authorization = `Bearer ${(session as any).accessToken}`;
          }
          
          // Or if you store it in user object
          else if ((session.user as any)?.token) {
            config.headers.Authorization = `Bearer ${(session.user as any).token}`;
          }
          
          // Add user role to headers for API authorization
          if ((session.user as any)?.role) {
            config.headers['X-User-Role'] = (session.user as any).role;
          }
          
          // Add user ID to headers if needed
          if ((session.user as any)?.id) {
            config.headers['X-User-ID'] = (session.user as any).id;
          }
        }
        
      } catch (error) {
        console.warn('Failed to get NextAuth session for API request:', error);
      }
    }
    
    // Log request in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 API Request:', {
        url: config.url,
        method: config.method,
        data: config.data,
        headers: config.headers,
      });
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log response in development
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ API Response:', {
        url: response.config.url,
        status: response.status,
        data: response.data,
      });
    }
    
    return response;
  },
  async (error) => {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    
    // Handle authentication errors with NextAuth
    if (error.response?.status === 401) {
      console.warn('❌ Unauthorized request');
      
      if (typeof window !== 'undefined') {
        // Use NextAuth signOut instead of manual token clearing
        const { signOut } = await import('next-auth/react');
        await signOut({ 
          redirect: true, 
          callbackUrl: authConfig.defaultRedirects.unauthorized 
        });
      }
    }
    
    // Handle forbidden access (insufficient role)
    if (error.response?.status === 403) {
      console.error('❌ Forbidden: Insufficient permissions');
      
      if (typeof window !== 'undefined') {
        window.location.href = authConfig.defaultRedirects.forbidden;
      }
    }
    
    if (error.response?.status >= 500) {
      console.error('❌ Server Error:', error.response.data);
    }
    
    console.error('❌ API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });
    
    return Promise.reject(error);
  }
);

export default axiosInstance;

// Export convenience methods with proper typing
export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) => 
    axiosInstance.get<T>(url, config),
  
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    axiosInstance.post<T>(url, data, config),
  
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    axiosInstance.put<T>(url, data, config),
  
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    axiosInstance.patch<T>(url, data, config),
  
  delete: <T = any>(url: string, config?: AxiosRequestConfig) => 
    axiosInstance.delete<T>(url, config),
};

// Helper function to check if user can access API endpoint
export const canAccessEndpoint = (endpoint: string, userRole?: string) => {
  // Map API endpoints to route permissions
  const endpointRouteMap: Record<string, string> = {
    '/accountants': '/manage-accountant',
    '/clients': '/manage-client',
    // Add more mappings as needed
  };
  
  const routePath = endpointRouteMap[endpoint];
  if (routePath && userRole) {
    const access = checkRouteAccess(routePath, userRole);
    return access.allowed;
  }
  
  return true; // Default allow if no specific mapping
};