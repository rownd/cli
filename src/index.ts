#!/usr/bin/env node

import { Command } from 'commander';
import { createAuthCommand } from './commands/auth.js';
import { createAppCommand } from './commands/app.js';
import { createAppCredsCommand } from './commands/app-creds.js';
import { createUserCommand } from './commands/user.js';
import { createGroupCommand } from './commands/group.js';
import { createGroupMemberCommand } from './commands/group-member.js';
import { createGroupInviteCommand } from './commands/group-invite.js';
import { createAnalyticsCommand } from './commands/analytics.js';
import { handleApiError } from './lib/utils.js';

const program = new Command();

program
  .name('rownd')
  .description('Command-line interface for the Rownd authentication platform')
  .version('1.0.0')
  .option('--token <token>', 'Bearer token for authentication')
  .option('--format <format>', 'Output format (json|table)', 'json')
  .option('--quiet', 'Suppress non-essential output')
  .option('--verbose', 'Show additional debug information')
  .hook('preAction', (thisCommand) => {
    // Pass global options down to subcommands
    const opts = thisCommand.opts();
    if (opts.token) process.env.CLI_TOKEN = opts.token;
    if (opts.format) process.env.CLI_FORMAT = opts.format;
    if (opts.quiet) process.env.CLI_QUIET = 'true';
    if (opts.verbose) process.env.CLI_VERBOSE = 'true';
  });

// Add commands
program.addCommand(createAuthCommand());

const app = createAppCommand();
app.addCommand(createAppCredsCommand());
program.addCommand(app);

program.addCommand(createUserCommand());

const group = createGroupCommand();
group.addCommand(createGroupMemberCommand());
group.addCommand(createGroupInviteCommand());
program.addCommand(group);

program.addCommand(createAnalyticsCommand());

// Add help examples
program.addHelpText('after', `
Examples:
  $ rownd auth login --token your_token_here
  $ rownd app list --account your_account_id
  $ rownd app create --name "My App" --account your_account_id
  $ rownd user list my-app-id --lookup "email:john@example.com"
  $ rownd app creds create my-app-id --name "API Credentials"
  $ rownd group create my-app-id --name "Beta Users"
  $ rownd group member add my-app-id group-id user-id
  $ rownd analytics get my-app-id --start-date 2024-01-01 --end-date 2024-01-31
  
Authentication:
  The CLI supports multiple authentication methods in order of precedence:
  1. --token flag
  2. ROWND_API_TOKEN environment variable
  3. Stored credentials from \`rownd auth login\`
  
For more information, visit: https://docs.rownd.io/cli
`);

// Global error handler
process.on('uncaughtException', (error) => {
  console.error('✗ Unexpected error:', error.message);
  if (process.env.CLI_VERBOSE === 'true') {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('✗ Unhandled promise rejection:', reason);
  if (process.env.CLI_VERBOSE === 'true' && reason instanceof Error) {
    console.error(reason.stack);
  }
  process.exit(1);
});

// Parse command line arguments
try {
  await program.parseAsync(process.argv);
} catch (error) {
  try {
    handleApiError(error);
  } catch (handledError) {
    const message = handledError instanceof Error ? handledError.message : String(handledError);
    console.error('✗', message);
    if (process.env.CLI_VERBOSE === 'true' && handledError instanceof Error) {
      console.error(handledError.stack);
    }
    process.exit(1);
  }
}