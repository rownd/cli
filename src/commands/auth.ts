import { Command } from 'commander';
import { config } from '../lib/config.js';
import { ApiClient } from '../lib/api-client.js';
import { createOutputFormatter } from '../lib/output.js';
import { handleApiError } from '../lib/utils.js';
import { startInteractiveLogin } from '../lib/auth.js';
import type { CommandOptions } from '../types/config.js';

export function createAuthCommand(): Command {
  const auth = new Command('auth').description('Manage CLI authentication');

  auth
    .command('login')
    .description('Sign in to Rownd')
    .option('--token <token>', 'Use a bearer token directly (for CI/CD)')
    .action(async (options: { token?: string } & CommandOptions) => {
      const fmt = createOutputFormatter(options.format, options.quiet);

      try {
        if (options.token || process.env.ROWND_API_TOKEN) {
          // Manual token flow — CI/CD fallback
          const token = options.token || process.env.ROWND_API_TOKEN!;
          const client = new ApiClient({ token });
          try { await client.get('/me'); } catch (e) { handleApiError(e); }

          config.setAuth({ access_token: token, token_type: 'Bearer' });
          config.save();
          fmt.success('Authenticated via bearer token.');
          return;
        }

        // Interactive browser flow
        const tokens = await startInteractiveLogin();

        config.setAuth({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_type: 'Bearer',
          expires_at: tokens.expires_at,
        });
        config.save();
        fmt.success('✅ Successfully signed in to Rownd!');
      } catch (err) {
        fmt.error(err instanceof Error ? err.message : 'Authentication failed');
        process.exit(1);
      }
    });

  auth
    .command('logout')
    .description('Sign out and clear stored credentials')
    .action(async (options: CommandOptions) => {
      const fmt = createOutputFormatter(options.format, options.quiet);
      config.clearAuth();
      config.save();
      fmt.success('Signed out.');
    });

  auth
    .command('status')
    .description('Show current authentication status')
    .action(async (options: CommandOptions) => {
      const fmt = createOutputFormatter(options.format, options.quiet);
      const authConfig = config.getAuth();

      if (!authConfig?.access_token && !process.env.ROWND_API_TOKEN) {
        fmt.log({ status: 'not_authenticated', hint: 'Run `rownd auth login`' });
        return;
      }

      const client = new ApiClient();
      try {
        const me = await client.get('/me');
        fmt.log({ status: 'authenticated', user: me });
      } catch {
        fmt.log({ status: 'expired', hint: 'Run `rownd auth login` to re-authenticate' });
      }
    });

  return auth;
}
