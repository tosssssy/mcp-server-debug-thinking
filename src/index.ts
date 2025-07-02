#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { DebugServer } from './services/DebugServer.js';
import { SearchQuery } from './types/search.js';
import { Problem } from './types/debug.js';
import { createJsonResponse } from './utils/format.js';
import { logger } from './utils/logger.js';
import {
  TOOL_NAME,
  SERVER_NAME,
  SERVER_VERSION,
  ACTIONS,
  ERROR_MESSAGES
} from './constants.js';

const CODE_DEBUG_TOOL: Tool = {
  name: TOOL_NAME,
  description: `A systematic debugging and code iteration framework for Claude Code.
This tool helps track and learn from debugging sessions, building knowledge over time.

Key features:
- Structured problem analysis with hypothesis testing
- Code change tracking with reasoning
- Pattern recognition from previous errors
- Learning accumulation across sessions
- Confidence scoring for hypotheses
- Persistent storage in ~/.debug-iteration-mcp directory

Use this tool when:
- Debugging errors in code
- Iterating on implementations
- Tracking complex problem-solving processes
- Building a knowledge base of fixes

Actions:
1. start_session - Start a new debugging session (optionally with a problem)
2. record_step - Record a debugging step (requires hypothesis and experiment)
3. get_summary - Get summary of current or specific session
4. end_session - End and save a session
5. list_sessions - List all sessions
6. search_patterns - Search for similar debugging patterns across all sessions

Data is stored in ~/.debug-iteration-mcp/ (or custom location via DEBUG_DATA_DIR env var).`,
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: Object.values(ACTIONS),
        description: "Action to perform",
      },
      sessionId: {
        type: "string",
        description: "Session ID (optional for start_session and get_summary)",
      },
      problem: {
        type: "object",
        description: "Problem definition (optional for start_session only)",
        properties: {
          description: { type: "string" },
          errorMessage: { type: "string" },
          expectedBehavior: { type: "string" },
          actualBehavior: { type: "string" },
        },
        required: ["description", "expectedBehavior", "actualBehavior"],
      },
      hypothesis: {
        type: "object",
        description: "Hypothesis about the cause (required for record_step)",
        properties: {
          cause: { type: "string" },
          affectedCode: {
            type: "array",
            items: { type: "string" },
          },
          confidence: {
            type: "integer",
            minimum: 0,
            maximum: 100,
          },
        },
        required: ["cause", "affectedCode", "confidence"],
      },
      experiment: {
        type: "object",
        description: "Experiment to test the hypothesis (required for record_step)",
        properties: {
          changes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                file: { type: "string" },
                lineRange: {
                  type: "array",
                  items: { type: "integer" },
                  minItems: 2,
                  maxItems: 2,
                },
                oldCode: { type: "string" },
                newCode: { type: "string" },
                reasoning: { type: "string" },
              },
              required: [
                "file",
                "lineRange",
                "oldCode",
                "newCode",
                "reasoning",
              ],
            },
          },
          testCommand: { type: "string" },
          expectedOutcome: { type: "string" },
        },
        required: ["changes", "expectedOutcome"],
      },
      result: {
        type: "object",
        description: "Result of the experiment (optional for record_step)",
        properties: {
          success: { type: "boolean" },
          output: { type: "string" },
          newErrors: {
            type: "array",
            items: { type: "string" },
          },
          learning: { type: "string" },
        },
        required: ["success", "learning"],
      },
      nextAction: {
        type: "string",
        description: "Next action to take (optional for record_step)",
        enum: ["fixed", "iterate", "pivot", "research"],
      },
      metadata: {
        type: "object",
        description: "Metadata for the session (optional for start_session)",
        properties: {
          language: { type: "string" },
          framework: { type: "string" },
          tags: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
      searchQuery: {
        type: "object",
        description: "Search query parameters (required for search_patterns)",
        properties: {
          errorType: { 
            type: "string",
            description: "Error type to search for (e.g. 'TypeError', 'ECONNREFUSED')"
          },
          keywords: {
            type: "array",
            items: { type: "string" },
            description: "Keywords to search in problem descriptions and solutions"
          },
          language: { 
            type: "string",
            description: "Filter by programming language (e.g. 'javascript', 'typescript')"
          },
          framework: { 
            type: "string",
            description: "Filter by framework (e.g. 'react', 'express')"
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Filter by tags (matches sessions with any of these tags)"
          },
          confidence_threshold: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Minimum average confidence score to include in results"
          },
          searchMode: {
            type: "string",
            enum: ["exact", "fuzzy"],
            description: "Search mode - exact matches only or fuzzy matching (default: fuzzy)"
          },
          keywordLogic: {
            type: "string",
            enum: ["AND", "OR"],
            description: "How to combine multiple keywords (default: OR)"
          },
          includeDebugInfo: {
            type: "boolean",
            description: "Include debug information in results"
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 50,
            default: 10,
            description: "Maximum number of results to return"
          },
        },
      },
    },
    required: ["action"],
  },
};

const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const debugServer = new DebugServer();

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [CODE_DEBUG_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === TOOL_NAME) {
    const args = request.params.arguments as Record<string, unknown>;
    const action = args.action as string;

    switch (action) {
      case ACTIONS.START_SESSION:
        const sessionId = debugServer.startSession(
          args.sessionId as string | undefined,
          args.problem as Problem | undefined,
          args.metadata as { language?: string; framework?: string; tags?: string[] } | undefined,
        );
        return createJsonResponse({ 
          sessionId, 
          status: "started",
          problemSet: args.problem ? true : false,
          metadata: args.metadata || null
        });

      case ACTIONS.RECORD_STEP:
        return debugServer.recordStep(args);

      case ACTIONS.GET_SUMMARY:
        return await debugServer.getSessionSummary(
          args.sessionId as string | undefined,
        );

      case ACTIONS.END_SESSION:
        return await debugServer.endSession(
          args.sessionId as string | undefined,
        );

      case ACTIONS.LIST_SESSIONS:
        return await debugServer.listSessions();
        
      case ACTIONS.SEARCH_PATTERNS:
        if (!args.searchQuery) {
          return createJsonResponse({
            error: ERROR_MESSAGES.SEARCH_QUERY_REQUIRED,
            status: "failed",
          }, true);
        }
        return debugServer.searchPatterns(args.searchQuery as SearchQuery);

      default:
        return createJsonResponse({
          error: `${ERROR_MESSAGES.UNKNOWN_ACTION}: ${action}`,
          validActions: Object.values(ACTIONS),
        }, true);
    }
  }

  return createJsonResponse({
    error: `Unknown tool: ${request.params.name}`,
  }, true);
});

async function runServer() {
  // Initialize the debug server
  await debugServer.initialize();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Code Debug & Iteration MCP Server running on stdio");

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("\n📁 Saving all data before shutdown...");

    // End all active sessions
    for (const sessionId of debugServer.getActiveSessionIds()) {
      await debugServer.endSession(sessionId);
    }

    logger.success("✅ All data saved successfully");
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await debugServer.saveAllKnowledge();
    process.exit(0);
  });
}

runServer().catch((error) => {
  logger.error("Fatal error running server:", error);
  process.exit(1);
});