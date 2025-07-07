# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

- **Build**: `npm run build` - Compiles TypeScript and creates executable
- **Development**: `npm run dev` - Runs TypeScript compiler in watch mode
- **Clean**: `npm run clean` - Removes dist directory
- **Rebuild**: `npm run rebuild` - Clean and build in sequence
- **Lint**: `npm run lint` - Run ESLint on TypeScript files
- **Format**: `npm run format` - Format code with Prettier

## Architecture Overview

This is a graph-based MCP (Model Context Protocol) server for systematic debugging using Problem-Solution Trees and Hypothesis-Experiment-Learning cycles.

### Core Services

- **GraphService** (`src/services/GraphService.ts`): Main service managing the debugging knowledge graph
  - Handles CREATE, CONNECT, and QUERY actions
  - Manages nodes (problems, hypotheses, experiments, observations, learnings, solutions)
  - Manages edges (relationships between nodes)
  - Provides pattern recognition and search capabilities

- **GraphStorage** (`src/services/GraphStorage.ts`): Handles persistence of graph data
  - Stores nodes and edges in JSONL format
  - Manages graph metadata
  - Provides efficient loading and saving

### Type System

- **Graph Types** (`src/types/graph.ts`):
  - `Node`: Base type for all graph nodes
  - `Edge`: Relationships between nodes
  - `DebugGraph`: The complete graph structure
  - Specific node types: ProblemNode, HypothesisNode, ExperimentNode, etc.

- **Action Types** (`src/types/graphActions.ts`):
  - `CreateAction`: Parameters for creating nodes
  - `ConnectAction`: Parameters for creating edges
  - `QueryAction`: Parameters for searching the graph
  - Response types for each action

### MCP Tools Exposed

The server exposes a single tool: **debug_thinking** with three actions:

1. **CREATE**: Add nodes to the knowledge graph
   - Automatically creates edges based on parent-child relationships
   - Supports all node types: problem, hypothesis, experiment, observation, learning, solution

2. **CONNECT**: Create explicit relationships between nodes
   - Supports relationship types: decomposes, hypothesizes, tests, produces, learns, contradicts, supports, solves

3. **QUERY**: Search and analyze the graph
   - Query types: similar-problems, successful-patterns, learning-path, graph-visualization, etc.

### Key Design Patterns

- **Graph-based knowledge representation**: All debugging knowledge is stored as a directed graph
- **Automatic edge creation**: Parent-child relationships automatically create appropriate edges
- **Pattern recognition**: Identifies successful debugging patterns across sessions
- **TypeScript-first**: Comprehensive type definitions ensure type safety
- **File system persistence**: Graph data stored in `.debug-thinking-mcp/` directory
- **Modular architecture**: Clean separation between graph operations, storage, and MCP interface

### Entry Point

The main entry point is `src/index.ts` which:
- Sets up the MCP server using stdio transport
- Routes actions to GraphService methods
- Handles responses in MCP-compliant format

## Development Notes

- The project uses TypeScript with ES2022 target
- ESLint and Prettier are configured for code quality
- Node.js 16+ is required
- UUID v4 is used for generating unique IDs
- Graph data is persisted as JSONL files for efficiency
- The project follows the MCP SDK patterns for tool implementation