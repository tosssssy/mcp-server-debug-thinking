#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { DebugServer } from './services/DebugServer.js';
import { 
  StartParams, 
  ThinkParams, 
  ExperimentParams, 
  ObserveParams, 
  SearchParams, 
  EndParams 
} from './types/actions.js';
import { createJsonResponse } from './utils/format.js';
import { logger } from './utils/logger.js';
import {
  TOOL_NAME,
  SERVER_NAME,
  SERVER_VERSION,
  ACTIONS,
  ERROR_MESSAGES
} from './constants.js';

const DEBUG_THINKING_TOOL: Tool = {
  name: TOOL_NAME,
  description: `Systematic debugging with thinking process tracking and pattern learning.

This tool provides a streamlined workflow for debugging with sequential thinking:
1. start - Begin a debugging session
2. think - Record step-by-step thoughts (Sequential Thinking style)
3. experiment - Define what changes to test
4. observe - Record results and learnings
5. search - Find similar past issues and solutions
6. end - Complete the session

Features:
- Built-in sequential thinking process
- Supports thought revision and branching
- Automatically generates hypothesis when thinking completes
- Learns from past debugging sessions
- Pattern recognition and search

Data persists in ~/.debug-thinking-mcp/`,
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: Object.values(ACTIONS),
        description: "Action to perform",
      },
      // Start action
      problem: {
        type: "string",
        description: "Problem description (for start action)",
      },
      context: {
        type: "object",
        description: "Additional context (for start action)",
        properties: {
          error: { type: "string" },
          language: { type: "string" },
          framework: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
      // Think action - Sequential Thinking style
      thought: {
        type: "string",
        description: "Current thinking step (for think action)",
      },
      nextThoughtNeeded: {
        type: "boolean",
        description: "Whether another thought step is needed (for think action)",
      },
      thoughtNumber: {
        type: "integer",
        minimum: 1,
        description: "Current thought number (for think action)",
      },
      totalThoughts: {
        type: "integer",
        minimum: 1,
        description: "Estimated total thoughts needed (for think action)",
      },
      isRevision: {
        type: "boolean",
        description: "Whether this revises previous thinking (for think action)",
      },
      revisesThought: {
        type: "integer",
        minimum: 1,
        description: "Which thought is being reconsidered (for think action)",
      },
      branchFromThought: {
        type: "integer",
        minimum: 1,
        description: "Branching point thought number (for think action)",
      },
      branchId: {
        type: "string",
        description: "Branch identifier (for think action)",
      },
      needsMoreThoughts: {
        type: "boolean",
        description: "If more thoughts are needed (for think action)",
      },
      // Experiment action
      description: {
        type: "string",
        description: "Experiment description (for experiment action)",
      },
      changes: {
        type: "array",
        description: "Code changes to test (for experiment action)",
        items: {
          type: "object",
          properties: {
            file: { type: "string" },
            change: { type: "string" },
            reason: { type: "string" },
          },
          required: ["file", "change", "reason"],
        },
      },
      expected: {
        type: "string",
        description: "Expected outcome (for experiment action)",
      },
      // Observe action
      success: {
        type: "boolean",
        description: "Whether the experiment succeeded (for observe action)",
      },
      output: {
        type: "string",
        description: "Output from the experiment (for observe action)",
      },
      learning: {
        type: "string",
        description: "What was learned (for observe action)",
      },
      next: {
        type: "string",
        enum: ["fixed", "iterate", "pivot"],
        description: "Next action to take (for observe action)",
      },
      // Search action
      query: {
        type: "string",
        description: "Search query (for search action)",
      },
      filters: {
        type: "object",
        description: "Search filters (for search action)",
        properties: {
          type: { type: "string", enum: ["error", "solution", "pattern"] },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
          language: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
      },
      // End action
      summary: {
        type: "boolean",
        description: "Whether to return a summary (for end action)",
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
  tools: [DEBUG_THINKING_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === TOOL_NAME) {
    const args = request.params.arguments as Record<string, unknown>;
    const action = args.action as string;

    switch (action) {
      case ACTIONS.START:
        return debugServer.start({
          problem: args.problem as string,
          context: args.context as any
        });

      case ACTIONS.THINK:
        return debugServer.think({
          thought: args.thought as string,
          nextThoughtNeeded: args.nextThoughtNeeded as boolean,
          thoughtNumber: args.thoughtNumber as number,
          totalThoughts: args.totalThoughts as number,
          isRevision: args.isRevision as boolean,
          revisesThought: args.revisesThought as number,
          branchFromThought: args.branchFromThought as number,
          branchId: args.branchId as string,
          needsMoreThoughts: args.needsMoreThoughts as boolean
        });

      case ACTIONS.EXPERIMENT:
        return debugServer.experiment({
          description: args.description as string,
          changes: args.changes as any[],
          expected: args.expected as string
        });

      case ACTIONS.OBSERVE:
        return await debugServer.observe({
          success: args.success as boolean,
          output: args.output as string,
          learning: args.learning as string,
          next: args.next as any
        });

      case ACTIONS.SEARCH:
        return debugServer.search({
          query: args.query as string,
          filters: args.filters as any
        });

      case ACTIONS.END:
        return await debugServer.end(args.summary as boolean);

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
  logger.info("Code Debug & Thinking MCP Server running on stdio");

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