import { Command } from 'commander';
import { input, select } from '@inquirer/prompts';
import { ApiClient } from '../lib/api-client.js';
import { createOutputFormatter } from '../lib/output.js';
import { handleApiError, confirmAction, parseKeyValuePairs } from '../lib/utils.js';
import { config } from '../lib/config.js';
import type { CommandOptions } from '../types/config.js';
import type { 
  Application, 
  ApplicationList, 
  ApplicationCredential,
  ApplicationCredentialList,
  ApplicationSchemaResponse 
} from '../types/api.js';

export function createAppCommand(): Command {
  const app = new Command('app')
    .description('Manage applications');

  app
    .command('create')
    .description('Create a new application')
    .option('--name <name>', 'Application name')
    .option('--description <description>', 'Application description')
    .option('--account <account>', 'Account ID (uses default if not specified)')
    .action(async (options: { name?: string; description?: string; account?: string } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        let name = options.name;
        if (!name) {
          name = await input({
            message: 'Application name:',
            validate: (input) => input.length > 0 || 'Name is required'
          });
        }
        
        const accountId = options.account || config.getDefaultAccount();
        if (!accountId) {
          throw new Error('Account ID is required. Use --account flag or set default account');
        }
        
        const appData: any = {
          name,
          account: accountId,
        };
        
        if (options.description) {
          appData.description = options.description;
        }
        
        const result = await client.post<Application>('/applications', appData);
        formatter.success(`Application "${result.name}" created successfully`);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : 'Failed to create application');
        process.exit(1);
      }
    });

  app
    .command('list')
    .description('List applications')
    .option('--account <account>', 'Account ID (uses default if not specified)')
    .action(async (options: { account?: string } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        const accountId = options.account || config.getDefaultAccount();
        if (!accountId) {
          throw new Error('Account ID is required. Use --account flag or set default account');
        }
        
        const result = await client.get<ApplicationList>(`/accounts/${accountId}/applications`);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : 'Failed to list applications');
        process.exit(1);
      }
    });

  app
    .command('get')
    .description('Get application details')
    .argument('<app-id>', 'Application ID')
    .action(async (appId: string, options: CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        const result = await client.get<Application>(`/applications/${appId}`);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to get application ${appId}`);
        process.exit(1);
      }
    });

  app
    .command('update')
    .description('Update an application')
    .argument('<app-id>', 'Application ID')
    .option('--name <name>', 'Application name')
    .option('--description <description>', 'Application description')
    .action(async (appId: string, options: { name?: string; description?: string } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        const updateData: any = {};
        
        if (options.name) {
          updateData.name = options.name;
        }
        
        if (options.description !== undefined) {
          updateData.description = options.description;
        }
        
        if (Object.keys(updateData).length === 0) {
          throw new Error('At least one field to update must be specified');
        }
        
        const result = await client.patch<Application>(`/applications/${appId}`, updateData);
        formatter.success(`Application "${result.name}" updated successfully`);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to update application ${appId}`);
        process.exit(1);
      }
    });

  app
    .command('delete')
    .description('Delete an application')
    .argument('<app-id>', 'Application ID')
    .option('--force', 'Skip confirmation prompt')
    .action(async (appId: string, options: { force?: boolean } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        if (!options.force) {
          const confirmed = await confirmAction(
            `Are you sure you want to delete application ${appId}? This action cannot be undone.`
          );
          if (!confirmed) {
            formatter.info('Operation cancelled');
            return;
          }
        }
        
        await client.delete(`/applications/${appId}`);
        formatter.success(`Application ${appId} deleted successfully`);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to delete application ${appId}`);
        process.exit(1);
      }
    });

  // Schema commands
  const schema = app
    .command('schema')
    .description('Manage application schemas');

  schema
    .command('get')
    .description('Get application schema')
    .argument('<app-id>', 'Application ID')
    .action(async (appId: string, options: CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        const result = await client.get<ApplicationSchemaResponse>(`/applications/${appId}/schema`);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to get schema for application ${appId}`);
        process.exit(1);
      }
    });

  schema
    .command('update')
    .description('Update application schema')
    .argument('<app-id>', 'Application ID')
    .option('--schema <schema>', 'Schema JSON string or @file.json')
    .action(async (appId: string, options: { schema?: string } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        let schemaData;
        
        if (options.schema) {
          if (options.schema.startsWith('@')) {
            // Read from file
            const { readFileSync } = await import('fs');
            const filePath = options.schema.slice(1);
            const fileContent = readFileSync(filePath, 'utf-8');
            schemaData = JSON.parse(fileContent);
          } else {
            schemaData = JSON.parse(options.schema);
          }
        } else {
          throw new Error('Schema is required. Use --schema flag');
        }
        
        const result = await client.put<ApplicationSchemaResponse>(`/applications/${appId}/schema`, schemaData);
        formatter.success(`Schema updated for application ${appId}`);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to update schema for application ${appId}`);
        process.exit(1);
      }
    });

  // Config commands
  const appConfig = app
    .command('config')
    .description('Manage application configuration');

  appConfig
    .command('get')
    .description('Get application configuration')
    .argument('<app-id>', 'Application ID')
    .action(async (appId: string, options: CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        const result = await client.get<Application>(`/applications/${appId}`);
        formatter.log({ config: result.config });
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to get config for application ${appId}`);
        process.exit(1);
      }
    });

  appConfig
    .command('update')
    .description('Update application configuration')
    .argument('<app-id>', 'Application ID')
    .option('--config <config>', 'Configuration JSON string or @file.json')
    .action(async (appId: string, options: { config?: string } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        let configData;
        
        if (options.config) {
          if (options.config.startsWith('@')) {
            const { readFileSync } = await import('fs');
            const filePath = options.config.slice(1);
            const fileContent = readFileSync(filePath, 'utf-8');
            configData = JSON.parse(fileContent);
          } else {
            configData = JSON.parse(options.config);
          }
        } else {
          throw new Error('Configuration is required. Use --config flag');
        }
        
        const updateData = { config: configData };
        const result = await client.patch<Application>(`/applications/${appId}`, updateData);
        formatter.success(`Configuration updated for application ${appId}`);
        formatter.log({ config: result.config });
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to update config for application ${appId}`);
        process.exit(1);
      }
    });

  return app;
}