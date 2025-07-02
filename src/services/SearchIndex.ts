import { DebugSession, CodeThinkingStep, CodeChange } from '../types/debug.js';
import { SearchQuery, PatternMatch } from '../types/search.js';
import { 
  ERROR_TYPE_EXACT_MATCH_SCORE,
  ERROR_TYPE_PARTIAL_MATCH_SCORE,
  ERROR_TYPE_SIMILARITY_THRESHOLD,
  KEYWORD_MATCH_SCORE,
  KEYWORD_AND_PARTIAL_SCORE,
  METADATA_ONLY_BASE_SCORE,
  DEFAULT_BASE_SCORE,
  RECENT_SESSION_BOOST,
  RECENT_SESSION_DAYS,
  SOMEWHAT_RECENT_SESSION_BOOST,
  SOMEWHAT_RECENT_SESSION_DAYS,
  HIGH_SUCCESS_RATE_THRESHOLD,
  HIGH_SUCCESS_RATE_BOOST,
  HIGH_SIMILARITY_THRESHOLD,
  DEFAULT_SEARCH_MODE,
  DEFAULT_KEYWORD_LOGIC
} from '../constants.js';
import { logger } from '../utils/logger.js';

interface IndexEntry {
  sessionId: string;
  session: DebugSession;
  searchableText: string;
  errorType?: string;
}

export class SearchIndex {
  private index: Map<string, IndexEntry> = new Map();

  public addSession(sessionId: string, session: DebugSession): void {
    const searchableText = this.extractSearchableText(session);
    const errorType = this.extractErrorType(session.problem?.errorMessage);
    
    this.index.set(sessionId, {
      sessionId,
      session,
      searchableText,
      errorType
    });
    
    logger.dim(`   📚 Added to index: ${sessionId} (errorType: ${errorType || 'none'})`);
  }

  public removeSession(sessionId: string): void {
    this.index.delete(sessionId);
  }

  public search(query: SearchQuery, limit: number = 10): PatternMatch[] {
    const matches: Array<{ sessionId: string; similarity: number; indexEntry: IndexEntry }> = [];
    const debugInfo = {
      totalSessionsSearched: this.index.size,
      keywordMatches: 0,
      filteredByMetadata: 0,
      filteredByConfidence: 0,
      searchMode: query.searchMode || DEFAULT_SEARCH_MODE,
      metadataOnlySearch: !query.errorType && (!query.keywords || query.keywords.length === 0)
    };
    
    for (const [sessionId, indexEntry] of this.index) {
      const similarity = this.calculateSimilarity(query, indexEntry);
      
      if (similarity > 0) {
        if (query.keywords && query.keywords.length > 0 && similarity > 0) {
          debugInfo.keywordMatches++;
        }
        
        const filterResult = this.matchesFilters(query, indexEntry, debugInfo);
        if (filterResult) {
          matches.push({ sessionId, similarity, indexEntry });
        }
      }
    }
    
    matches.sort((a, b) => b.similarity - a.similarity);
    
    return matches.slice(0, limit).map(match => 
      this.toPatternMatch(match, query, debugInfo)
    );
  }

  private extractSearchableText(session: DebugSession): string {
    const texts: string[] = [];
    
    if (session.problem) {
      texts.push(
        session.problem.description,
        session.problem.errorMessage || '',
        session.problem.expectedBehavior,
        session.problem.actualBehavior
      );
    }
    
    for (const step of session.steps) {
      if (step.hypothesis) {
        texts.push(step.hypothesis.cause);
        texts.push(...step.hypothesis.affectedCode);
      }
      
      if (step.experiment) {
        for (const change of step.experiment.changes) {
          texts.push(change.reasoning);
        }
      }
      
      if (step.result) {
        texts.push(step.result.learning);
      }
    }
    
    return texts.join(' ').toLowerCase();
  }

  private extractErrorType(errorMessage?: string): string | undefined {
    if (!errorMessage) return undefined;
    
    const patterns = [
      /Error:\s*(\w+Error)/i,
      /Error:\s*(\w+Exception)/i,
      /^(\w+Error):/,
      /^(\w+Exception):/,
      /\b(\w+Error)\b/,
      /\b(\w+Exception)\b/,
      /\b(ECONNREFUSED|ENOENT|EACCES|ETIMEDOUT|EADDRINUSE)\b/,
      /UnhandledPromiseRejectionWarning:\s*(\w+)/,
      /at\s+\w+\s+\(.*?(\w+Error)/
    ];
    
    for (const pattern of patterns) {
      const match = errorMessage.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return undefined;
  }

  private calculateSimilarity(query: SearchQuery, indexEntry: IndexEntry): number {
    let score = 0;
    const searchMode = query.searchMode || DEFAULT_SEARCH_MODE;
    const keywordLogic = query.keywordLogic || DEFAULT_KEYWORD_LOGIC;
    
    // Error type matching
    if (query.errorType && indexEntry.errorType) {
      const queryError = query.errorType.toLowerCase();
      const indexError = indexEntry.errorType.toLowerCase();
      
      if (searchMode === "exact") {
        if (queryError === indexError) {
          score += ERROR_TYPE_EXACT_MATCH_SCORE;
        }
      } else {
        if (queryError === indexError) {
          score += ERROR_TYPE_EXACT_MATCH_SCORE;
        } else if (indexError.includes(queryError) || queryError.includes(indexError)) {
          score += ERROR_TYPE_PARTIAL_MATCH_SCORE;
        } else {
          const similarity = this.calculateStringSimilarity(queryError, indexError);
          if (similarity > ERROR_TYPE_SIMILARITY_THRESHOLD) {
            score += 0.2 * similarity;
          }
        }
      }
    }
    
    // Keyword matching
    if (query.keywords && query.keywords.length > 0) {
      const searchableText = indexEntry.searchableText;
      let keywordMatches = 0;
      const totalKeywords = query.keywords.length;
      
      for (const keyword of query.keywords) {
        const lowerKeyword = keyword.toLowerCase();
        if (searchMode === "exact") {
          const wordBoundaryRegex = new RegExp(`\\b${lowerKeyword}\\b`);
          if (wordBoundaryRegex.test(searchableText)) {
            keywordMatches++;
          }
        } else {
          if (searchableText.includes(lowerKeyword)) {
            keywordMatches++;
          }
        }
      }
      
      if (keywordLogic === "AND") {
        if (keywordMatches === totalKeywords) {
          score += KEYWORD_MATCH_SCORE;
        } else {
          score += (keywordMatches / totalKeywords) * KEYWORD_AND_PARTIAL_SCORE;
        }
      } else {
        if (keywordMatches > 0) {
          score += (keywordMatches / totalKeywords) * KEYWORD_MATCH_SCORE;
        }
      }
    }
    
    // Boost score for recent sessions
    const session = indexEntry.session;
    const daysSinceCreated = (Date.now() - new Date(session.startTime).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated < RECENT_SESSION_DAYS) {
      score += RECENT_SESSION_BOOST;
    } else if (daysSinceCreated < SOMEWHAT_RECENT_SESSION_DAYS) {
      score += SOMEWHAT_RECENT_SESSION_BOOST;
    }
    
    // Boost score for high success rate
    const successRate = session.steps.filter((s: CodeThinkingStep) => s.result?.success).length / session.steps.length;
    if (successRate > HIGH_SUCCESS_RATE_THRESHOLD) {
      score += HIGH_SUCCESS_RATE_BOOST;
    }
    
    // If only metadata criteria are provided
    if (!query.errorType && (!query.keywords || query.keywords.length === 0)) {
      if (query.language || query.framework) {
        score = METADATA_ONLY_BASE_SCORE;
      } else {
        score = DEFAULT_BASE_SCORE;
      }
    }
    
    return Math.min(score, 1.0);
  }
  
  private calculateStringSimilarity(str1: string, str2: string): number {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1.0;
    
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }
  
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private matchesFilters(query: SearchQuery, indexEntry: IndexEntry, debugInfo?: any): boolean {
    const session = indexEntry.session;
    
    // Language filter
    if (query.language) {
      if (session.metadata?.language) {
        if (query.language.toLowerCase() !== session.metadata.language.toLowerCase()) {
          if (debugInfo) debugInfo.filteredByMetadata++;
          return false;
        }
      }
    }
    
    // Framework filter
    if (query.framework) {
      if (session.metadata?.framework) {
        if (query.framework.toLowerCase() !== session.metadata.framework.toLowerCase()) {
          if (debugInfo) debugInfo.filteredByMetadata++;
          return false;
        }
      }
    }
    
    // Tags filter
    if (query.tags && query.tags.length > 0) {
      if (session.metadata?.tags && session.metadata.tags.length > 0) {
        const sessionTags = session.metadata.tags.map((t: string) => t.toLowerCase());
        const queryTags = query.tags.map(t => t.toLowerCase());
        const hasMatchingTag = queryTags.some(tag => sessionTags.includes(tag));
        
        if (!hasMatchingTag) {
          if (debugInfo) debugInfo.filteredByMetadata++;
          return false;
        }
      }
    }
    
    // Confidence threshold filter
    if (query.confidence_threshold !== undefined) {
      const avgConfidence = this.getAverageConfidence(session);
      if (avgConfidence < query.confidence_threshold) {
        if (debugInfo) debugInfo.filteredByConfidence++;
        return false;
      }
    }
    
    return true;
  }

  private getAverageConfidence(session: DebugSession): number {
    const confidences = session.steps
      .filter(step => step.hypothesis?.confidence !== undefined)
      .map(step => step.hypothesis!.confidence);
    
    if (confidences.length === 0) return 0;
    
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  private toPatternMatch(
    match: { sessionId: string; similarity: number; indexEntry: IndexEntry }, 
    query: SearchQuery, 
    debugInfo?: any
  ): PatternMatch {
    const session = match.indexEntry.session;
    const successfulStep = session.steps.find((step: CodeThinkingStep) => step.result?.success);
    const lastStep = session.steps[session.steps.length - 1];
    
    let suggestedApproach: string | undefined;
    if (match.similarity > HIGH_SIMILARITY_THRESHOLD && successfulStep) {
      const approaches = [
        `Based on similar issue: ${successfulStep.hypothesis?.cause}`,
        `Try: ${successfulStep.experiment?.changes[0]?.reasoning}`,
        successfulStep.result?.learning ? `Key insight: ${successfulStep.result.learning}` : ''
      ].filter(a => a);
      
      suggestedApproach = approaches.join('\n');
    }
    
    const result: PatternMatch = {
      sessionId: match.sessionId,
      similarity: match.similarity,
      problem: {
        description: session.problem?.description || '',
        errorMessage: session.problem?.errorMessage || '',
        actualBehavior: session.problem?.actualBehavior || '',
        expectedBehavior: session.problem?.expectedBehavior || ''
      },
      solution: {
        hypothesis: successfulStep?.hypothesis?.cause || lastStep?.hypothesis?.cause || '',
        changes: (successfulStep?.experiment?.changes || lastStep?.experiment?.changes || []).map((change: CodeChange) => ({
          file: change.file,
          reasoning: change.reasoning
        })),
        learning: successfulStep?.result?.learning || lastStep?.result?.learning || ''
      },
      metadata: {
        confidence: this.getAverageConfidence(session),
        language: session.metadata?.language,
        framework: session.metadata?.framework,
        tags: session.metadata?.tags,
        createdAt: session.startTime.toISOString(),
        timesApplied: 1,
        successRate: session.steps.filter((s: CodeThinkingStep) => s.result?.success).length / session.steps.length * 100
      },
      suggestedApproach
    };
    
    if (query.includeDebugInfo && debugInfo) {
      result.debugInfo = {
        ...debugInfo,
        errorTypeExtracted: match.indexEntry.errorType
      };
    }
    
    return result;
  }
}