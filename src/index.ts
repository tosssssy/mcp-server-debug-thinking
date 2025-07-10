#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { GraphService } from "./services/GraphService.js";
import {
  ActionType,
  CreateAction,
  ConnectAction,
  QueryAction,
  GraphAction,
} from "./types/graphActions.js";
import { createJsonResponse } from "./utils/format.js";
import { logger } from "./utils/logger.js";
import { TOOL_NAME, SERVER_NAME, SERVER_VERSION } from "./constants.js";

const DEBUG_THINKING_TOOL: Tool = {
  name: TOOL_NAME,
  description: `Graph-based debugging tool using Problem-Solution Trees and Hypothesis-Experiment-Learning cycles.

This tool models debugging as a knowledge graph with three simple actions:

1. CREATE - Create nodes (problem, hypothesis, experiment, observation, learning, solution)
2. CONNECT - Create relationships between nodes
3. QUERY - Search and analyze the debugging graph

Workflow example:
- CREATE problem "App crashes on startup"
- CREATE hypothesis "Memory leak in event handlers" (auto-connects to problem)
- CREATE experiment "Add cleanup in useEffect" (auto-connects to hypothesis)
- CREATE observation "Memory usage stable" (auto-connects to experiment)
- CREATE learning "Always cleanup React effects"
- CONNECT observation to learning with 'learns' relationship

Features:
- Automatic relationship creation based on parent-child context
- Pattern recognition across debugging sessions
- Knowledge accumulation and reuse
- Fast similarity search for problems and solutions

Data persists in ~/.debug-thinking-mcp/`,
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "connect", "query"],
        description: "Action to perform",
      },
      // CREATE action
      nodeType: {
        type: "string",
        enum: ["problem", "hypothesis", "experiment", "observation", "learning", "solution"],
        description: "Type of node to create (for create action)",
      },
      content: {
        type: "string",
        description: "Content of the node (for create action)",
      },
      parentId: {
        type: "string",
        description: "Parent node ID for automatic relationship creation (for create action)",
      },
      metadata: {
        type: "object",
        description: "Additional metadata for the node (for create action)",
        properties: {
          confidence: { type: "number", minimum: 0, maximum: 100 },
          tags: { type: "array", items: { type: "string" } },
        },
      },
      // CONNECT action
      from: {
        type: "string",
        description: "Source node ID (for connect action)",
      },
      to: {
        type: "string",
        description: "Target node ID (for connect action)",
      },
      type: {
        type: "string",
        enum: [
          "decomposes",
          "hypothesizes",
          "tests",
          "produces",
          "learns",
          "contradicts",
          "supports",
          "solves",
        ],
        description: "Type of relationship (for connect action)",
      },
      strength: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "Strength of the relationship (for connect action)",
      },
      // QUERY action
      queryType: {
        type: "string",
        enum: [
          "similar-problems",
          "recent-activity",
        ],
        description: "Type of query to perform (for query action)",
      },
      parameters: {
        type: "object",
        description: "Query parameters (for query action)",
        properties: {
          pattern: { type: "string", description: "Search pattern for similar-problems query" },
          limit: { type: "integer", minimum: 1, maximum: 100, description: "Maximum number of results to return" },
          minSimilarity: { type: "number", minimum: 0, maximum: 1, description: "Minimum similarity score for similar-problems query" },
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

const graphService = new GraphService();

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [DEBUG_THINKING_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === TOOL_NAME) {
    const args = request.params.arguments as Record<string, unknown>;
    const action = args.action as ActionType;

    let graphAction: GraphAction;

    switch (action) {
      case ActionType.CREATE:
        graphAction = {
          action: ActionType.CREATE,
          nodeType: args.nodeType as any,
          content: args.content as string,
          parentId: args.parentId as string,
          metadata: args.metadata as any,
        };
        return await graphService.create(graphAction);

      case ActionType.CONNECT:
        graphAction = {
          action: ActionType.CONNECT,
          from: args.from as string,
          to: args.to as string,
          type: args.type as any,
          strength: args.strength as number,
          metadata: args.metadata as any,
        };
        return await graphService.connect(graphAction);

      case ActionType.QUERY:
        graphAction = {
          action: ActionType.QUERY,
          type: args.queryType as any,
          parameters: args.parameters as any,
        };
        return await graphService.query(graphAction);

      default:
        return createJsonResponse(
          {
            error: `Unknown action: ${action}`,
            validActions: Object.values(ActionType),
          },
          true,
        );
    }
  }

  return createJsonResponse(
    {
      error: `Unknown tool: ${request.params.name}`,
    },
    true,
  );
});

async function runServer() {
  // グラフサービスを初期化
  await graphService.initialize();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Graph-based Debug MCP Server running on stdio");

  // 正常なシャットダウンを処理
  process.on("SIGINT", async () => {
    logger.info("\n📁 Saving graph data before shutdown...");
    await graphService.saveGraph();
    logger.success("✅ Graph data saved successfully");
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await graphService.saveGraph();
    process.exit(0);
  });
}

runServer().catch((error) => {
  logger.error("Fatal error running server:", error);
  process.exit(1);
});
