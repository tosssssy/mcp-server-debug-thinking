# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-07

### Changed
- **BREAKING**: Complete reimplementation using graph-based architecture
- Replaced linear debugging sessions with Problem-Solution Trees
- Replaced sequential actions with three simple actions: CREATE, CONNECT, QUERY
- Changed from session-based to knowledge-graph-based persistence

### Added
- Graph-based knowledge representation for debugging
- Node types: Problem, Hypothesis, Experiment, Observation, Learning, Solution
- Edge types: decomposes, hypothesizes, tests, produces, learns, contradicts, supports, solves
- Automatic edge creation based on parent-child relationships
- Pattern recognition across debugging sessions
- Query types for finding similar problems and successful patterns
- Graph visualization support (Mermaid/DOT format)
- Learning extraction and reuse across sessions

### Removed
- Sequential thinking process (now part of graph nodes)
- Session-based debugging approach
- Separate THINK, EXPERIMENT, OBSERVE actions
- SearchIndex service (replaced by graph queries)

### Technical
- Migrated to graph-based data model
- JSONL storage format for efficient persistence
- UUID v4 for unique node and edge IDs
- TypeScript types for comprehensive type safety

## [0.1.0] - 2024-01-01

### Added
- Initial release of MCP Server Debug Thinking
- Core debugging session management functionality
- Pattern learning system for error recognition
- Persistent storage for debugging history
- Visual console output with color-coded status
- Support for iterative debugging workflows
- Session summary and statistics generation
- Integration with Claude Desktop and VS Code
- Advanced search functionality to find similar debugging patterns
- Session metadata support (language, framework, tags)
- Automatic indexing of debugging sessions for fast search
- Similarity scoring algorithm for pattern matching

### Features
- `start` - Initialize new debugging sessions
- `think` - Record sequential thinking process
- `experiment` - Define experiments to test hypotheses
- `observe` - Record results and learnings
- `search` - Find similar problems and solutions
- `end` - Complete debugging sessions

### Technical
- TypeScript implementation with ES modules
- MCP SDK integration for tool communication
- File-based persistence in `.debug-thinking-mcp` directory
- Colorful terminal output using chalk library

[1.0.0]: https://github.com/yourusername/mcp-server-debug-thinking/releases/tag/v1.0.0
[0.1.0]: https://github.com/yourusername/mcp-server-debug-thinking/releases/tag/v0.1.0