// Base API types
export interface ApiError {
  error: string;
  message?: string;
  status?: number;
}

export interface Application {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  account: string;
  account_url: string;
  url: string;
  config?: ApplicationConfig;
  last_modified: string;
  updated_at: string;
  updated_by?: string;
}

export interface ApplicationConfig {
  capabilities?: any;
  customizations?: any;
  default_user_id_format?: string;
  hub?: any;
  web?: any;
  bottom_sheet?: any;
  extensions?: any;
  subdomain?: string;
  default_link_domain_id?: string;
  automations?: Automation[];
  default_redirect_url?: string;
  magic_links?: any;
}

export interface ApplicationList {
  total_results: number;
  results: Application[];
}

export interface ApplicationCredential {
  client_id: string;
  client_secret?: string;
  name?: string;
  created_at: string;
  updated_at: string;
}

export interface ApplicationCredentialList {
  total_results: number;
  results: ApplicationCredential[];
}

export interface ApplicationSchema {
  fields: Record<string, any>;
  groups?: Record<string, any>;
}

export interface ApplicationSchemaResponse {
  schema: ApplicationSchema;
}

export interface AppUserData {
  user_id: string;
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AppUserDataList {
  total_results: number;
  results: AppUserData[];
  has_more: boolean;
  next_cursor?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  meta?: Record<string, any>;
  created_at: string;
  updated_at: string;
  app_id: string;
  admission_policy: string;
}

export interface GroupList {
  total_results: number;
  results: Group[];
}

export interface GroupMember {
  user_id: string;
  group_id: string;
  roles?: string[];
  joined_at: string;
}

export interface GroupInvite {
  id: string;
  group_id: string;
  inviter_id: string;
  email?: string;
  expires_at: string;
  created_at: string;
  status: string;
}

export interface Account {
  id: string;
  name: string;
  slug?: string;
  created_at: string;
  updated_at: string;
}

export interface AccountList {
  total_results: number;
  results: Account[];
}

export interface TeamMember {
  user_id: string;
  email: string;
  role: string;
  joined_at: string;
  status: string;
}

export interface TeamMemberList {
  total_results: number;
  results: TeamMember[];
}

export interface Automation {
  id: string;
  name: string;
  description?: string;
  type: string;
  enabled: boolean;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ApplicationAnalytics {
  data: Array<{
    date: string;
    metrics: Record<string, number>;
  }>;
  summary: Record<string, number>;
}

export interface ApplicationDomain {
  id: string;
  domain: string;
  purpose: string;
  status: string;
  created_at: string;
}

export interface ApplicationDomainList {
  total_results: number;
  results: ApplicationDomain[];
}

export interface ApplicationLink {
  id: string;
  name: string;
  url: string;
  target_url: string;
  created_at: string;
  updated_at: string;
}

export interface ApplicationLinkList {
  total_results: number;
  results: ApplicationLink[];
}

export interface OIDCClient {
  id: string;
  client_id: string;
  client_secret?: string;
  name: string;
  redirect_uris: string[];
  created_at: string;
  updated_at: string;
}

export interface OIDCClientList {
  total_results: number;
  results: OIDCClient[];
}