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
  ThinkingStep
} from '../types/debug.js';
import { SearchQuery } from '../types/search.js';
import { 
  StartParams, 
  ThinkParams, 
  ExperimentParams, 
  ObserveParams, 
  SearchParams 
} from '../types/actions.js';
import { SearchIndex } from './SearchIndex.js';
import { logger } from '../utils/logger.js';
import { formatDebugStep, createJsonResponse } from '../utils/format.js';
import { 
  ensureDirectory, 
  writeJsonFile,
  appendJsonLine,
  readJsonLines,
  readJsonLinesStream,
  fileExists
} from '../utils/storage.js';
import {
  DATA_DIR_NAME,
  METADATA_FILE,
  ERROR_MESSAGES,
  DEFAULT_SEARCH_LIMIT,
  MIN_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  SESSIONS_JSONL_FILE,
  ERROR_PATTERNS_JSONL_FILE,
  SUCCESSFUL_FIXES_JSONL_FILE
} from '../constants.js';
import { createThinkingWorkflow } from '../utils/sequentialThinkingIntegration.js';

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
      await this.loadKnowledge();
      logger.dim(`📁 Using data directory: ${this.dataDir}`);
    } catch (error) {
      logger.error('Failed to initialize storage:', error);
    }
  }

  private async loadKnowledge(): Promise<void> {
    // Load error patterns from JSONL
    const errorPatternsPath = path.join(this.dataDir, ERROR_PATTERNS_JSONL_FILE);
    this.errorPatterns = await readJsonLines<ErrorPattern>(errorPatternsPath);
    if (this.errorPatterns.length > 0) {
      logger.success(`✓ Loaded ${this.errorPatterns.length} error patterns`);
    }

    // Load successful fixes from JSONL
    const fixesPath = path.join(this.dataDir, SUCCESSFUL_FIXES_JSONL_FILE);
    this.successfulFixes = await readJsonLines<Fix>(fixesPath);
    if (this.successfulFixes.length > 0) {
      logger.success(`✓ Loaded ${this.successfulFixes.length} successful fixes`);
    }
    
    // Load saved sessions into search index
    await this.loadSessionsIntoIndex();
  }

  private async loadSessionsIntoIndex(): Promise<void> {
    let loadedSessions = 0;
    
    // Load from JSONL file
    const sessionsJsonlPath = path.join(this.dataDir, SESSIONS_JSONL_FILE);
    if (await fileExists(sessionsJsonlPath)) {
      for await (const savedSession of readJsonLinesStream<any>(sessionsJsonlPath)) {
        try {
          const session: DebugSession = {
            id: savedSession.id,
            startTime: new Date(savedSession.startTime),
            problem: savedSession.problem,
            steps: savedSession.steps.map((step: any) => ({
              ...step,
              timestamp: new Date(step.timestamp)
            })),
            metadata: savedSession.metadata,
            thoughtHistory: savedSession.thoughtHistory || [],
            branches: savedSession.branches || {},
            currentBranch: savedSession.currentBranch
          };
          
          this.searchIndex.addSession(session.id, session);
          loadedSessions++;
        } catch (err) {
          logger.warn(`Failed to load session from JSONL:`, err);
        }
      }
    }
    
    if (loadedSessions > 0) {
      logger.success(`✓ Loaded ${loadedSessions} sessions into search index`);
    }
  }

  private async saveKnowledge(): Promise<void> {
    // Note: With JSONL, we append data incrementally in learnFromResult
    // This method now only updates metadata
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
    const sessionsPath = path.join(this.dataDir, SESSIONS_JSONL_FILE);
    if (!await fileExists(sessionsPath)) return 0;
    
    let count = 0;
    for await (const _ of readJsonLinesStream<any>(sessionsPath)) {
      count++;
    }
    return count;
  }

  private async saveSession(sessionId: string): Promise<void> {
    const session = this.debugSessions.get(sessionId);
    if (!session) return;

    const sessionData = {
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
    };
    
    // Append to JSONL file
    const sessionsPath = path.join(this.dataDir, SESSIONS_JSONL_FILE);
    await appendJsonLine(sessionsPath, sessionData);
  }

  private generateId(): string {
    return `debug-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private async learnFromResult(step: CodeThinkingStep, sessionProblem?: Problem): Promise<void> {
    if (!step.result) return;

    const problem = step.problem || sessionProblem;
    
    // Learn from errors
    if (problem?.errorMessage && !step.result.success && step.hypothesis && step.experiment) {
      const existingPattern = this.errorPatterns.find(
        (p) => p.pattern === problem.errorMessage,
      );

      if (existingPattern) {
        existingPattern.occurrences++;
        // For JSONL, we need to rewrite the entire file to update occurrences
        // In a production system, you might want to use a database instead
      } else {
        const newPattern: ErrorPattern = {
          pattern: problem.errorMessage,
          commonCause: step.hypothesis.cause,
          suggestedFix: step.experiment?.changes[0]?.reasoning || '',
          occurrences: 1,
        };
        this.errorPatterns.push(newPattern);
        
        // Append to JSONL file
        const errorPatternsPath = path.join(this.dataDir, ERROR_PATTERNS_JSONL_FILE);
        await appendJsonLine(errorPatternsPath, newPattern);
      }
    }

    // Record successful fixes
    if (step.result.success && step.experiment) {
      const newFix: Fix = {
        problemId: step.id,
        solution: step.result.learning,
        changes: step.experiment.changes,
        verified: true,
      };
      this.successfulFixes.push(newFix);
      
      // Append to JSONL file
      const fixesPath = path.join(this.dataDir, SUCCESSFUL_FIXES_JSONL_FILE);
      await appendJsonLine(fixesPath, newFix);
    }

    // Update metadata
    await this.saveKnowledge().catch(error => logger.error('Failed to save knowledge:', error));
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
      metadata: normalizedMetadata,
      thoughtHistory: [],
      branches: {},
      currentBranch: undefined
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

  public async recordStep(input: unknown): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
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
        await this.learnFromResult(validStep, session.problem);
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
      // Try to find in JSONL file
      const sessionsPath = path.join(this.dataDir, SESSIONS_JSONL_FILE);
      if (await fileExists(sessionsPath)) {
        for await (const savedSession of readJsonLinesStream<any>(sessionsPath)) {
          if (savedSession.id === id) {
            session = {
              id: savedSession.id,
              startTime: new Date(savedSession.startTime),
              problem: savedSession.problem,
              steps: savedSession.steps.map((step: any) => ({
                ...step,
                timestamp: new Date(step.timestamp)
              })),
              metadata: savedSession.metadata,
              thoughtHistory: savedSession.thoughtHistory || [],
              branches: savedSession.branches || {},
              currentBranch: savedSession.currentBranch
            };
            break;
          }
        }
      }
    }

    if (!session) {
      return createJsonResponse({ 
        error: ERROR_MESSAGES.SESSION_NOT_FOUND, 
        sessionId: id,
        hint: 'Session not found in active sessions or saved history'
      });
    }

    const summary = {
      sessionId: id,
      sessionProblem: session.problem,
      totalSteps: session.steps.length,
      successfulFixes: session.steps.filter((s) => s.result?.success).length,
      experimentsRepeated: session.steps.filter((s) => s.nextAction === 'iterate').length,
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
      const sessionsPath = path.join(this.dataDir, SESSIONS_JSONL_FILE);
      const sessions = [];

      if (await fileExists(sessionsPath)) {
        for await (const session of readJsonLinesStream<any>(sessionsPath)) {
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

  public recordThinking(sessionId: string | undefined, thinkingSteps: ThinkingStep[]): {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  } {
    const id = sessionId || this.currentSessionId;
    if (!id) {
      return createJsonResponse({ 
        error: ERROR_MESSAGES.NO_ACTIVE_SESSION,
        hint: "Start a session first before recording thinking steps"
      }, true);
    }

    const session = this.debugSessions.get(id);
    if (!session) {
      return createJsonResponse({ error: ERROR_MESSAGES.SESSION_NOT_FOUND }, true);
    }

    // Add thinking steps to the latest step or create a new one
    const lastStep = session.steps[session.steps.length - 1];
    if (lastStep && !lastStep.result) {
      // Add to existing step if it doesn't have a result yet
      lastStep.thinkingSteps = [...(lastStep.thinkingSteps || []), ...thinkingSteps];
    } else {
      // Create a new step with just thinking steps
      const newStep: CodeThinkingStep = {
        id: this.generateId(),
        timestamp: new Date(),
        thinkingSteps: thinkingSteps
      };
      session.steps.push(newStep);
    }

    // Update search index
    this.searchIndex.removeSession(id);
    this.searchIndex.addSession(id, session);

    return createJsonResponse({
      sessionId: id,
      recorded: true,
      thinkingStepsCount: thinkingSteps.length,
      totalSteps: session.steps.length
    });
  }

  public convertThinkingToHypothesis(
    sessionId: string | undefined,
    thinkingConclusion: string,
    confidence?: number
  ): {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  } {
    const id = sessionId || this.currentSessionId;
    if (!id) {
      return createJsonResponse({ 
        error: ERROR_MESSAGES.NO_ACTIVE_SESSION,
        hint: "Start a session first"
      }, true);
    }

    const session = this.debugSessions.get(id);
    if (!session) {
      return createJsonResponse({ error: ERROR_MESSAGES.SESSION_NOT_FOUND }, true);
    }

    // Find the latest step with thinking steps but no hypothesis
    const stepWithThinking = [...session.steps].reverse().find(
      step => step.thinkingSteps && step.thinkingSteps.length > 0 && !step.hypothesis
    );

    if (!stepWithThinking) {
      return createJsonResponse({
        error: "No thinking steps found to convert to hypothesis",
        hint: "Record thinking steps first using record_thinking action"
      }, true);
    }

    // Create hypothesis from thinking conclusion
    const hypothesis: Hypothesis = {
      cause: thinkingConclusion,
      affectedCode: [], // To be filled by the user
      confidence: confidence || 70, // Default confidence
      thinkingChain: stepWithThinking.thinkingSteps,
      thoughtConclusion: thinkingConclusion
    };

    stepWithThinking.hypothesis = hypothesis;

    // Update search index
    this.searchIndex.removeSession(id);
    this.searchIndex.addSession(id, session);

    return createJsonResponse({
      sessionId: id,
      stepId: stepWithThinking.id,
      hypothesis: hypothesis,
      hint: "Now add affected code and create an experiment to test this hypothesis"
    });
  }

  // New simplified methods
  public start(params: StartParams): {
    content: Array<{ type: string; text: string }>;
  } {
    const sessionId = this.generateId();
    const problem = params.problem ? {
      description: params.problem,
      errorMessage: params.context?.error || '',
      expectedBehavior: '',
      actualBehavior: ''
    } : undefined;

    const metadata = params.context ? {
      language: params.context.language,
      framework: params.context.framework,
      tags: params.context.tags
    } : undefined;

    this.startSession(sessionId, problem, metadata);

    return createJsonResponse({
      sessionId,
      status: 'started',
      message: `Debug session ${sessionId} started`
    });
  }

  public think(params: ThinkParams): {
    content: Array<{ type: string; text: string }>;
  } {
    if (!this.currentSessionId) {
      return createJsonResponse({
        error: ERROR_MESSAGES.NO_ACTIVE_SESSION,
        hint: "Start a session first"
      }, true);
    }

    const session = this.debugSessions.get(this.currentSessionId);
    if (!session) {
      return createJsonResponse({ error: ERROR_MESSAGES.SESSION_NOT_FOUND }, true);
    }

    // Validate thought number sequence
    if (params.thoughtNumber !== session.thoughtHistory.length + 1 && !params.isRevision && !params.branchFromThought) {
      return createJsonResponse({
        error: `Invalid thought number. Expected ${session.thoughtHistory.length + 1}, got ${params.thoughtNumber}`,
        hint: "Thoughts must be sequential unless revising or branching"
      }, true);
    }

    // Create thinking step
    const thinkingStep: ThinkingStep = {
      thought: params.thought,
      thoughtNumber: params.thoughtNumber,
      totalThoughts: params.totalThoughts,
      timestamp: new Date(),
      isRevision: params.isRevision,
      revisesThought: params.revisesThought,
      branchFromThought: params.branchFromThought,
      branchId: params.branchId
    };

    // Handle branching
    if (params.branchFromThought && params.branchId) {
      if (!session.branches[params.branchId]) {
        session.branches[params.branchId] = [];
      }
      session.branches[params.branchId].push(thinkingStep);
      session.currentBranch = params.branchId;
    } else {
      // Add to main thought history
      session.thoughtHistory.push(thinkingStep);
    }

    // If this is the last thought, generate hypothesis
    if (!params.nextThoughtNeeded) {
      // Use the utility function to create hypothesis from thought history
      const allThoughts = session.currentBranch 
        ? [...session.thoughtHistory, ...session.branches[session.currentBranch]]
        : session.thoughtHistory;
      
      const { hypothesis } = createThinkingWorkflow(
        allThoughts.map(t => ({
          thought: t.thought,
          nextThoughtNeeded: false,
          thoughtNumber: t.thoughtNumber,
          totalThoughts: t.totalThoughts,
          isRevision: t.isRevision,
          revisesThought: t.revisesThought,
          branchFromThought: t.branchFromThought,
          branchId: t.branchId
        }))
      );

      // Create a new step with the hypothesis
      const step: CodeThinkingStep = {
        id: this.generateId(),
        timestamp: new Date(),
        thinkingSteps: allThoughts,
        hypothesis: hypothesis
      };

      session.steps.push(step);

      // Update search index
      this.searchIndex.removeSession(this.currentSessionId);
      this.searchIndex.addSession(this.currentSessionId, session);

      return createJsonResponse({
        thoughtNumber: params.thoughtNumber,
        totalThoughts: params.totalThoughts,
        nextThoughtNeeded: false,
        hypothesis: hypothesis.cause,
        confidence: hypothesis.confidence,
        affectedCode: hypothesis.affectedCode,
        suggestedAction: hypothesis.affectedCode.length > 0 ? 'experiment' : 'add affected code',
        branches: Object.keys(session.branches),
        thoughtHistoryLength: session.thoughtHistory.length
      });
    }

    // Update search index
    this.searchIndex.removeSession(this.currentSessionId);
    this.searchIndex.addSession(this.currentSessionId, session);

    return createJsonResponse({
      thoughtNumber: params.thoughtNumber,
      totalThoughts: params.totalThoughts,
      nextThoughtNeeded: true,
      branches: Object.keys(session.branches),
      thoughtHistoryLength: session.thoughtHistory.length
    });
  }

  public experiment(params: ExperimentParams): {
    content: Array<{ type: string; text: string }>;
  } {
    if (!this.currentSessionId) {
      return createJsonResponse({
        error: ERROR_MESSAGES.NO_ACTIVE_SESSION,
        hint: "Start a session first"
      }, true);
    }

    const session = this.debugSessions.get(this.currentSessionId);
    if (!session) {
      return createJsonResponse({ error: ERROR_MESSAGES.SESSION_NOT_FOUND }, true);
    }

    // Find the latest step with hypothesis but no experiment
    const stepForExperiment = [...session.steps].reverse().find(
      step => step.hypothesis && !step.experiment
    );

    if (!stepForExperiment) {
      return createJsonResponse({
        error: "No hypothesis found to experiment on",
        hint: "Use 'think' action first to create a hypothesis"
      }, true);
    }

    const experiment: Experiment = {
      changes: params.changes.map(c => ({
        file: c.file,
        lineRange: [0, 0], // Simplified - not tracking line ranges
        oldCode: '',
        newCode: c.change,
        reasoning: c.reason
      })),
      expectedOutcome: params.expected
    };

    stepForExperiment.experiment = experiment;

    // Update search index
    this.searchIndex.removeSession(this.currentSessionId);
    this.searchIndex.addSession(this.currentSessionId, session);

    return createJsonResponse({
      stepId: stepForExperiment.id,
      experiment: params.description,
      changes: params.changes.length,
      expected: params.expected
    });
  }

  public async observe(params: ObserveParams): Promise<{
    content: Array<{ type: string; text: string }>;
  }> {
    if (!this.currentSessionId) {
      return createJsonResponse({
        error: ERROR_MESSAGES.NO_ACTIVE_SESSION,
        hint: "Start a session first"
      }, true);
    }

    const session = this.debugSessions.get(this.currentSessionId);
    if (!session) {
      return createJsonResponse({ error: ERROR_MESSAGES.SESSION_NOT_FOUND }, true);
    }

    // Find the latest step with experiment but no result
    const stepForResult = [...session.steps].reverse().find(
      step => step.experiment && !step.result
    );

    if (!stepForResult) {
      return createJsonResponse({
        error: "No experiment found to observe results for",
        hint: "Use 'experiment' action first"
      }, true);
    }

    const result: Result = {
      success: params.success,
      output: params.output,
      learning: params.learning,
      newErrors: []
    };

    stepForResult.result = result;
    stepForResult.nextAction = params.next || (params.success ? 'fixed' : 'iterate');

    // Learn from result
    await this.learnFromResult(stepForResult, session.problem);

    // Update search index
    this.searchIndex.removeSession(this.currentSessionId);
    this.searchIndex.addSession(this.currentSessionId, session);

    return createJsonResponse({
      stepId: stepForResult.id,
      success: params.success,
      learning: params.learning,
      nextAction: stepForResult.nextAction,
      sessionComplete: stepForResult.nextAction === 'fixed'
    });
  }

  public search(params: SearchParams): {
    content: Array<{ type: string; text: string }>;
  } {
    // Convert simplified params to SearchQuery
    const searchQuery: SearchQuery = {
      keywords: params.query.split(' '),
      confidence_threshold: params.filters?.confidence,
      language: params.filters?.language,
      searchMode: 'fuzzy',
      keywordLogic: 'OR',
      includeDebugInfo: false
    };

    const limit = params.filters?.limit || DEFAULT_SEARCH_LIMIT;
    const matches = this.searchIndex.search(searchQuery, limit);

    return createJsonResponse({
      query: params.query,
      matches: matches.map(m => ({
        sessionId: m.sessionId,
        similarity: m.similarity,
        problem: m.problem.description,
        solution: m.solution.learning,
        confidence: m.metadata.confidence
      })),
      total: matches.length
    });
  }

  public async end(summary: boolean = false): Promise<{
    content: Array<{ type: string; text: string }>;
  }> {
    if (!this.currentSessionId) {
      return createJsonResponse({
        error: ERROR_MESSAGES.NO_SESSION_TO_END
      }, true);
    }

    const sessionId = this.currentSessionId;
    const session = this.debugSessions.get(sessionId);
    
    if (summary && session) {
      const summaryData = await this.getSessionSummary(sessionId);
      await this.endSession(sessionId);
      return summaryData;
    } else {
      return await this.endSession(sessionId);
    }
  }
}