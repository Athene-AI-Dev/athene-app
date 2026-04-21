/**
 * Canonical provider keys used across all Nango integrations.
 * Every fetcher references a ProviderKey when requesting tokens.
 */
export type ProviderKey =
  | 'google'
  | 'microsoft'
  | 'slack'
  | 'hubspot'
  | 'notion'
  | 'jira'
  | 'confluence'
  | 'salesforce'
  | 'snowflake'
  | 'github'

/**
 * Human-readable display names for each provider.
 */
export const PROVIDER_DISPLAY_NAMES: Record<ProviderKey, string> = {
  google:       'Google Workspace',
  microsoft:    'Microsoft 365',
  slack:        'Slack',
  hubspot:      'HubSpot',
  notion:       'Notion',
  jira:         'Jira',
  confluence:   'Confluence',
  salesforce:   'Salesforce',
  snowflake:    'Snowflake',
  github:       'GitHub',
}
