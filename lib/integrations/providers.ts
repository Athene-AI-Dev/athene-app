// ─── Provider Categories ─────────────────────────────────────────────────────

export type ProviderCategory =
  | 'crm'
  | 'storage'
  | 'communication'
  | 'dev'
  | 'productivity'
  | 'data'

// ─── Provider Definition ─────────────────────────────────────────────────────

export interface ProviderDefinition {
  /** Nango provider_config_key — used in all getToken() calls */
  nangoKey: string
  /** Human-readable name shown in UI */
  displayName: string
  /** Path to icon in /public/integrations/<icon> */
  icon: string
  /** Category for grouping in integrations page */
  category: ProviderCategory
  /** What data objects this provider exposes */
  resources: string[]
  /** Whether this provider supports live search (Mode B) */
  supportsLiveSearch: boolean
  /** Whether this provider supports write operations (email send, calendar create, etc.) */
  supportsWrite: boolean
}

// ─── Provider Registry (Single Source of Truth) ──────────────────────────────

export const PROVIDER_REGISTRY = {
  // ── Microsoft ──────────────────────────────────────────────────────────────
  sharepoint: {
    nangoKey: 'sharepoint',
    displayName: 'SharePoint',
    icon: 'sharepoint.svg',
    category: 'storage',
    resources: ['documents', 'sites'],
    supportsLiveSearch: true,
    supportsWrite: false,
  },
  onedrive: {
    nangoKey: 'onedrive',
    displayName: 'OneDrive',
    icon: 'onedrive.svg',
    category: 'storage',
    resources: ['files'],
    supportsLiveSearch: true,
    supportsWrite: false,
  },
  outlook: {
    nangoKey: 'outlook',
    displayName: 'Outlook',
    icon: 'outlook.svg',
    category: 'communication',
    resources: ['emails'],
    supportsLiveSearch: true,
    supportsWrite: true,
  },
  ms_calendar: {
    nangoKey: 'ms-calendar',
    displayName: 'Outlook Calendar',
    icon: 'outlook.svg',
    category: 'productivity',
    resources: ['events'],
    supportsLiveSearch: false,
    supportsWrite: true,
  },

  // ── Google ─────────────────────────────────────────────────────────────────
  google_drive: {
    nangoKey: 'google-drive',
    displayName: 'Google Drive',
    icon: 'gdrive.svg',
    category: 'storage',
    resources: ['files', 'docs', 'sheets'],
    supportsLiveSearch: true,
    supportsWrite: false,
  },
  gmail: {
    nangoKey: 'gmail',
    displayName: 'Gmail',
    icon: 'gmail.svg',
    category: 'communication',
    resources: ['emails', 'threads'],
    supportsLiveSearch: true,
    supportsWrite: true,
  },
  google_calendar: {
    nangoKey: 'google-calendar',
    displayName: 'Google Calendar',
    icon: 'gcalendar.svg',
    category: 'productivity',
    resources: ['events'],
    supportsLiveSearch: false,
    supportsWrite: true,
  },

  // ── Atlassian ──────────────────────────────────────────────────────────────
  jira: {
    nangoKey: 'jira',
    displayName: 'Jira',
    icon: 'jira.svg',
    category: 'dev',
    resources: ['issues', 'comments'],
    supportsLiveSearch: true,
    supportsWrite: false,
  },
  confluence: {
    nangoKey: 'confluence',
    displayName: 'Confluence',
    icon: 'confluence.svg',
    category: 'productivity',
    resources: ['pages', 'spaces'],
    supportsLiveSearch: true,
    supportsWrite: false,
  },

  // ── CRM ────────────────────────────────────────────────────────────────────
  salesforce: {
    nangoKey: 'salesforce',
    displayName: 'Salesforce',
    icon: 'salesforce.svg',
    category: 'crm',
    resources: ['accounts', 'opportunities', 'cases'],
    supportsLiveSearch: true,
    supportsWrite: false,
  },
  hubspot: {
    nangoKey: 'hubspot',
    displayName: 'HubSpot',
    icon: 'hubspot.svg',
    category: 'crm',
    resources: ['contacts', 'companies', 'deals', 'notes'],
    supportsLiveSearch: true,
    supportsWrite: false,
  },

  // ── Dev / Project Management ───────────────────────────────────────────────
  github: {
    nangoKey: 'github',
    displayName: 'GitHub',
    icon: 'github.svg',
    category: 'dev',
    resources: ['issues', 'prs', 'wiki'],
    supportsLiveSearch: true,
    supportsWrite: false,
  },
  linear: {
    nangoKey: 'linear',
    displayName: 'Linear',
    icon: 'linear.svg',
    category: 'dev',
    resources: ['issues', 'projects', 'cycles'],
    supportsLiveSearch: true,
    supportsWrite: false,
  },

  // ── Communications ─────────────────────────────────────────────────────────
  slack: {
    nangoKey: 'slack',
    displayName: 'Slack',
    icon: 'slack.svg',
    category: 'communication',
    resources: ['channels', 'threads'],
    supportsLiveSearch: true,
    supportsWrite: false,
  },
  zendesk: {
    nangoKey: 'zendesk',
    displayName: 'Zendesk',
    icon: 'zendesk.svg',
    category: 'crm',
    resources: ['tickets', 'articles'],
    supportsLiveSearch: true,
    supportsWrite: false,
  },

  // ── Knowledge & Data ───────────────────────────────────────────────────────
  notion: {
    nangoKey: 'notion',
    displayName: 'Notion',
    icon: 'notion.svg',
    category: 'productivity',
    resources: ['pages', 'databases'],
    supportsLiveSearch: true,
    supportsWrite: false,
  },
  snowflake: {
    nangoKey: 'snowflake',
    displayName: 'Snowflake',
    icon: 'snowflake.svg',
    category: 'data',
    resources: ['tables', 'views'],
    supportsLiveSearch: true,
    supportsWrite: false,
  },
} as const satisfies Record<string, ProviderDefinition>

// ─── Derived Types ───────────────────────────────────────────────────────────

/** Union of all registry keys — the canonical way to reference a provider */
export type ProviderKey = keyof typeof PROVIDER_REGISTRY

// ─── Lookup Helpers ──────────────────────────────────────────────────────────

/** Get a specific provider definition by its registry key */
export function getProvider(key: ProviderKey): ProviderDefinition {
  return PROVIDER_REGISTRY[key]
}

/** Reverse-lookup: find a provider by its Nango provider_config_key */
export function getProviderByNangoKey(
  nangoKey: string,
): ProviderDefinition | undefined {
  return Object.values(PROVIDER_REGISTRY).find((p) => p.nangoKey === nangoKey)
}

/** Get all providers in a specific category */
export function getProvidersByCategory(
  category: ProviderCategory,
): ProviderDefinition[] {
  return Object.values(PROVIDER_REGISTRY).filter(
    (p) => p.category === category,
  )
}

/** Get all providers that support write operations */
export function getWriteProviders(): ProviderDefinition[] {
  return Object.values(PROVIDER_REGISTRY).filter((p) => p.supportsWrite)
}
