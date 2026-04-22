/**
 * Provider Registry for Communications Integrations
 */

export type ProviderKey = 'slack' | 'zendesk' | 'google' | 'microsoft';

export interface ProviderConfig {
  name: string;
  nangoIntegrationId: string;
}

export const providers: Record<ProviderKey, ProviderConfig> = {
  slack: { 
    name: 'Slack', 
    nangoIntegrationId: 'slack' 
  },
  zendesk: { 
    name: 'Zendesk', 
    nangoIntegrationId: 'zendesk' 
  },
  google: {
    name: 'Google',
    nangoIntegrationId: 'google'
  },
  microsoft: {
    name: 'Microsoft',
    nangoIntegrationId: 'microsoft'
  }
};

/**
 * Retrieves the configuration for a given provider key.
 */
export function getProviderConfig(key: ProviderKey): ProviderConfig {
  const config = providers[key];
  if (!config) {
    throw new Error(`[providers] Unknown provider key: ${key}`);
  }
  return config;
}
