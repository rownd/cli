import { Command } from 'commander';
import { input, password } from '@inquirer/prompts';
import { config } from '../lib/config.js';
import { ApiClient } from '../lib/api-client.js';
import { createOutputFormatter } from '../lib/output.js';
import { handleApiError } from '../lib/utils.js';
import { startOAuthFlow, refreshAccessToken } from '../lib/auth.js';
import type { CommandOptions } from '../types/config.js';

export function createAuthCommand(): Command {
  const auth = new Command('auth')
    .description('Manage authentication');

  auth
    .command('login')
    .description('Authenticate with Rownd')
    .option('--token <token>', 'Bearer token to store (fallback for CI/CD)')
    .option('--app-key <appKey>', 'Rownd app key for OAuth flow')
    .action(async (options: { token?: string; appKey?: string } & CommandOptions) => {
      const formatter = createOutputFormatter(options.format, options.quiet);
      
      try {
        // If token is provided, use manual token authentication (fallback for CI/CD)
        if (options.token) {
          const client = new ApiClient({ token: options.token });
          try {
            await client.get('/me');
          } catch (error) {
            handleApiError(error);
          }
          
          config.setAuth({
            access_token: options.token,
            token_type: 'Bearer',
          });
          config.save();
          
          formatter.success('Successfully authenticated with Rownd using bearer token');
          return;
        }

        // Try browser-based OAuth flow
        try {
          const appKey = options.appKey || process.env.ROWND_APP_KEY;
          
          if (!appKey) {
            formatter.info('🔑 App key required for browser-based authentication');
            formatter.info('You can either:');
            formatter.info('  1. Provide --app-key flag');
            formatter.info('  2. Set ROWND_APP_KEY environment variable');  
            formatter.info('  3. Use --token flag with a bearer token');
            formatter.info('\nContact Rownd support to get CLI application credentials.');
            process.exit(1);
          }

          formatter.info('🚀 Starting browser-based OAuth authentication...');
          const tokens = await startOAuthFlow(appKey);

          // Store the tokens
          config.setAuth({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_type: tokens.token_type || 'Bearer',
            expires_at: tokens.expires_at,
            user_id: tokens.user_id
          });
          config.save();

          // Validate the token by making a test API call
          const client = new ApiClient();
          try {
            const userInfo = await client.get('/me');
            formatter.success('✅ Successfully authenticated with Rownd!');
            if (userInfo && typeof userInfo === 'object' && 'email' in userInfo) {
              formatter.info(`Logged in as: ${(userInfo as any).email || (userInfo as any).name || 'User'}`);
            }
          } catch (error) {
            formatter.warn('Authentication completed but unable to fetch user info');
            formatter.success('✅ Successfully authenticated with Rownd!');
          }
          
        } catch (error) {
          if (error instanceof Error && error.message.includes('App key is required')) {
            // Fall back to manual token entry
            formatter.info('\n🔐 Browser-based authentication not available.');
            formatter.info('Please enter your Rownd API bearer token manually:');
            
            const token = await input({
              message: 'Enter your Rownd API bearer token:',
              validate: (input) => input.length > 0 || 'Token is required'
            });
            
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
          } else {
            throw error;
          }
        }
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