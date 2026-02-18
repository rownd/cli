import { Command } from 'commander';
import { ApiClient } from '../lib/api-client.js';
import { createOutputFormatter } from '../lib/output.js';
import { handleApiError, confirmAction } from '../lib/utils.js';
import type { CommandOptions } from '../types/config.js';

export function createGroupMemberCommand(): Command {
  const member = new Command('member')
    .description('Manage group members');

  member
    .command('list')
    .description('List group members')
    .argument('<app-id>', 'Application ID')
    .argument('<group-id>', 'Group ID')
    .action(async (appId: string, groupId: string, options: CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        const result = await client.get(`/applications/${appId}/groups/${groupId}/members`);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to list members for group ${groupId} in application ${appId}`);
        process.exit(1);
      }
    });

  member
    .command('add')
    .description('Add member to group')
    .argument('<app-id>', 'Application ID')
    .argument('<group-id>', 'Group ID')
    .argument('<user-id>', 'User ID to add to group')
    .option('--roles <roles>', 'Comma-separated list of roles')
    .action(async (appId: string, groupId: string, userId: string, options: {
      roles?: string;
    } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        const memberData: any = {
          user_id: userId,
        };
        
        if (options.roles) {
          memberData.roles = options.roles.split(',').map(r => r.trim());
        }
        
        const result = await client.post(`/applications/${appId}/groups/${groupId}/members`, memberData);
        formatter.success(`User ${userId} added to group successfully`);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to add user ${userId} to group ${groupId} in application ${appId}`);
        process.exit(1);
      }
    });

  member
    .command('remove')
    .description('Remove member from group')
    .argument('<app-id>', 'Application ID')
    .argument('<group-id>', 'Group ID')
    .argument('<user-id>', 'User ID to remove from group')
    .option('--force', 'Skip confirmation prompt')
    .action(async (appId: string, groupId: string, userId: string, options: {
      force?: boolean;
    } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        if (!options.force) {
          const confirmed = await confirmAction(
            `Are you sure you want to remove user ${userId} from group ${groupId}?`
          );
          if (!confirmed) {
            formatter.info('Operation cancelled');
            return;
          }
        }
        
        await client.delete(`/applications/${appId}/groups/${groupId}/members/${userId}`);
        formatter.success(`User ${userId} removed from group successfully`);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to remove user ${userId} from group ${groupId} in application ${appId}`);
        process.exit(1);
      }
    });

  return member;
}