# MCP Server Debug Iteration

[![npm version](https://img.shields.io/npm/v/mcp-server-debug-iteration.svg)](https://www.npmjs.com/package/mcp-server-debug-iteration)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/mcp-server-debug-iteration.svg)](https://nodejs.org)

A streamlined Model Context Protocol (MCP) server for systematic debugging with integrated sequential thinking support and intelligent pattern learning.

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

The server provides a single, streamlined tool called `debug_iteration` with intuitive actions.

### Simple Workflow

#### 1. Start a Session

```typescript
// Simple start
await use_tool("debug_iteration", { 
  action: "start",
  problem: "API endpoint returns 500 error",
  context: {
    error: "TypeError: Cannot read property 'data' of undefined",
    language: "typescript",
    framework: "express"
  }
});
```

#### 2. Think (Integrates with sequential-thinking)

```typescript
// Record a single thought
await use_tool("debug_iteration", {
  action: "think",
  thought: "The error suggests the response object structure differs from expected",
  confidence: 75
});

// Or multiple thoughts at once
await use_tool("debug_iteration", {
  action: "think", 
  thought: [
    "Response might be null or undefined",
    "Need to add defensive programming",
    "Should use optional chaining"
  ]
});
```

#### 3. Experiment

```typescript
await use_tool("debug_iteration", {
  action: "experiment",
  description: "Add optional chaining to safely access nested properties",
  changes: [{
    file: "src/api/users.js",
    change: "return response?.data?.user || null;",
    reason: "Prevent accessing properties of undefined"
  }],
  expected: "Tests pass and endpoint returns null for missing data"
});
```

#### 4. Observe Results

```typescript
await use_tool("debug_iteration", {
  action: "observe",
  success: true,
  output: "All tests passed",
  learning: "API responses need defensive programming for missing data",
  next: "fixed"  // or "iterate" or "pivot"
});
```

#### 5. Search for Similar Issues

```typescript
await use_tool("debug_iteration", {
  action: "search",
  query: "TypeError undefined property access",
  filters: {
    confidence: 70,
    language: "typescript"
  }
});
```

#### 6. End Session

```typescript
// End without summary
await use_tool("debug_iteration", { action: "end" });

// End with summary
await use_tool("debug_iteration", { 
  action: "end",
  summary: true
});
```

### Sequential Thinking Integration

This tool works seamlessly with the sequential-thinking MCP server:

```typescript
// Use sequential-thinking to analyze the problem
const thinking = await sequential_thinking({
  thought: "This TypeError suggests a null reference issue...",
  thoughtNumber: 1,
  totalThoughts: 3
});

// Feed the thinking directly into debug_iteration
await use_tool("debug_iteration", {
  action: "think",
  thought: thinking.thought,
  confidence: 85
});
```

## 📁 Data Storage

All data is stored in `.debug-iteration-mcp/` using efficient JSONL format:

```plaintext
.debug-iteration-mcp/
├── sessions.jsonl           # All debugging sessions
├── error-patterns.jsonl     # Learned error patterns
├── successful-fixes.jsonl   # Working solutions
└── metadata.json           # Statistics
```

## 🧪 Complete Example

```typescript
// 1. Start debugging
await use_tool("debug_iteration", {
  action: "start",
  problem: "User profile page crashes",
  context: { error: "TypeError: Cannot read property 'name' of undefined" }
});

// 2. Think about the problem
await use_tool("debug_iteration", {
  action: "think",
  thought: "User data might not be loaded before render"
});

// 3. Plan an experiment
await use_tool("debug_iteration", {
  action: "experiment",
  description: "Add loading state and null checks",
  changes: [{
    file: "UserProfile.js",
    change: "if (!user) return <Loading />",
    reason: "Prevent rendering before data loads"
  }],
  expected: "Page shows loading state instead of crashing"
});

// 4. Test and observe
await use_tool("debug_iteration", {
  action: "observe",
  success: true,
  learning: "Always validate data before rendering",
  next: "fixed"
});

// 5. Search for similar issues
await use_tool("debug_iteration", {
  action: "search",
  query: "null reference TypeError"
});

// 6. End with summary
await use_tool("debug_iteration", {
  action: "end",
  summary: true
});
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
