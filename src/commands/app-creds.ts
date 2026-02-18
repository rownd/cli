import { Command } from 'commander';
import { input } from '@inquirer/prompts';
import { ApiClient } from '../lib/api-client.js';
import { createOutputFormatter } from '../lib/output.js';
import { handleApiError, confirmAction } from '../lib/utils.js';
import type { CommandOptions } from '../types/config.js';
import type { ApplicationCredential, ApplicationCredentialList } from '../types/api.js';

export function createAppCredsCommand(): Command {
  const creds = new Command('creds')
    .description('Manage application credentials');

  creds
    .command('create')
    .description('Create application credentials')
    .argument('<app-id>', 'Application ID')
    .option('--name <name>', 'Credential name')
    .action(async (appId: string, options: { name?: string } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        let name = options.name;
        if (!name) {
          name = await input({
            message: 'Credential name:',
            validate: (input) => input.length > 0 || 'Name is required'
          });
        }
        
        const credData = { name };
        const result = await client.post<ApplicationCredential>(`/applications/${appId}/creds`, credData);
        
        formatter.success(`Application credentials "${result.name}" created successfully`);
        formatter.log(result);
        
        if (result.client_secret) {
          formatter.warn('Make sure to copy the client secret - it will not be shown again!');
        }
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to create credentials for application ${appId}`);
        process.exit(1);
      }
    });

  creds
    .command('list')
    .description('List application credentials')
    .argument('<app-id>', 'Application ID')
    .action(async (appId: string, options: CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        const result = await client.get<ApplicationCredentialList>(`/applications/${appId}/creds`);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to list credentials for application ${appId}`);
        process.exit(1);
      }
    });

  creds
    .command('get')
    .description('Get application credential details')
    .argument('<app-id>', 'Application ID')
    .argument('<client-id>', 'Client ID')
    .action(async (appId: string, clientId: string, options: CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        const result = await client.get<ApplicationCredential>(`/applications/${appId}/creds/${clientId}`);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to get credential ${clientId} for application ${appId}`);
        process.exit(1);
      }
    });

  creds
    .command('delete')
    .description('Delete application credentials')
    .argument('<app-id>', 'Application ID')
    .argument('<client-id>', 'Client ID')
    .option('--force', 'Skip confirmation prompt')
    .action(async (appId: string, clientId: string, options: { force?: boolean } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        if (!options.force) {
          const confirmed = await confirmAction(
            `Are you sure you want to delete credential ${clientId} from application ${appId}? This action cannot be undone.`
          );
          if (!confirmed) {
            formatter.info('Operation cancelled');
            return;
          }
        }
        
        await client.delete(`/applications/${appId}/creds/${clientId}`);
        formatter.success(`Application credential ${clientId} deleted successfully`);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to delete credential ${clientId} for application ${appId}`);
        process.exit(1);
      }
    });

  return creds;
}