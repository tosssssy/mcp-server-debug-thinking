import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { 
  DebugSession, 
  CodeThinkingStep, 
  Problem, 
  ErrorPattern, 
  Fix,
  Hypothesis,
  Experiment,
  Result,
  CodeChange
} from '../types/debug.js';
import { SearchQuery, PatternMatch } from '../types/search.js';
import { SearchIndex } from './SearchIndex.js';
import { logger } from '../utils/logger.js';
import { formatDebugStep, createJsonResponse } from '../utils/format.js';
import { ensureDirectory, readJsonFile, writeJsonFile, listJsonFiles } from '../utils/storage.js';
import {
  DATA_DIR_NAME,
  SESSIONS_DIR,
  ERROR_PATTERNS_FILE,
  SUCCESSFUL_FIXES_FILE,
  METADATA_FILE,
  ERROR_MESSAGES,
  DEFAULT_SEARCH_LIMIT,
  MIN_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT
} from '../constants.js';

export class DebugServer {
  private debugSessions: Map<string, DebugSession> = new Map();
  private errorPatterns: ErrorPattern[] = [];
  private successfulFixes: Fix[] = [];
  private currentSessionId: string | null = null;
  private dataDir: string;
  private searchIndex: SearchIndex = new SearchIndex();

  constructor() {
    const baseDir = process.env.DEBUG_DATA_DIR || os.homedir();
    this.dataDir = path.join(baseDir, DATA_DIR_NAME);
  }
  
  public async initialize(): Promise<void> {
    await this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await ensureDirectory(this.dataDir);
      await ensureDirectory(path.join(this.dataDir, SESSIONS_DIR));
      await this.loadKnowledge();
      logger.dim(`📁 Using data directory: ${this.dataDir}`);
    } catch (error) {
      logger.error('Failed to initialize storage:', error);
    }
  }

  private async loadKnowledge(): Promise<void> {
    // Load error patterns
    const patterns = await readJsonFile<ErrorPattern[]>(
      path.join(this.dataDir, ERROR_PATTERNS_FILE)
    );
    if (patterns) {
      this.errorPatterns = patterns;
      logger.success(`✓ Loaded ${this.errorPatterns.length} error patterns`);
    }

    // Load successful fixes
    const fixes = await readJsonFile<Fix[]>(
      path.join(this.dataDir, SUCCESSFUL_FIXES_FILE)
    );
    if (fixes) {
      this.successfulFixes = fixes;
      logger.success(`✓ Loaded ${this.successfulFixes.length} successful fixes`);
    }
    
    // Load saved sessions into search index
    await this.loadSessionsIntoIndex();
  }

  private async loadSessionsIntoIndex(): Promise<void> {
    const sessionsDir = path.join(this.dataDir, SESSIONS_DIR);
    const files = await listJsonFiles(sessionsDir);
    let loadedSessions = 0;
    
    for (const file of files) {
      try {
        const savedSession = await readJsonFile<any>(
          path.join(sessionsDir, file)
        );
        
        if (savedSession) {
          const session: DebugSession = {
            id: savedSession.id,
            startTime: new Date(savedSession.startTime),
            problem: savedSession.problem,
            steps: savedSession.steps.map((step: any) => ({
              ...step,
              timestamp: new Date(step.timestamp)
            })),
            metadata: savedSession.metadata
          };
          
          this.searchIndex.addSession(session.id, session);
          loadedSessions++;
        }
      } catch (err) {
        logger.warn(`Failed to load session ${file}:`, err);
      }
    }
    
    if (loadedSessions > 0) {
      logger.success(`✓ Loaded ${loadedSessions} sessions into search index`);
    }
  }

  private async saveKnowledge(): Promise<void> {
    await writeJsonFile(
      path.join(this.dataDir, ERROR_PATTERNS_FILE),
      this.errorPatterns
    );

    await writeJsonFile(
      path.join(this.dataDir, SUCCESSFUL_FIXES_FILE),
      this.successfulFixes
    );

    await writeJsonFile(
      path.join(this.dataDir, METADATA_FILE),
      {
        lastUpdated: new Date().toISOString(),
        totalPatterns: this.errorPatterns.length,
        totalFixes: this.successfulFixes.length,
        totalSessions: await this.countSessions(),
      }
    );
  }

  private async countSessions(): Promise<number> {
    const files = await listJsonFiles(path.join(this.dataDir, SESSIONS_DIR));
    return files.length;
  }

  private async saveSession(sessionId: string): Promise<void> {
    const session = this.debugSessions.get(sessionId);
    if (!session) return;

    const sessionPath = path.join(
      this.dataDir,
      SESSIONS_DIR,
      `${sessionId}.json`
    );
    
    await writeJsonFile(sessionPath, {
      id: sessionId,
      startTime: session.startTime,
      endTime: new Date(),
      problem: session.problem,
      steps: session.steps,
      metadata: session.metadata,
      summary: {
        totalSteps: session.steps.length,
        successfulFixes: session.steps.filter((s) => s.result?.success).length,
        finalStatus: session.steps[session.steps.length - 1]?.nextAction || 'incomplete',
      },
    });
  }

  private generateId(): string {
    return `debug-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private learnFromResult(step: CodeThinkingStep, sessionProblem?: Problem): void {
    if (!step.result) return;

    const problem = step.problem || sessionProblem;
    
    // Learn from errors
    if (problem?.errorMessage && !step.result.success && step.hypothesis && step.experiment) {
      const existingPattern = this.errorPatterns.find(
        (p) => p.pattern === problem.errorMessage,
      );

      if (existingPattern) {
        existingPattern.occurrences++;
      } else {
        this.errorPatterns.push({
          pattern: problem.errorMessage,
          commonCause: step.hypothesis.cause,
          suggestedFix: step.experiment?.changes[0]?.reasoning || '',
          occurrences: 1,
        });
      }
    }

    // Record successful fixes
    if (step.result.success && step.experiment) {
      this.successfulFixes.push({
        problemId: step.id,
        solution: step.result.learning,
        changes: step.experiment.changes,
        verified: true,
      });
    }

    // Auto-save knowledge after learning
    this.saveKnowledge().catch(error => logger.error('Failed to save knowledge:', error));
  }

  public startSession(
    sessionId?: string, 
    problem?: Problem, 
    metadata?: { language?: string; framework?: string; tags?: string[] }
  ): string {
    const id = sessionId || this.generateId();
    
    // Normalize metadata
    const normalizedMetadata = metadata ? {
      language: metadata.language?.toLowerCase(),
      framework: metadata.framework?.toLowerCase(),
      tags: metadata.tags?.map(tag => tag.toLowerCase())
    } : undefined;
    
    const session: DebugSession = {
      id,
      startTime: new Date(),
      problem,
      steps: [],
      metadata: normalizedMetadata
    };
    
    this.debugSessions.set(id, session);
    this.currentSessionId = id;
    this.searchIndex.addSession(id, session);

    logger.session('start', id);
    
    if (problem) {
      logger.info(chalk.yellow(`📋 Problem: ${problem.description}`));
    }
    
    if (normalizedMetadata) {
      const metaInfo = [];
      if (normalizedMetadata.language) metaInfo.push(`Lang: ${normalizedMetadata.language}`);
      if (normalizedMetadata.framework) metaInfo.push(`Framework: ${normalizedMetadata.framework}`);
      if (normalizedMetadata.tags?.length) metaInfo.push(`Tags: ${normalizedMetadata.tags.join(', ')}`);
      if (metaInfo.length > 0) {
        logger.dim(`🏷️  ${metaInfo.join(' | ')}`);
      }
    }

    return id;
  }

  public recordStep(input: unknown): {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  } {
    try {
      const data = input as Record<string, unknown>;

      if (!this.currentSessionId) {
        return createJsonResponse({
          error: ERROR_MESSAGES.NO_ACTIVE_SESSION,
          solution: "Please start a session first with action: 'start_session'",
        }, true);
      }

      const step: Partial<CodeThinkingStep> = {
        id: this.generateId(),
        timestamp: new Date(),
      };

      if (data.problem) step.problem = data.problem as Problem;
      if (data.hypothesis) step.hypothesis = data.hypothesis as Hypothesis;
      if (data.experiment) step.experiment = data.experiment as Experiment;
      if (data.result) step.result = data.result as Result;
      if (data.nextAction) step.nextAction = data.nextAction as "fixed" | "iterate" | "pivot" | "research";

      if (!step.problem && !step.hypothesis && !step.experiment && !step.result) {
        throw new Error(ERROR_MESSAGES.AT_LEAST_ONE_FIELD_REQUIRED);
      }

      const validStep = step as CodeThinkingStep;
      const session = this.debugSessions.get(this.currentSessionId!);
      
      if (!session) {
        throw new Error(ERROR_MESSAGES.SESSION_NOT_FOUND);
      }
      
      session.steps.push(validStep);
      
      // Update search index
      this.searchIndex.removeSession(this.currentSessionId!);
      this.searchIndex.addSession(this.currentSessionId!, session);

      if (validStep.result) {
        this.learnFromResult(validStep, session.problem);
      }

      if (validStep.hypothesis || validStep.experiment) {
        logger.info(formatDebugStep(validStep, session.problem));
      }

      // Check for known patterns
      let patternMatch = null;
      const problemToCheck = validStep.problem || session.problem;
      if (problemToCheck?.errorMessage) {
        patternMatch = this.errorPatterns.find((p) =>
          problemToCheck.errorMessage?.includes(p.pattern),
        );
      }

      return createJsonResponse({
        stepId: step.id,
        sessionId: this.currentSessionId,
        recorded: true,
        nextAction: step.nextAction,
        patternMatch: patternMatch ? {
          pattern: patternMatch.pattern,
          suggestedCause: patternMatch.commonCause,
          previousOccurrences: patternMatch.occurrences,
        } : null,
        sessionSteps: session?.steps.length || 0,
        knownPatterns: this.errorPatterns.length,
        successfulFixes: this.successfulFixes.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error in recordStep:', errorMessage);
      
      return createJsonResponse({
        error: errorMessage,
        status: 'failed',
        details: 'Please ensure all required fields are provided',
      }, true);
    }
  }

  public async getSessionSummary(sessionId?: string): Promise<{
    content: Array<{ type: string; text: string }>;
  }> {
    const id = sessionId || this.currentSessionId;
    if (!id) {
      return createJsonResponse({ error: ERROR_MESSAGES.NO_ACTIVE_SESSION });
    }

    let session = this.debugSessions.get(id);
    
    if (!session) {
      try {
        const sessionPath = path.join(this.dataDir, SESSIONS_DIR, `${id}.json`);
        const savedSession = await readJsonFile<any>(sessionPath);
        
        if (savedSession) {
          session = {
            id: savedSession.id,
            startTime: new Date(savedSession.startTime),
            problem: savedSession.problem,
            steps: savedSession.steps.map((step: any) => ({
              ...step,
              timestamp: new Date(step.timestamp)
            })),
            metadata: savedSession.metadata
          };
        }
      } catch (error) {
        return createJsonResponse({ 
          error: ERROR_MESSAGES.SESSION_NOT_FOUND, 
          sessionId: id,
          hint: 'Session may have been deleted or the ID is incorrect'
        });
      }
    }

    if (!session) {
      return createJsonResponse({ error: ERROR_MESSAGES.SESSION_NOT_FOUND });
    }

    const summary = {
      sessionId: id,
      sessionProblem: session.problem,
      totalSteps: session.steps.length,
      successfulFixes: session.steps.filter((s) => s.result?.success).length,
      iterations: session.steps.filter((s) => s.nextAction === 'iterate').length,
      pivots: session.steps.filter((s) => s.nextAction === 'pivot').length,
      averageConfidence:
        session.steps.length > 0
          ? session.steps.reduce((acc, s) => acc + (s.hypothesis?.confidence || 0), 0) /
            session.steps.length
          : 0,
      problemsSolved: session.steps
        .filter((s) => s.nextAction === 'fixed')
        .map((s) => ({
          hypothesis: s.hypothesis?.cause,
          solution: s.result?.learning,
        })),
    };

    return createJsonResponse(summary);
  }

  public async endSession(sessionId?: string): Promise<{
    content: Array<{ type: string; text: string }>;
  }> {
    const id = sessionId || this.currentSessionId;
    if (!id) {
      return createJsonResponse({ error: ERROR_MESSAGES.NO_SESSION_TO_END });
    }

    try {
      await this.saveSession(id);
      await this.saveKnowledge();

      const session = this.debugSessions.get(id);
      const summary = {
        sessionId: id,
        ended: new Date().toISOString(),
        totalSteps: session?.steps.length || 0,
        saved: true,
        dataLocation: this.dataDir,
      };

      // Remove from active sessions only (keep in search index)
      this.debugSessions.delete(id);
      if (this.currentSessionId === id) {
        this.currentSessionId = null;
      }

      logger.session('end', id);

      return createJsonResponse(summary);
    } catch (error) {
      return createJsonResponse({
        error: error instanceof Error ? error.message : String(error),
        status: 'failed',
      });
    }
  }

  public async listSessions(): Promise<{
    content: Array<{ type: string; text: string }>;
  }> {
    try {
      const sessionsDir = path.join(this.dataDir, SESSIONS_DIR);
      const files = await listJsonFiles(sessionsDir);
      const sessions = [];

      for (const file of files) {
        const session = await readJsonFile<any>(path.join(sessionsDir, file));
        if (session) {
          sessions.push({
            id: session.id,
            startTime: session.startTime,
            endTime: session.endTime,
            totalSteps: session.summary.totalSteps,
            status: session.summary.finalStatus,
          });
        }
      }

      return createJsonResponse({
        activeSessions: Array.from(this.debugSessions.keys()),
        savedSessions: sessions,
        totalSessions: sessions.length,
      });
    } catch (error) {
      return createJsonResponse({
        error: error instanceof Error ? error.message : String(error),
        sessions: [],
      });
    }
  }

  public searchPatterns(query: SearchQuery): {
    content: Array<{ type: string; text: string }>;
  } {
    try {
      logger.search(query, 0);
      
      // Validate query
      if (!query || typeof query !== 'object') {
        return createJsonResponse({
          error: ERROR_MESSAGES.INVALID_SEARCH_QUERY,
          status: 'failed',
          example: {
            errorType: 'TypeError',
            keywords: ['undefined', 'property'],
            language: 'javascript',
            searchMode: 'fuzzy',
            includeDebugInfo: true
          }
        });
      }
      
      // Check if query has at least one search criterion
      const hasSearchCriteria = query.errorType || 
                               (query.keywords && query.keywords.length > 0) ||
                               query.language ||
                               query.framework ||
                               query.confidence_threshold !== undefined;
                               
      if (!hasSearchCriteria) {
        return createJsonResponse({
          error: ERROR_MESSAGES.NO_SEARCH_CRITERIA,
          status: 'failed',
          providedQuery: query
        });
      }
      
      const limit = (query as any).limit || DEFAULT_SEARCH_LIMIT;
      
      // Validate limit
      if (limit < MIN_SEARCH_LIMIT || limit > MAX_SEARCH_LIMIT) {
        return createJsonResponse({
          error: ERROR_MESSAGES.INVALID_LIMIT,
          status: 'failed',
          providedLimit: limit
        });
      }
      
      const matches = this.searchIndex.search(query, limit);
      
      if (query.includeDebugInfo && matches.length > 0) {
        const debugInfo = matches[0].debugInfo;
        if (debugInfo) {
          logger.dim(`   Total searched: ${debugInfo.totalSessionsSearched}`);
          logger.dim(`   Keyword matches: ${debugInfo.keywordMatches}`);
          logger.dim(`   Filtered by metadata: ${debugInfo.filteredByMetadata}`);
          logger.dim(`   Filtered by confidence: ${debugInfo.filteredByConfidence}`);
        }
      }
      
      logger.success(`✓ Found ${matches.length} matches`);
      
      return createJsonResponse({
        query,
        matches,
        totalMatches: matches.length,
        status: 'success'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error in searchPatterns:', errorMessage);
      
      return createJsonResponse({
        error: errorMessage,
        status: 'failed',
        hint: 'Check the error message and ensure your search query is properly formatted.'
      });
    }
  }

  public getActiveSessionIds(): string[] {
    return Array.from(this.debugSessions.keys());
  }

  public async saveAllKnowledge(): Promise<void> {
    return this.saveKnowledge();
  }
}