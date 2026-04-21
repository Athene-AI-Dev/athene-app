export interface FetchedChunk {
  id: string;
  title?: string;
  content: string;
  url?: string;
  provider: 'github' | 'linear';
  type: string;
  createdAt?: string;
  metadata?: Record<string, any>;
}
