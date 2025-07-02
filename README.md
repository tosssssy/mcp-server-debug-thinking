# MCP Server Debug Iteration

[![npm version](https://img.shields.io/npm/v/mcp-server-debug-iteration.svg)](https://www.npmjs.com/package/mcp-server-debug-iteration)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/mcp-server-debug-iteration.svg)](https://nodejs.org)

A Model Context Protocol (MCP) server that provides systematic debugging and code iteration tracking capabilities with intelligent pattern learning for Claude and other AI assistants.

## 🚀 Features

- **🔍 Structured Debugging**: Track problems, hypotheses, experiments, and results in a systematic way
- **🧠 Pattern Learning**: Automatically recognize and learn from error patterns across sessions
- **📊 Session Management**: Organize debugging work into trackable sessions with summaries
- **💾 Persistent Storage**: Save debugging history and learned patterns for future reference
- **🎨 Visual Feedback**: Beautiful, colorful console output for debugging steps
- **🔄 Iterative Workflow**: Support for iteration, pivoting, and research-based debugging approaches

## 📦 Installation

### Via npm (Recommended)

```bash
npm install -g mcp-server-debug-iteration
```

### From Source

```bash
git clone https://github.com/yourusername/mcp-server-debug-iteration.git
cd mcp-server-debug-iteration
npm install
npm run build
```

## 🔧 Configuration

### Claude Desktop Integration

Add to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "debug-iteration": {
      "command": "npx",
      "args": ["mcp-server-debug-iteration"],
      "env": {
        "DISABLE_DEBUG_LOGGING": "false"
      }
    }
  }
}
```

### VS Code Integration

For VS Code with the MCP extension, add to your workspace settings:

```json
{
  "mcp.servers": {
    "debug-iteration": {
      "command": "npx",
      "args": ["mcp-server-debug-iteration"]
    }
  }
}
```

## 📖 Usage

The server provides a tool called `code_debug_think` for systematic debugging workflows.

### Available Actions

#### 1. Start a Debugging Session

```typescript
// Start a new session
await use_tool("code_debug_think", { action: "start_session" });

// Or resume a specific session
await use_tool("code_debug_think", { 
  action: "start_session", 
  sessionId: "debug-123456789" 
});
```

#### 2. Record a Debugging Step

```typescript
await use_tool("code_debug_think", {
  action: "record_step",
  problem: {
    description: "API endpoint returns 500 error",
    errorMessage: "TypeError: Cannot read property 'data' of undefined",
    expectedBehavior: "Should return user data with status 200",
    actualBehavior: "Crashes with undefined error"
  },
  hypothesis: {
    cause: "Response object structure differs from expected format",
    affectedCode: ["src/api/users.js:45-50", "src/utils/response.js:12"],
    confidence: 75
  },
  experiment: {
    changes: [{
      file: "src/api/users.js",
      lineRange: [45, 50],
      oldCode: "return response.data.user;",
      newCode: "return response?.data?.user || null;",
      reasoning: "Add optional chaining to safely access nested properties"
    }],
    testCommand: "npm test -- users.test.js",
    expectedOutcome: "Tests pass and endpoint returns null for missing data"
  },
  result: {
    success: true,
    output: "All tests passed",
    learning: "API responses need defensive programming for missing data"
  },
  nextAction: "fixed"
});
```

#### 3. Get Session Summary

```typescript
await use_tool("code_debug_think", { action: "get_summary" });
// Returns: session statistics, patterns found, solutions applied
```

#### 4. End Session

```typescript
await use_tool("code_debug_think", { action: "end_session" });
// Saves all data and learnings from the session
```

#### 5. List All Sessions

```typescript
await use_tool("code_debug_think", { action: "list_sessions" });
// Returns: list of all debugging sessions with metadata
```

### Next Actions Explained

- **`fixed`** - Problem is completely resolved
- **`iterate`** - Try a different solution with the same hypothesis
- **`pivot`** - Current hypothesis is wrong, need a new approach
- **`research`** - Need more information before proceeding

## 📁 Data Storage

All debugging data is persisted in `.debug-iteration-mcp/` directory:

```plaintext
.debug-iteration-mcp/
├── error-patterns.json      # Learned error patterns
├── successful-fixes.json    # Database of working solutions
├── metadata.json           # Statistics and metadata
└── sessions/              # Individual session records
    ├── debug-xxxxx.json
    └── debug-yyyyy.json
```

## 🧪 Examples

### Example 1: Debugging a Memory Leak

```typescript
// Start investigation
await use_tool("code_debug_think", {
  action: "record_step",
  problem: {
    description: "Memory usage increases over time",
    errorMessage: "JavaScript heap out of memory",
    expectedBehavior: "Stable memory usage",
    actualBehavior: "Memory grows unbounded"
  },
  hypothesis: {
    cause: "Event listeners not being removed",
    affectedCode: ["src/components/Dashboard.js"],
    confidence: 60
  },
  experiment: {
    changes: [{
      file: "src/components/Dashboard.js",
      lineRange: [85, 90],
      oldCode: "window.addEventListener('resize', this.handleResize);",
      newCode: "this.resizeHandler = this.handleResize.bind(this);\nwindow.addEventListener('resize', this.resizeHandler);",
      reasoning: "Store reference to bound function for proper cleanup"
    }],
    expectedOutcome: "Memory usage stabilizes"
  }
});
```

### Example 2: Learning from Patterns

After multiple debugging sessions, the server learns patterns:

```json
{
  "pattern": "Cannot read property '.*' of undefined",
  "commonCause": "Missing null checks or API response validation",
  "suggestedFix": "Add optional chaining or default values",
  "occurrences": 15
}
```

## 🛠️ Development

### Building from Source

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

### Environment Variables

- `DISABLE_DEBUG_LOGGING` - Set to `"true"` to disable console output (default: `"false"`)
- `DEBUG_DATA_DIR` - Custom directory for debug data (default: `./.debug-iteration-mcp`)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🔒 Security

For security issues, please see our [Security Policy](SECURITY.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on the [Model Context Protocol](https://modelcontextprotocol.io)
- Inspired by systematic debugging methodologies
- Thanks to all contributors and users

## 📞 Support

- 📧 Email: [your.email@example.com](mailto:your.email@example.com)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/mcp-server-debug-iteration/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/yourusername/mcp-server-debug-iteration/discussions)

---

Made with ❤️ by the MCP community
