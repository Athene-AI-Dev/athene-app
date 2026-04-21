/**
 * Provider Registry for Communications Integrations
 */

export interface ProviderConfig {
  name: string;
  configKey: string;
}

export const providers: ProviderConfig[] = [
  { name: 'Slack', configKey: 'slack' },
  { name: 'Zendesk', configKey: 'zendesk' },
];

export function getProviderConfig(name: string): ProviderConfig | undefined {
  return providers.find((p) => p.name.toLowerCase() === name.toLowerCase());
}
