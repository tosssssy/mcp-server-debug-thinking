# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of MCP Server Debug Iteration
- Core debugging session management functionality
- Pattern learning system for error recognition
- Persistent storage for debugging history
- Visual console output with color-coded status
- Support for iterative debugging workflows
- Session summary and statistics generation
- Integration with Claude Desktop and VS Code

### Features
- `start_session` - Initialize new debugging sessions
- `record_step` - Track debugging steps with hypothesis testing
- `get_summary` - Retrieve session statistics and insights
- `end_session` - Save and close debugging sessions
- `list_sessions` - View all debugging sessions

### Technical
- TypeScript implementation with ES modules
- MCP SDK integration for tool communication
- File-based persistence in `.debug-iteration-mcp` directory
- Colorful terminal output using chalk library

## [0.1.0] - 2024-XX-XX

### Added
- Initial project setup
- Basic MCP server implementation
- README documentation
- MIT License

[Unreleased]: https://github.com/yourusername/mcp-server-debug-iteration/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/mcp-server-debug-iteration/releases/tag/v0.1.0