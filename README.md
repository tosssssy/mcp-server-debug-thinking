# MCP Server Debug Thinking

[![npm version](https://img.shields.io/npm/v/mcp-server-debug-thinking.svg)](https://www.npmjs.com/package/mcp-server-debug-thinking)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/mcp-server-debug-thinking.svg)](https://nodejs.org)

A graph-based Model Context Protocol (MCP) server for systematic debugging using Problem-Solution Trees and Hypothesis-Experiment-Learning cycles.

## 🚀 Features

- **🌳 Problem-Solution Trees**: Decompose complex problems hierarchically
- **🔬 H-E-L Cycles**: Hypothesis → Experiment → Learning methodology
- **🧠 Knowledge Graph**: Build reusable debugging knowledge over time
- **🔍 Pattern Recognition**: Automatically identify successful debugging patterns
- **💡 Learning Extraction**: Capture and reuse insights from every session
- **📊 Graph Analysis**: Query similar problems, successful patterns, and solutions
- **💾 Persistent Storage**: All debugging knowledge is saved and searchable

## 📦 Installation

### Via npm (Recommended)

```bash
npm install -g mcp-server-debug-thinking
```

### From Source

```bash
git clone https://github.com/yourusername/mcp-server-debug-thinking.git
cd mcp-server-debug-thinking
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
    "debug-thinking": {
      "command": "npx",
      "args": ["mcp-server-debug-thinking"]
    }
  }
}
```

## 📖 Core Concepts

This tool models debugging as a **knowledge graph** where:

### Nodes
- **Problem**: Issues to be solved
- **Hypothesis**: Theories about causes
- **Experiment**: Tests to validate hypotheses
- **Observation**: Results from experiments
- **Learning**: Insights gained
- **Solution**: Verified fixes

### Edges (Relationships)
- `decomposes`: Problem → SubProblem
- `hypothesizes`: Problem → Hypothesis
- `tests`: Hypothesis → Experiment
- `produces`: Experiment → Observation
- `learns`: Observation → Learning
- `contradicts`/`supports`: Evidence ↔ Hypothesis
- `solves`: Solution → Problem

## 🎯 Three Simple Actions

### 1. CREATE - Add nodes to the graph

```typescript
{
  action: "create",
  nodeType: "problem" | "hypothesis" | "experiment" | "observation" | "learning" | "solution",
  content: "Description of the node",
  parentId?: "parent-node-id",  // Auto-creates appropriate relationship
  metadata?: {
    confidence?: 75,
    tags?: ["react", "performance"]
  }
}
```

### 2. CONNECT - Create relationships

```typescript
{
  action: "connect",
  from: "source-node-id",
  to: "target-node-id",
  type: "supports" | "contradicts" | "learns" | ...,
  strength?: 0.8,
  metadata?: {
    reasoning: "Based on test results..."
  }
}
```

### 3. QUERY - Search and analyze

```typescript
{
  action: "query",
  queryType: "similar-problems" | "successful-patterns" | "learning-path" | ...,
  parameters: {
    pattern?: "search text",
    nodeId?: "reference-node",
    confidence?: 70,
    limit?: 10
  }
}
```

## 💡 Usage Examples

### Basic Debugging Workflow

```typescript
// 1. Define the problem
await use_tool("debug_thinking", {
  action: "create",
  nodeType: "problem",
  content: "App crashes on startup with TypeError"
});

// 2. Create hypothesis (auto-creates 'hypothesizes' edge)
await use_tool("debug_thinking", {
  action: "create",
  nodeType: "hypothesis",
  content: "Missing null check in user data",
  parentId: "problem-id",
  metadata: { confidence: 80 }
});

// 3. Design experiment (auto-creates 'tests' edge)
await use_tool("debug_thinking", {
  action: "create",
  nodeType: "experiment",
  content: "Add optional chaining to user.name access",
  parentId: "hypothesis-id"
});

// 4. Record observation (auto-creates 'produces' edge)
await use_tool("debug_thinking", {
  action: "create",
  nodeType: "observation",
  content: "Error resolved, app loads successfully",
  parentId: "experiment-id"
});

// 5. Extract learning
await use_tool("debug_thinking", {
  action: "create",
  nodeType: "learning",
  content: "Always validate external data before use"
});

// 6. Connect observation to learning
await use_tool("debug_thinking", {
  action: "connect",
  from: "observation-id",
  to: "learning-id",
  type: "learns"
});
```

### Advanced Queries

```typescript
// Find similar problems
await use_tool("debug_thinking", {
  action: "query",
  queryType: "similar-problems",
  parameters: {
    pattern: "TypeError null reference",
    limit: 5
  }
});

// Find successful patterns
await use_tool("debug_thinking", {
  action: "query",
  queryType: "successful-patterns",
  parameters: {
    tags: ["react", "state-management"]
  }
});

// Trace learning path
await use_tool("debug_thinking", {
  action: "query",
  queryType: "learning-path",
  parameters: {
    nodeId: "problem-id"
  }
});

// Visualize subgraph
await use_tool("debug_thinking", {
  action: "query",
  queryType: "graph-visualization",
  parameters: {
    nodeId: "root-problem-id",
    depth: 3
  }
});
```

### Complex Problem Decomposition

```typescript
// Root problem
const rootProblem = await use_tool("debug_thinking", {
  action: "create",
  nodeType: "problem",
  content: "Application performance degrades over time"
});

// Decompose into sub-problems
await use_tool("debug_thinking", {
  action: "create",
  nodeType: "problem",
  content: "Memory usage increases continuously",
  parentId: rootProblem.nodeId
});

await use_tool("debug_thinking", {
  action: "create",
  nodeType: "problem",
  content: "API response times growing",
  parentId: rootProblem.nodeId
});

// Continue decomposition and investigation...
```

## 📁 Data Storage

All graph data is persisted in `~/.debug-thinking-mcp/`:

```
~/.debug-thinking-mcp/
├── nodes.jsonl          # All nodes in JSONL format
├── edges.jsonl          # All relationships
└── graph-metadata.json  # Graph statistics
```

## 🔍 Query Types

- **similar-problems**: Find problems similar to a given pattern
- **successful-patterns**: Identify patterns that led to solutions
- **failed-hypotheses**: Learn from disproven theories
- **learning-path**: Trace the path from problem to solution
- **solution-candidates**: Find potential solutions for a problem
- **graph-visualization**: Export graph in Mermaid/DOT format
- **node-details**: Get comprehensive information about a node
- **related-nodes**: Find all connected nodes

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Format code
npm run format
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on the [Model Context Protocol](https://modelcontextprotocol.io)
- Inspired by Problem-Solution Trees and scientific debugging methods
- Thanks to all contributors and users

---

Made with ❤️ by the MCP community