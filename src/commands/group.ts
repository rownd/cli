import { Command } from 'commander';
import { input } from '@inquirer/prompts';
import { ApiClient } from '../lib/api-client.js';
import { createOutputFormatter } from '../lib/output.js';
import { handleApiError, confirmAction } from '../lib/utils.js';
import type { CommandOptions } from '../types/config.js';
import type { Group, GroupList } from '../types/api.js';

export function createGroupCommand(): Command {
  const group = new Command('group')
    .description('Manage groups');

  group
    .command('create')
    .description('Create a new group')
    .argument('<app-id>', 'Application ID')
    .option('--name <name>', 'Group name')
    .option('--description <description>', 'Group description')
    .option('--admission-policy <policy>', 'Admission policy (open|invite_only|admin_only)', 'invite_only')
    .action(async (appId: string, options: {
      name?: string;
      description?: string;
      admissionPolicy?: string;
    } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        let name = options.name;
        if (!name) {
          name = await input({
            message: 'Group name:',
            validate: (input) => input.length > 0 || 'Name is required'
          });
        }
        
        const groupData: any = {
          name,
          admission_policy: options.admissionPolicy || 'invite_only'
        };
        
        if (options.description) {
          groupData.description = options.description;
        }
        
        const result = await client.post<Group>(`/applications/${appId}/groups`, groupData);
        formatter.success(`Group "${result.name}" created successfully`);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to create group for application ${appId}`);
        process.exit(1);
      }
    });

  group
    .command('list')
    .description('List groups')
    .argument('<app-id>', 'Application ID')
    .option('--page-size <size>', 'Number of groups per page (max 100)', '50')
    .option('--after <group-id>', 'Get groups after this group ID')
    .option('--lookup <criteria>', 'Filter groups by criteria')
    .action(async (appId: string, options: {
      pageSize?: string;
      after?: string;
      lookup?: string;
    } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        const params: Record<string, string> = {};
        
        if (options.pageSize) {
          const size = parseInt(options.pageSize);
          if (isNaN(size) || size < 1 || size > 100) {
            throw new Error('Page size must be between 1 and 100');
          }
          params.page_size = options.pageSize;
        }
        
        if (options.after) {
          params.after = options.after;
        }
        
        if (options.lookup) {
          params.lookup = options.lookup;
        }
        
        const result = await client.get<GroupList>(`/applications/${appId}/groups`, params);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to list groups for application ${appId}`);
        process.exit(1);
      }
    });

  group
    .command('get')
    .description('Get group details')
    .argument('<app-id>', 'Application ID')
    .argument('<group-id>', 'Group ID')
    .action(async (appId: string, groupId: string, options: CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        const result = await client.get<Group>(`/applications/${appId}/groups/${groupId}`);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to get group ${groupId} for application ${appId}`);
        process.exit(1);
      }
    });

  group
    .command('update')
    .description('Update a group')
    .argument('<app-id>', 'Application ID')
    .argument('<group-id>', 'Group ID')
    .option('--name <name>', 'Group name')
    .option('--description <description>', 'Group description')
    .option('--admission-policy <policy>', 'Admission policy (open|invite_only|admin_only)')
    .action(async (appId: string, groupId: string, options: {
      name?: string;
      description?: string;
      admissionPolicy?: string;
    } & CommandOptions) => {
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
        
        if (options.admissionPolicy) {
          updateData.admission_policy = options.admissionPolicy;
        }
        
        if (Object.keys(updateData).length === 0) {
          throw new Error('At least one field to update must be specified');
        }
        
        const result = await client.patch<Group>(`/applications/${appId}/groups/${groupId}`, updateData);
        formatter.success(`Group "${result.name}" updated successfully`);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to update group ${groupId} for application ${appId}`);
        process.exit(1);
      }
    });

  group
    .command('delete')
    .description('Delete a group')
    .argument('<app-id>', 'Application ID')
    .argument('<group-id>', 'Group ID')
    .option('--force', 'Skip confirmation prompt')
    .action(async (appId: string, groupId: string, options: { force?: boolean } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        if (!options.force) {
          const confirmed = await confirmAction(
            `Are you sure you want to delete group ${groupId} from application ${appId}? This action cannot be undone.`
          );
          if (!confirmed) {
            formatter.info('Operation cancelled');
            return;
          }
        }
        
        await client.delete(`/applications/${appId}/groups/${groupId}`);
        formatter.success(`Group ${groupId} deleted successfully`);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to delete group ${groupId} for application ${appId}`);
        process.exit(1);
      }
    });

  return group;
}