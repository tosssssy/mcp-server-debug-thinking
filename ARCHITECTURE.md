# Architecture Overview

## Directory Structure

```
src/
├── index.ts              # Entry point and MCP server setup
├── types/
│   ├── graph.ts         # Graph structure types (Node, Edge, DebugGraph)
│   └── graphActions.ts  # Action types (CREATE, CONNECT, QUERY)
├── services/
│   ├── GraphService.ts  # Main graph operations service
│   └── GraphStorage.ts  # Graph persistence layer
├── utils/
│   ├── logger.ts        # Logging utilities
│   ├── storage.ts       # File system operations
│   └── format.ts        # Response formatting
└── constants.ts         # Application constants
```

## Key Components

### 1. Type System (`src/types/`)

- **graph.ts**: Core graph types
  - `Node`: Base type for all debugging elements (problems, hypotheses, etc.)
  - `Edge`: Relationships between nodes
  - `DebugGraph`: Complete graph structure with metadata
  - Specific node types: ProblemNode, HypothesisNode, ExperimentNode, ObservationNode, LearningNode, SolutionNode

- **graphActions.ts**: Action-related types
  - `CreateAction`: Parameters for node creation
  - `ConnectAction`: Parameters for edge creation
  - `QueryAction`: Parameters for graph queries
  - Response types for each action

### 2. Services (`src/services/`)

- **GraphService**: Core service managing the debugging knowledge graph
  - Node and edge creation with automatic relationship inference
  - Pattern recognition and similarity matching
  - Query execution (similar problems, successful patterns, etc.)
  - Suggestion generation based on graph analysis

- **GraphStorage**: Persistence layer for graph data
  - JSONL format for efficient storage and streaming
  - Separate files for nodes, edges, and metadata
  - Deduplication on load to handle multiple saves

### 3. Utilities (`src/utils/`)

- **Logger**: Centralized logging with environment-based configuration
- **Storage**: File system abstractions for JSONL operations
- **Format**: MCP-compliant response formatting

### 4. Constants (`src/constants.ts`)
- File paths and directory names
- Server metadata and version
- Error messages

## Design Principles

1. **Graph-First Architecture**: All debugging knowledge is represented as a directed graph
2. **Knowledge Accumulation**: Every debugging session contributes to a growing knowledge base
3. **Pattern Recognition**: Automatic identification of successful debugging patterns
4. **Type Safety**: Comprehensive TypeScript types ensure compile-time safety
5. **Simplicity**: Only three actions (CREATE, CONNECT, QUERY) provide full functionality

## Data Flow

1. **Request Reception**: MCP server receives tool requests with action type
2. **Action Dispatch**: Actions are routed to GraphService methods
3. **Graph Operations**:
   - CREATE: Add nodes with automatic edge creation
   - CONNECT: Explicitly create relationships
   - QUERY: Search and analyze the graph
4. **Persistence**: Graph changes are persisted to JSONL files
5. **Response**: Results are formatted as MCP-compliant responses

## Key Features

### Automatic Edge Creation
When creating a node with a `parentId`, the system automatically creates an appropriate edge based on the node types:
- Problem → Problem: `decomposes`
- Problem → Hypothesis: `hypothesizes`
- Hypothesis → Experiment: `tests`
- Experiment → Observation: `produces`
- Observation → Learning: `learns`

### Query Capabilities
- **similar-problems**: Find problems matching a pattern
- **successful-patterns**: Identify debugging patterns that led to solutions
- **learning-path**: Trace the path from problem to solution
- **graph-visualization**: Export graph in Mermaid/DOT format
- **node-details**: Get comprehensive information about a node
- **related-nodes**: Find all connected nodes

### Storage Format
```
~/.debug-thinking-mcp/
├── nodes.jsonl          # All nodes (deduplicated on load)
├── edges.jsonl          # All relationships
└── graph-metadata.json  # Graph-level statistics
```

## Future Extensibility

The graph-based architecture allows for easy extension:
- New node types can be added without changing existing code
- New edge types can represent additional relationships
- New query types can provide specialized analysis
- Pattern matching algorithms can be enhanced
- Integration with external tools through graph export