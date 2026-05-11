export type ProviderKey =
  | 'google'
  | 'microsoft'
  | 'google_drive'
  | 'gmail'
  | 'google_calendar'
  | 'sharepoint'
  | 'onedrive'
  | 'outlook'
  | 'ms_calendar'
  | 'slack'
  | 'hubspot'
  | 'notion'
  | 'jira'
  | 'confluence'
  | 'salesforce'
  | 'snowflake'
  | 'github'
  | 'linear'
  | 'zendesk';

export interface ProviderCapabilities {
  canFetch: boolean;
  canSearch: boolean;
  canWrite: boolean;
  requiresScopes: string[];
}

export interface ProviderConfig {
  key: ProviderKey;
  displayName: string;
  description: string;
  icon: string;
  category: "productivity" | "crm" | "devtools" | "communication" | "data";
  nangoIntegrationId: string;
  resources: string[];
  capabilities: ProviderCapabilities;
  hidden?: boolean;
}

export const PROVIDER_REGISTRY: Record<ProviderKey, ProviderConfig> = {
  google: {
    key: 'google',
    displayName: 'Google Workspace',
    description: 'Gmail, Drive, and Calendar',
    icon: '/integrations/gdrive.svg',
    category: 'productivity',
    nangoIntegrationId: 'google',
    resources: ['gmail', 'drive', 'calendar'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: false,
      requiresScopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/calendar.readonly'],
    },
    hidden: true,
  },
  microsoft: {
    key: 'microsoft',
    displayName: 'Microsoft 365',
    description: 'Outlook, OneDrive, and SharePoint',
    icon: '/integrations/outlook.svg',
    category: 'productivity',
    nangoIntegrationId: 'microsoft',
    resources: ['messages', 'files', 'sites'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: false,
      requiresScopes: ['Mail.Read', 'Files.Read.All', 'Sites.Read.All'],
    },
    hidden: true,
  },
  google_drive: {
    key: 'google_drive',
    displayName: 'Google Drive',
    description: 'Sync and search Drive files and documents',
    icon: '/integrations/gdrive.svg',
    category: 'productivity',
    nangoIntegrationId: 'google-drive',
    resources: ['files', 'folders'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: false,
      requiresScopes: ['https://www.googleapis.com/auth/drive.readonly'],
    },
  },
  gmail: {
    key: 'gmail',
    displayName: 'Gmail',
    description: 'Sync and search emails and threads',
    icon: '/integrations/gmail.svg',
    category: 'communication',
    nangoIntegrationId: 'google-mail',
    resources: ['messages', 'threads'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: false,
      requiresScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    },
  },
  google_calendar: {
    key: 'google_calendar',
    displayName: 'Google Calendar',
    description: 'Sync and search calendar events',
    icon: '/integrations/gcalendar.svg',
    category: 'productivity',
    nangoIntegrationId: 'google-calendar',
    resources: ['events'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: false,
      requiresScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    },
  },
  sharepoint: {
    key: 'sharepoint',
    displayName: 'SharePoint',
    description: 'Sync and search SharePoint sites and documents',
    icon: '/integrations/sharepoint.svg',
    category: 'productivity',
    nangoIntegrationId: 'microsoft-sharepoint',
    resources: ['sites', 'driveItems'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: false,
      requiresScopes: ['Sites.Read.All', 'Files.Read.All'],
    },
  },
  onedrive: {
    key: 'onedrive',
    displayName: 'OneDrive',
    description: 'Sync and search OneDrive files',
    icon: '/integrations/onedrive.svg',
    category: 'productivity',
    nangoIntegrationId: 'microsoft-onedrive',
    resources: ['driveItems'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: false,
      requiresScopes: ['Files.Read.All'],
    },
  },
  outlook: {
    key: 'outlook',
    displayName: 'Outlook',
    description: 'Sync and search Outlook emails',
    icon: '/integrations/outlook.svg',
    category: 'communication',
    nangoIntegrationId: 'microsoft-outlook',
    resources: ['messages'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: false,
      requiresScopes: ['Mail.Read'],
    },
  },
  ms_calendar: {
    key: 'ms_calendar',
    displayName: 'Outlook Calendar',
    description: 'Sync and search Outlook calendar events',
    icon: '/integrations/mscalendar.svg',
    category: 'productivity',
    nangoIntegrationId: 'microsoft-calendar',
    resources: ['events'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: false,
      requiresScopes: ['Calendars.Read'],
    },
  },
  slack: {
    key: 'slack',
    displayName: 'Slack',
    description: 'Index public channels, threads, and search messages live',
    icon: '/integrations/slack.svg',
    category: 'communication',
    nangoIntegrationId: 'slack',
    resources: ['channels', 'messages', 'threads'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: false,
      requiresScopes: ['channels:history', 'channels:read', 'groups:history', 'groups:read'],
    },
  },
  hubspot: {
    key: 'hubspot',
    displayName: 'HubSpot',
    description: 'Sync contacts, companies, deals, and notes',
    icon: '/integrations/hubspot.svg',
    category: 'crm',
    nangoIntegrationId: 'hubspot',
    resources: ['contacts', 'companies', 'deals', 'notes'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: true,
      requiresScopes: ['crm.objects.contacts.read', 'crm.objects.companies.read', 'crm.objects.deals.read'],
    },
  },
  notion: {
    key: 'notion',
    displayName: 'Notion',
    description: 'Sync workspace pages, databases, and wikis',
    icon: '/integrations/notion.svg',
    category: 'productivity',
    nangoIntegrationId: 'notion',
    resources: ['pages', 'databases', 'blocks'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: false,
      requiresScopes: [],
    },
  },
  jira: {
    key: 'jira',
    displayName: 'Jira',
    description: 'Sync issues, sprints, and project boards',
    icon: '/integrations/jira.svg',
    category: 'devtools',
    nangoIntegrationId: 'jira',
    resources: ['issues', 'projects', 'boards'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: true,
      requiresScopes: ['read:jira-work', 'write:jira-work'],
    },
  },
  confluence: {
    key: 'confluence',
    displayName: 'Confluence',
    description: 'Sync spaces, pages, and knowledge base articles',
    icon: '/integrations/confluence.svg',
    category: 'devtools',
    nangoIntegrationId: 'confluence',
    resources: ['pages', 'spaces', 'blogs'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: false,
      requiresScopes: ['read:confluence-content.summary', 'read:confluence-space.summary'],
    },
  },
  salesforce: {
    key: 'salesforce',
    displayName: 'Salesforce',
    description: 'Sync accounts, opportunities, and cases',
    icon: '/integrations/salesforce.svg',
    category: 'crm',
    nangoIntegrationId: 'salesforce',
    resources: ['Account', 'Opportunity', 'Case', 'Contact'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: true,
      requiresScopes: ['api', 'refresh_token', 'offline_access'],
    },
  },
  snowflake: {
    key: 'snowflake',
    displayName: 'Snowflake',
    description: 'Query schemas and sync table data for BI analysis',
    icon: '/integrations/snowflake.svg',
    category: 'data',
    nangoIntegrationId: 'snowflake',
    resources: ['tables', 'views', 'schemas'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: false,
      requiresScopes: [],
    },
  },
  github: {
    key: 'github',
    displayName: 'GitHub',
    description: 'Sync repos, issues, PRs, wikis, and search code',
    icon: '/integrations/github.svg',
    category: 'devtools',
    nangoIntegrationId: 'github',
    resources: ['repos', 'issues', 'pull_requests', 'wiki'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: true,
      requiresScopes: ['repo', 'read:user', 'user:email'],
    },
  },
  linear: {
    key: 'linear',
    displayName: 'Linear',
    description: 'Sync issues, cycles, and projects',
    icon: '/integrations/linear.svg',
    category: 'devtools',
    nangoIntegrationId: 'linear',
    resources: ['issues', 'projects', 'cycles', 'teams'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: true,
      requiresScopes: ['read', 'write'],
    },
  },
  zendesk: {
    key: 'zendesk',
    displayName: 'Zendesk',
    description: 'Sync support tickets and help center articles',
    icon: '/integrations/zendesk.svg',
    category: 'communication',
    nangoIntegrationId: 'zendesk',
    resources: ['tickets', 'articles', 'users'],
    capabilities: {
      canFetch: true,
      canSearch: true,
      canWrite: true,
      requiresScopes: ['tickets:read', 'help_center:read', 'users:read'],
    },
  },
};

/**
 * Returns the configuration for a specific provider.
 */
export function getProvider(key: ProviderKey): ProviderConfig {
  return PROVIDER_REGISTRY[key];
}

/**
 * Legacy alias for getProvider.
 */
export function getProviderConfig(key: ProviderKey): ProviderConfig {
  return getProvider(key);
}

/**
 * Returns a provider configuration by its Nango unique key.
 */
export function getProviderByNangoKey(nangoKey: string): ProviderConfig | undefined {
  return Object.values(PROVIDER_REGISTRY).find((p) => p.nangoIntegrationId === nangoKey);
}

/**
 * Returns all providers belonging to a specific category.
 */
export function getProvidersByCategory(category: string): ProviderConfig[] {
  return Object.values(PROVIDER_REGISTRY).filter((p) => p.category === category);
}

/**
 * Returns all providers that support write operations.
 */
export function getWriteProviders(): ProviderConfig[] {
  return Object.values(PROVIDER_REGISTRY).filter((p) => p.capabilities.canWrite);
}

/**
 * Returns all registered providers.
 */
export function getAllProviders(): ProviderConfig[] {
  return Object.values(PROVIDER_REGISTRY).filter((p) => !p.hidden);
}
/**
 * List of all registered providers.
 */
export const PROVIDERS = Object.values(PROVIDER_REGISTRY);
