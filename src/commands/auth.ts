import { Command } from 'commander';
import { input, password } from '@inquirer/prompts';
import { config } from '../lib/config.js';
import { ApiClient } from '../lib/api-client.js';
import { createOutputFormatter } from '../lib/output.js';
import { handleApiError } from '../lib/utils.js';
import type { CommandOptions } from '../types/config.js';

export function createAuthCommand(): Command {
  const auth = new Command('auth')
    .description('Manage authentication');

  auth
    .command('login')
    .description('Authenticate with Rownd')
    .option('--token <token>', 'Bearer token to store')
    .action(async (options: { token?: string } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      
      try {
        let token = options.token;
        
        if (!token) {
          formatter.info('Interactive login is not yet implemented.');
          formatter.info('Please use --token flag or set ROWND_API_TOKEN environment variable.');
          token = await input({
            message: 'Enter your Rownd API bearer token:',
            validate: (input) => input.length > 0 || 'Token is required'
          });
        }
        
        // Validate token by making a test API call
        const client = new ApiClient({ token });
        try {
          await client.get('/me');
        } catch (error) {
          handleApiError(error);
        }
        
        // Store the token
        config.setAuth({
          access_token: token,
          token_type: 'Bearer',
        });
        config.save();
        
        formatter.success('Successfully authenticated with Rownd');
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : 'Authentication failed');
        process.exit(1);
      }
    });

  auth
    .command('logout')
    .description('Remove stored authentication')
    .action(async (options: CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      
      try {
        config.clearAuth();
        config.save();
        formatter.success('Successfully logged out');
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : 'Logout failed');
        process.exit(1);
      }
    });

  auth
    .command('status')
    .description('Show authentication status')
    .action(async (options: CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      
      try {
        const authConfig = config.getAuth();
        
        if (!authConfig?.access_token) {
          if (process.env.ROWND_API_TOKEN) {
            formatter.log({
              status: 'authenticated',
              method: 'environment_variable',
              source: 'ROWND_API_TOKEN'
            });
            return;
          }
          
          if (process.env.ROWND_APP_KEY && process.env.ROWND_APP_SECRET) {
            formatter.log({
              status: 'authenticated',
              method: 'app_credentials',
              source: 'environment_variables'
            });
            return;
          }
          
          formatter.log({
            status: 'not_authenticated',
            message: 'Run `rownd auth login` to authenticate'
          });
          return;
        }
        
        // Test the stored token
        const client = new ApiClient();
        try {
          const userInfo = await client.get('/me');
          formatter.log({
            status: 'authenticated',
            method: 'stored_token',
            user: userInfo
          });
        } catch (error) {
          formatter.log({
            status: 'authentication_expired',
            message: 'Stored authentication is no longer valid. Run `rownd auth login` to re-authenticate'
          });
        }
      } catch (error) {
        formatter.error(error instanceof Error ? error.message : 'Failed to check authentication status');
        process.exit(1);
      }
    });

  return auth;
}