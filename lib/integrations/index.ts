import { ProviderKey } from './providers';
import { FetchedChunk } from './base';
import { hubspotSearch } from './hubspot/searcher';
import { salesforceSearch } from './salesforce/searcher';
import { snowflakeSearch } from './snowflake/searcher';
import { bigquerySearch } from './bigquery/searcher';
import { redshiftSearch } from './redshift/searcher';
import { lookerSearch } from './looker/searcher';
import { tableauSearch } from './tableau/searcher';
import { metabaseSearch } from './metabase/searcher';
import { dbtSearch } from './dbt/searcher';
import { powerbiSearch } from './powerbi/searcher';

import { snowflakeFetcher } from './snowflake/index';
import { bigqueryFetcher } from './bigquery/index';
import { redshiftFetcher } from './redshift/index';
import { lookerFetcher } from './looker/index';
import { tableauFetcher } from './tableau/index';
import { metabaseFetcher } from './metabase/index';
import { dbtFetcher } from './dbt/index';
import { powerbiFetcher } from './powerbi/index';

export * from './base';
export * from './providers';
export * from './indexing';

type SearcherFn = (connectionId: string, orgId: string, query: string, args?: any) => Promise<FetchedChunk[]>;
type FetcherFn  = (connectionId: string, orgId: string, ...args: any[]) => Promise<FetchedChunk[]>;

const SEARCHERS: Partial<Record<ProviderKey | string, SearcherFn>> = {
  hubspot: hubspotSearch,
  salesforce: salesforceSearch,
  snowflake: snowflakeSearch,
  bigquery: bigquerySearch,
  redshift: redshiftSearch,
  looker: lookerSearch,
  tableau: tableauSearch,
  metabase: metabaseSearch,
  dbt: dbtSearch,
  powerbi: powerbiSearch,
};

const FETCHERS: Partial<Record<ProviderKey | string, FetcherFn>> = {
  snowflake: snowflakeFetcher,
  bigquery: bigqueryFetcher,
  redshift: redshiftFetcher,
  looker: lookerFetcher,
  tableau: tableauFetcher,
  metabase: metabaseFetcher,
  dbt: dbtFetcher,
  powerbi: powerbiFetcher,
};

export function getSearcher(provider: ProviderKey | string): SearcherFn | null {
  return SEARCHERS[provider] ?? null;
}

export function getProvider(provider: ProviderKey | string): FetcherFn | null {
  return FETCHERS[provider] ?? null;
}
