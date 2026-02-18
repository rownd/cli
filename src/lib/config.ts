import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { Config } from '../types/config.js';

const CONFIG_DIR = join(homedir(), '.config', 'rownd');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export class ConfigManager {
  private config: Config = {};

  constructor() {
    this.load();
  }

  private ensureConfigDir(): void {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
  }

  private load(): void {
    if (!existsSync(CONFIG_FILE)) {
      return;
    }

    try {
      const data = readFileSync(CONFIG_FILE, 'utf-8');
      this.config = JSON.parse(data);
    } catch (error) {
      // If config file is corrupted, start fresh
      this.config = {};
    }
  }

  save(): void {
    this.ensureConfigDir();
    
    try {
      const data = JSON.stringify(this.config, null, 2);
      writeFileSync(CONFIG_FILE, data, { mode: 0o600 });
      chmodSync(CONFIG_FILE, 0o600);
    } catch (error) {
      throw new Error(`Failed to save config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  get(): Config {
    return this.config;
  }

  set(config: Partial<Config>): void {
    this.config = { ...this.config, ...config };
  }

  setAuth(auth: Config['auth']): void {
    this.config.auth = auth;
  }

  getAuth(): Config['auth'] {
    return this.config.auth;
  }

  clearAuth(): void {
    delete this.config.auth;
  }

  setDefaultAccount(accountId: string): void {
    this.config.default_account = accountId;
  }

  getDefaultAccount(): string | undefined {
    return this.config.default_account;
  }

  getApiBaseUrl(): string {
    return this.config.api_base_url || 'https://api.rownd.io';
  }

  clear(): void {
    this.config = {};
  }
}

export const config = new ConfigManager();