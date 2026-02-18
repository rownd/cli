import { confirm } from '@inquirer/prompts';
import type { ApiError } from '../types/api.js';

export async function confirmAction(message: string, defaultValue = false): Promise<boolean> {
  return await confirm({
    message,
    default: defaultValue,
  });
}

export function handleApiError(error: any): never {
  if (error && typeof error === 'object' && 'status' in error) {
    const apiError = error as ApiError;
    
    switch (apiError.status) {
      case 401:
        throw new Error('Authentication failed. Please check your credentials or run `rownd auth login`');
      case 403:
        throw new Error('Access denied. You may not have permission to perform this action');
      case 404:
        throw new Error('Resource not found. Please check the ID and try again');
      case 422:
        throw new Error(`Validation error: ${apiError.message || 'Invalid input provided'}`);
      case 429:
        throw new Error('Rate limit exceeded. Please wait a moment before trying again');
      case 500:
        throw new Error('Server error. Please try again later');
      default:
        throw new Error(apiError.message || apiError.error || 'An unknown error occurred');
    }
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error(String(error) || 'An unknown error occurred');
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateDomain(domain: string): boolean {
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,}|xn--[a-zA-Z0-9]+)$/;
  return domainRegex.test(domain);
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function parseKeyValuePairs(input: string): Record<string, any> {
  const pairs: Record<string, any> = {};
  
  // Support both comma-separated and space-separated key=value pairs
  const items = input.split(/[,\s]+/).filter(Boolean);
  
  for (const item of items) {
    const [key, ...valueParts] = item.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=');
      
      // Try to parse as JSON, fallback to string
      try {
        pairs[key] = JSON.parse(value);
      } catch {
        pairs[key] = value;
      }
    }
  }
  
  return pairs;
}

export function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
}

export function validateDateRange(startDate: string, endDate: string): void {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime())) {
    throw new Error('Invalid start date format. Use ISO8601 format (YYYY-MM-DD)');
  }
  
  if (isNaN(end.getTime())) {
    throw new Error('Invalid end date format. Use ISO8601 format (YYYY-MM-DD)');
  }
  
  if (start >= end) {
    throw new Error('Start date must be before end date');
  }
  
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays > 90) {
    throw new Error('Date range cannot exceed 90 days');
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}