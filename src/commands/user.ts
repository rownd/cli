import { Command } from 'commander';
import { ApiClient } from '../lib/api-client.js';
import { createOutputFormatter } from '../lib/output.js';
import { handleApiError, confirmAction } from '../lib/utils.js';
import type { CommandOptions } from '../types/config.js';
import type { AppUserData, AppUserDataList } from '../types/api.js';

export function createUserCommand(): Command {
  const user = new Command('user')
    .description('Manage users');

  user
    .command('list')
    .description('List users')
    .argument('<app-id>', 'Application ID')
    .option('--page-size <size>', 'Number of users per page (max 1000)', '50')
    .option('--after <user-id>', 'Get users after this user ID')
    .option('--lookup <criteria>', 'Filter users by field values (e.g., email:john@example.com)')
    .option('--ids <ids>', 'Comma-separated list of user IDs to retrieve')
    .option('--fields <fields>', 'Comma-separated list of fields to include')
    .action(async (appId: string, options: {
      pageSize?: string;
      after?: string;
      lookup?: string;
      ids?: string;
      fields?: string;
    } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        const params: Record<string, string> = {};
        
        if (options.pageSize) {
          const size = parseInt(options.pageSize);
          if (isNaN(size) || size < 1 || size > 1000) {
            throw new Error('Page size must be between 1 and 1000');
          }
          params.page_size = options.pageSize;
        }
        
        if (options.after) {
          params.after = options.after;
        }
        
        if (options.lookup) {
          params.lookup = options.lookup;
        }
        
        if (options.ids) {
          params.id = options.ids;
        }
        
        if (options.fields) {
          params.fields = options.fields;
        }
        
        const result = await client.get<AppUserDataList>(`/applications/${appId}/users/data`, params);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to list users for application ${appId}`);
        process.exit(1);
      }
    });

  user
    .command('get')
    .description('Get user details')
    .argument('<app-id>', 'Application ID')
    .argument('<user-id>', 'User ID')
    .option('--fields <fields>', 'Comma-separated list of fields to include')
    .action(async (appId: string, userId: string, options: { fields?: string } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        const params: Record<string, string> = {};
        if (options.fields) {
          params.fields = options.fields;
        }
        
        const result = await client.get<AppUserData>(`/applications/${appId}/users/${userId}/data`, params);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to get user ${userId} for application ${appId}`);
        process.exit(1);
      }
    });

  user
    .command('delete')
    .description('Delete a user')
    .argument('<app-id>', 'Application ID')
    .argument('<user-id>', 'User ID')
    .option('--force', 'Skip confirmation prompt')
    .action(async (appId: string, userId: string, options: { force?: boolean } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        if (!options.force) {
          const confirmed = await confirmAction(
            `Are you sure you want to delete user ${userId} from application ${appId}? This action cannot be undone.`
          );
          if (!confirmed) {
            formatter.info('Operation cancelled');
            return;
          }
        }
        
        // Note: The API endpoint for user deletion might be different
        // This is a placeholder - need to check actual endpoint
        const actionData = {
          actions: [{
            action: 'delete',
            user: {
              data: { user_id: userId }
            }
          }]
        };
        
        await client.post(`/applications/${appId}/users/actions`, actionData);
        formatter.success(`User ${userId} deleted successfully`);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to delete user ${userId} for application ${appId}`);
        process.exit(1);
      }
    });

  // User data commands
  const data = user
    .command('data')
    .description('Manage user data');

  data
    .command('get')
    .description('Get user data')
    .argument('<app-id>', 'Application ID')
    .argument('<user-id>', 'User ID')
    .option('--field <field>', 'Get specific field only')
    .action(async (appId: string, userId: string, options: { field?: string } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        if (options.field) {
          const result = await client.get(`/applications/${appId}/users/${userId}/data/fields/${options.field}`);
          formatter.log(result);
        } else {
          const result = await client.get<AppUserData>(`/applications/${appId}/users/${userId}/data`);
          formatter.log(result);
        }
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to get user data for ${userId} in application ${appId}`);
        process.exit(1);
      }
    });

  data
    .command('update')
    .description('Update user data')
    .argument('<app-id>', 'Application ID')
    .argument('<user-id>', 'User ID')
    .option('--field <field>', 'Update specific field only')
    .option('--value <value>', 'Field value (required with --field)')
    .option('--data <data>', 'JSON data string or @file.json')
    .action(async (appId: string, userId: string, options: {
      field?: string;
      value?: string;
      data?: string;
    } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        if (options.field) {
          if (options.value === undefined) {
            throw new Error('--value is required when using --field');
          }
          
          let fieldValue;
          try {
            fieldValue = JSON.parse(options.value);
          } catch {
            fieldValue = options.value;
          }
          
          const result = await client.patch(`/applications/${appId}/users/${userId}/data/fields/${options.field}`, {
            value: fieldValue
          });
          formatter.success(`Field "${options.field}" updated successfully`);
          formatter.log(result);
        } else if (options.data) {
          let userData;
          if (options.data.startsWith('@')) {
            const { readFileSync } = await import('fs');
            const filePath = options.data.slice(1);
            const fileContent = readFileSync(filePath, 'utf-8');
            userData = JSON.parse(fileContent);
          } else {
            userData = JSON.parse(options.data);
          }
          
          const result = await client.patch<AppUserData>(`/applications/${appId}/users/${userId}/data`, userData);
          formatter.success('User data updated successfully');
          formatter.log(result);
        } else {
          throw new Error('Either --field and --value, or --data must be specified');
        }
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to update user data for ${userId} in application ${appId}`);
        process.exit(1);
      }
    });

  return user;
}