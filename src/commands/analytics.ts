import { Command } from 'commander';
import { ApiClient } from '../lib/api-client.js';
import { createOutputFormatter } from '../lib/output.js';
import { handleApiError, validateDateRange } from '../lib/utils.js';
import type { CommandOptions } from '../types/config.js';
import type { ApplicationAnalytics } from '../types/api.js';

export function createAnalyticsCommand(): Command {
  const analytics = new Command('analytics')
    .description('Get application analytics');

  analytics
    .command('get')
    .description('Get analytics data for an application')
    .argument('<app-id>', 'Application ID')
    .option('--start-date <date>', 'Start date (ISO format: YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (ISO format: YYYY-MM-DD)')
    .option('--resolution <resolution>', 'Data resolution (minute|hour|day|month)', 'day')
    .action(async (appId: string, options: {
      startDate?: string;
      endDate?: string;
      resolution?: string;
    } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        const params: Record<string, string> = {};
        
        // Validate resolution
        const validResolutions = ['minute', 'hour', 'day', 'month'];
        if (options.resolution && !validResolutions.includes(options.resolution)) {
          throw new Error(`Invalid resolution. Must be one of: ${validResolutions.join(', ')}`);
        }
        
        if (options.resolution) {
          params.resolution = options.resolution;
        }
        
        // Handle date range
        if (options.startDate || options.endDate) {
          if (options.startDate && options.endDate) {
            validateDateRange(options.startDate, options.endDate);
            params.start_date = options.startDate;
            params.end_date = options.endDate;
          } else if (options.startDate) {
            // If only start date provided, default to 30 days later or current date
            const startDate = new Date(options.startDate);
            if (isNaN(startDate.getTime())) {
              throw new Error('Invalid start date format. Use ISO8601 format (YYYY-MM-DD)');
            }
            
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 30);
            const now = new Date();
            if (endDate > now) {
              endDate.setTime(now.getTime());
            }
            
            params.start_date = options.startDate;
            params.end_date = endDate.toISOString().split('T')[0];
          } else if (options.endDate) {
            // If only end date provided, default to 30 days earlier
            const endDate = new Date(options.endDate);
            if (isNaN(endDate.getTime())) {
              throw new Error('Invalid end date format. Use ISO8601 format (YYYY-MM-DD)');
            }
            
            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 30);
            
            params.start_date = startDate.toISOString().split('T')[0];
            params.end_date = options.endDate;
          }
        }
        
        const result = await client.get<ApplicationAnalytics>(`/applications/${appId}/analytics`, params);
        
        if (options.format === 'table') {
          // Format analytics data for table display
          if (result.data && Array.isArray(result.data)) {
            formatter.log({
              summary: result.summary,
              data: result.data
            });
          } else {
            formatter.log(result);
          }
        } else {
          formatter.log(result);
        }
        
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to get analytics for application ${appId}`);
        process.exit(1);
      }
    });

  return analytics;
}