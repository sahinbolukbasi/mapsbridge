/**
 * MapsBridge API Client
 * Shared client for web and mobile applications
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface MapsBridgeConfig {
  baseURL?: string;
  apiKey?: string;
  accessToken?: string;
  timeout?: number;
}

export class MapsBridgeClient {
  private client: AxiosInstance;

  constructor(config: MapsBridgeConfig = {}) {
    const baseURL = config.baseURL || process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.mapsbridge.com';
    
    this.client = axios.create({
      baseURL,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        ...config.apiKey && { 'X-API-Key': config.apiKey },
        ...config.accessToken && { 'Authorization': `Bearer ${config.accessToken}` }
      }
    });

    // Request interceptor for adding auth headers
    this.client.interceptors.request.use(
      (config) => {
        // Add any additional headers or authentication logic here
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Handle common API errors
        if (error.response?.status === 401) {
          console.warn('Authentication required - please login');
        } else if (error.response?.status === 403) {
          console.warn('Access forbidden - insufficient permissions');
        } else if (error.response?.status === 429) {
          console.warn('Rate limit exceeded - please slow down');
        }
        return Promise.reject(error);
      }
    );
  }

  // Generic GET request
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  // Generic POST request
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  // Generic PUT request
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  // Generic DELETE request
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  // Health check endpoint
  async health(): Promise<{ status: string }> {
    return this.get<{ status: string }>('/healthz');
  }

  // Authentication endpoints
  async login(email: string, password: string): Promise<{ token: string }> {
    return this.post<{ token: string }>('/auth/login', { email, password });
  }

  async register(userData: { email: string; password: string; name: string }): Promise<{ token: string }> {
    return this.post<{ token: string }>('/auth/register', userData);
  }

  // Trip endpoints
  async getTrips(): Promise<any[]> {
    return this.get<any[]>('/routes');
  }

  async createTrip(data: any): Promise<any> {
    return this.post<any>('/routes', data);
  }

  async getTrip(id: string): Promise<any> {
    return this.get<any>(`/routes/${id}`);
  }

  async updateTrip(id: string, data: any): Promise<any> {
    return this.put<any>(`/routes/${id}`, data);
  }

  async deleteTrip(id: string): Promise<void> {
    await this.delete<void>(`/routes/${id}`);
  }

  // AI Assistant endpoints
  async getAIAssistantConfig(): Promise<any> {
    return this.get<any>('/ai/config');
  }

  async planRoute(prompt: string, options?: any): Promise<any> {
    return this.post<any>('/ai/route-planner', { prompt, ...options });
  }

  // Billing endpoints
  async getWallet(): Promise<any> {
    return this.get<any>('/stripe/wallet');
  }

  async getPlans(): Promise<any[]> {
    return this.get<any[]>('/stripe/plans');
  }

  // Chat endpoints
  async getThreads(): Promise<any[]> {
    return this.get<any[]>('/chat/threads');
  }

  async sendMessage(threadId: string, message: string): Promise<any> {
    return this.post<any>(`/chat/threads/${threadId}/messages`, { message });
  }
}

export default MapsBridgeClient;