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

This is an MCP (Model Context Protocol) server for systematic debugging and code thinking process tracking. The codebase follows a service-oriented architecture:

### Core Services
- **DebugServer** (`src/services/DebugServer.ts`): Main service managing debugging sessions, thinking processes, and thoughts
- **SearchIndex** (`src/services/searchIndex.ts`): Pattern searching service using regex

### MCP Tools Exposed
1. **debug_thinking**: Manages debugging sessions with actions like START, THINK, EXPERIMENT, OBSERVE, SEARCH, and END
2. **debug_thinking** (search action): Searches for patterns across debugging sessions

### Key Design Patterns
- TypeScript-first with comprehensive type definitions in `src/types/`
- Session-based state management with thinking processes and thoughts
- File system persistence for debugging data (stored in `.debug-thinking-mcp/` directory)
- Modular error handling with custom error types

### Entry Point
The main entry point is `src/index.ts` which sets up the MCP server using stdio transport.

## Development Notes

- The project uses TypeScript with ES2022 target
- ESLint and Prettier are configured for code quality
- No testing framework is currently set up
- Session data is persisted as JSONL files in `.debug-thinking-mcp/`
- The project follows the MCP SDK patterns for tool implementation