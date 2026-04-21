type SearcherFunction = (query: string, connectionId: string, orgId: string, ...args: any[]) => Promise<any[]>;

const searchers: Record<string, SearcherFunction> = {};

export function registerSearcher(name: string, searcher: SearcherFunction) {
  searchers[name] = searcher;
}

// Mock searchers for Github and Linear based on the instructions.
// In a fuller implementation, they would actually hit the GitHub/Linear search GraphQL/REST APIs.
export async function githubSearcher(query: string, connectionId: string, orgId: string, owner: string, repo: string) {
  console.log(`[Search] GitHub search for '${query}' in ${owner}/${repo}`);
  // Returns fetched abstract blocks matching query
  return [];
}

export async function linearSearcher(query: string, connectionId: string, orgId: string) {
  console.log(`[Search] Linear search for '${query}'`);
  // Returns fetched linear issues/projects blocks matching query
  return [];
}

// Register searchers
registerSearcher('github', githubSearcher);
registerSearcher('linear', linearSearcher);

export async function executeLiveSearch(provider: string, query: string, connectionId: string, orgId: string, ...args: any[]) {
  const searcher = searchers[provider];
  if (!searcher) throw new Error(`Searcher ${provider} not found`);
  return searcher(query, connectionId, orgId, ...args);
}
