export interface Config {
  auth?: {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    expires_at?: number;
    user_id?: string;
  };
  default_account?: string;
  api_base_url?: string;
}

export interface AuthOptions {
  token?: string;
  appKey?: string;
  appSecret?: string;
}

export type OutputFormat = 'json' | 'table';

export interface CommandOptions {
  token?: string;
  format?: OutputFormat;
  quiet?: boolean;
  verbose?: boolean;
}