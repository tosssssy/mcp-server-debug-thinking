export interface SearchQuery {
  errorType?: string;
  keywords?: string[];
  language?: string;
  framework?: string;
  tags?: string[];
  confidence_threshold?: number;
  searchMode?: "exact" | "fuzzy";
  keywordLogic?: "AND" | "OR";
  includeDebugInfo?: boolean;
}

export interface PatternMatch {
  sessionId: string;
  similarity: number;
  problem: {
    description: string;
    errorMessage: string;
    actualBehavior: string;
    expectedBehavior: string;
  };
  solution: {
    hypothesis: string;
    changes: Array<{
      file: string;
      reasoning: string;
    }>;
    learning: string;
  };
  metadata: {
    confidence: number;
    language?: string;
    framework?: string;
    tags?: string[];
    createdAt: string;
    timesApplied?: number;
    successRate?: number;
  };
  suggestedApproach?: string;
  debugInfo?: {
    totalSessionsSearched: number;
    keywordMatches: number;
    filteredByMetadata: number;
    filteredByConfidence: number;
    errorTypeExtracted?: string;
    searchMode: string;
    metadataOnlySearch?: boolean;
  };
}