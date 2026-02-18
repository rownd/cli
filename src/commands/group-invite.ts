import { Command } from 'commander';
import { input } from '@inquirer/prompts';
import { ApiClient } from '../lib/api-client.js';
import { createOutputFormatter } from '../lib/output.js';
import { handleApiError, validateEmail } from '../lib/utils.js';
import type { CommandOptions } from '../types/config.js';

export function createGroupInviteCommand(): Command {
  const invite = new Command('invite')
    .description('Manage group invitations');

  invite
    .command('create')
    .description('Create a group invitation')
    .argument('<app-id>', 'Application ID')
    .argument('<group-id>', 'Group ID')
    .option('--email <email>', 'Email address to invite')
    .option('--expires-at <date>', 'Expiration date (ISO format)')
    .action(async (appId: string, groupId: string, options: {
      email?: string;
      expiresAt?: string;
    } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        let email = options.email;
        if (!email) {
          email = await input({
            message: 'Email address to invite:',
            validate: (input) => validateEmail(input) || 'Please enter a valid email address'
          });
        }
        
        if (!validateEmail(email)) {
          throw new Error('Invalid email address provided');
        }
        
        const inviteData: any = {
          email,
        };
        
        if (options.expiresAt) {
          const expirationDate = new Date(options.expiresAt);
          if (isNaN(expirationDate.getTime())) {
            throw new Error('Invalid expiration date format. Use ISO format (e.g., 2024-12-31T23:59:59Z)');
          }
          inviteData.expires_at = options.expiresAt;
        }
        
        const result = await client.post(`/applications/${appId}/groups/${groupId}/invites`, inviteData);
        formatter.success(`Invitation sent to ${email}`);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to create invitation for group ${groupId} in application ${appId}`);
        process.exit(1);
      }
    });

  invite
    .command('list')
    .description('List group invitations')
    .argument('<app-id>', 'Application ID')
    .argument('<group-id>', 'Group ID')
    .action(async (appId: string, groupId: string, options: CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        const result = await client.get(`/applications/${appId}/groups/${groupId}/invites`);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to list invitations for group ${groupId} in application ${appId}`);
        process.exit(1);
      }
    });

  invite
    .command('accept')
    .description('Accept a group invitation')
    .argument('<app-id>', 'Application ID')
    .argument('<group-id>', 'Group ID')
    .argument('<invite-id>', 'Invitation ID')
    .action(async (appId: string, groupId: string, inviteId: string, options: CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      const client = new ApiClient({ token: options.token });
      
      try {
        // Note: This endpoint might be different in the actual API
        // Using a generic approach based on typical REST patterns
        const result = await client.post(`/applications/${appId}/groups/${groupId}/invites/${inviteId}/accept`);
        formatter.success(`Invitation ${inviteId} accepted successfully`);
        formatter.log(result);
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : `Failed to accept invitation ${inviteId} for group ${groupId} in application ${appId}`);
        process.exit(1);
      }
    });

  return invite;
}