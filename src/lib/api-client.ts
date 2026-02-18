import { config } from './config.js';
import { ensureValidToken } from './auth.js';
import type { AuthOptions, Config } from '../types/config.js';
import type { ApiError } from '../types/api.js';

export class ApiClient {
  private baseUrl: string;
  private authOptions: AuthOptions;

  constructor(authOptions: AuthOptions = {}) {
    this.baseUrl = config.getApiBaseUrl();
    this.authOptions = authOptions;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Check for token in order of precedence: flag > env > stored (with refresh)
    let token = this.authOptions.token || process.env.ROWND_API_TOKEN;
    
    if (!token) {
      // Try to get a valid token (with automatic refresh if needed)
      try {
        token = await ensureValidToken();
      } catch (error) {
        // If token refresh fails, fall back to checking stored token without refresh
        const auth = config.getAuth();
        if (auth?.access_token) {
          token = auth.access_token;
        }
      }
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
      return headers;
    }

    // Check for app key/secret
    const appKey = this.authOptions.appKey || process.env.ROWND_APP_KEY;
    const appSecret = this.authOptions.appSecret || process.env.ROWND_APP_SECRET;

    if (appKey && appSecret) {
      // For app key/secret authentication, we need to implement the specific auth flow
      // For now, we'll throw an error suggesting bearer token usage
      throw new Error('App key/secret authentication not yet implemented. Please use bearer token authentication.');
    }

    throw new Error('No authentication method provided. Please use --token flag, set ROWND_API_TOKEN environment variable, or run `rownd auth login`');
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text || 'Unknown error' };
    }

    if (!response.ok) {
      const error: ApiError = {
        error: data.error || `HTTP ${response.status}`,
        message: data.message || response.statusText,
        status: response.status
      };
      throw error;
    }

    return data as T;
  }

  private async retryRequest<T>(
    url: string, 
    options: RequestInit, 
    retries = 3
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);
        
        // If rate limited, wait and retry
        if (response.status === 429 && attempt < retries) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        return await this.handleResponse<T>(response);
      } catch (error) {
        lastError = error;
        
        // Only retry on network errors, not API errors
        if (error && typeof error === 'object' && 'status' in error) {
          throw error;
        }
        
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      });
    }

    const options: RequestInit = {
      method: 'GET',
      headers: await this.getAuthHeaders(),
    };

    return this.retryRequest<T>(url.toString(), options);
  }

  async post<T>(path: string, data?: any): Promise<T> {
    const url = new URL(path, this.baseUrl);
    const options: RequestInit = {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    };

    return this.retryRequest<T>(url.toString(), options);
  }

  async put<T>(path: string, data?: any): Promise<T> {
    const url = new URL(path, this.baseUrl);
    const options: RequestInit = {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    };

    return this.retryRequest<T>(url.toString(), options);
  }

  async patch<T>(path: string, data?: any): Promise<T> {
    const url = new URL(path, this.baseUrl);
    const options: RequestInit = {
      method: 'PATCH',
      headers: await this.getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    };

    return this.retryRequest<T>(url.toString(), options);
  }

  async delete<T>(path: string): Promise<T> {
    const url = new URL(path, this.baseUrl);
    const options: RequestInit = {
      method: 'DELETE',
      headers: await this.getAuthHeaders(),
    };

    return this.retryRequest<T>(url.toString(), options);
  }
}

// Export a default instance
export const apiClient = new ApiClient();