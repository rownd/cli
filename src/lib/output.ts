import type { OutputFormat } from '../types/config.js';

export class OutputFormatter {
  constructor(private outputFormat: OutputFormat = 'json', private quiet = false) {}

  format(data: any): string {
    if (this.outputFormat === 'table') {
      return this.formatTable(data);
    }
    return this.formatJSON(data);
  }

  private formatJSON(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  private formatTable(data: any): string {
    if (Array.isArray(data)) {
      return this.formatArrayAsTable(data);
    }
    
    if (data && typeof data === 'object' && data.results && Array.isArray(data.results)) {
      return this.formatArrayAsTable(data.results);
    }
    
    return this.formatObjectAsTable(data);
  }

  private formatArrayAsTable(items: any[]): string {
    if (!items || items.length === 0) {
      return 'No items found.';
    }

    // Get all unique keys from all objects
    const keys = Array.from(new Set(
      items.flatMap(item => Object.keys(item))
    ));

    // Filter out some commonly uninteresting keys for table display
    const filteredKeys = keys.filter(key => 
      !key.includes('_at') || ['created_at', 'updated_at'].includes(key)
    );

    // If we have too many keys, show only the most important ones
    const displayKeys = filteredKeys.length > 6 
      ? this.selectImportantKeys(filteredKeys, items[0])
      : filteredKeys;

    // Calculate column widths
    const widths: Record<string, number> = {};
    displayKeys.forEach(key => {
      widths[key] = Math.max(
        key.length,
        ...items.map(item => String(item[key] || '').length)
      );
    });

    // Build header
    const header = displayKeys.map(key => key.padEnd(widths[key])).join(' | ');
    const separator = displayKeys.map(key => '-'.repeat(widths[key])).join('-|-');

    // Build rows
    const rows = items.map(item => 
      displayKeys.map(key => {
        const value = item[key];
        const stringValue = value === null || value === undefined ? '' : String(value);
        return stringValue.padEnd(widths[key]);
      }).join(' | ')
    );

    return [header, separator, ...rows].join('\n');
  }

  private formatObjectAsTable(obj: any): string {
    if (!obj || typeof obj !== 'object') {
      return String(obj);
    }

    const entries = Object.entries(obj);
    const maxKeyLength = Math.max(...entries.map(([key]) => key.length));

    return entries.map(([key, value]) => {
      const formattedValue = typeof value === 'object' && value !== null 
        ? JSON.stringify(value, null, 2)
        : String(value);
      return `${key.padEnd(maxKeyLength)} : ${formattedValue}`;
    }).join('\n');
  }

  private selectImportantKeys(keys: string[], sampleItem: any): string[] {
    // Define importance order for common keys
    const importanceOrder = [
      'id', 'name', 'slug', 'email', 'user_id', 'client_id', 'status', 'type',
      'created_at', 'updated_at', 'description', 'url', 'domain'
    ];

    const important = keys.filter(key => importanceOrder.includes(key));
    const others = keys.filter(key => !importanceOrder.includes(key));

    // Return up to 6 most important keys
    return [...important, ...others].slice(0, 6);
  }

  success(message: string): void {
    if (!this.quiet) {
      console.log(`✓ ${message}`);
    }
  }

  error(message: string): void {
    console.error(`✗ Error: ${message}`);
  }

  warn(message: string): void {
    if (!this.quiet) {
      console.warn(`⚠ Warning: ${message}`);
    }
  }

  info(message: string): void {
    if (!this.quiet) {
      console.log(`ℹ ${message}`);
    }
  }

  log(data: any): void {
    console.log(this.format(data));
  }
}

export function createOutputFormatter(format: OutputFormat = 'json', quiet = false): OutputFormatter {
  return new OutputFormatter(format, quiet);
}