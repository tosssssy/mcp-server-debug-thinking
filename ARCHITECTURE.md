# Architecture Overview

## Directory Structure

```
src/
├── index.ts              # Entry point and MCP server setup
├── types/
│   ├── index.ts         # Type exports
│   ├── debug.ts         # Debugging-related types
│   └── search.ts        # Search-related types
├── services/
│   ├── DebugServer.ts   # Main debugging server logic
│   └── SearchIndex.ts   # Search indexing and querying
├── utils/
│   ├── logger.ts        # Logging utilities
│   ├── storage.ts       # File system operations
│   └── format.ts        # Response formatting
└── constants.ts         # Application constants
```

## Key Components

### 1. Type System (`src/types/`)
- **debug.ts**: Core debugging types (Problem, Hypothesis, Experiment, Result, etc.)
- **search.ts**: Search-related types (SearchQuery, PatternMatch)

### 2. Services (`src/services/`)
- **DebugServer**: Main service handling debugging sessions
  - Session management
  - Knowledge persistence
  - Learning from results
- **SearchIndex**: In-memory search index
  - Text extraction and indexing
  - Similarity scoring
  - Filtering and ranking

### 3. Utilities (`src/utils/`)
- **Logger**: Centralized logging with levels
  - Environment-based configuration
  - Colored output
- **Storage**: File system abstractions
  - JSON file operations
  - Directory management
- **Format**: Response formatting helpers
  - Debug step visualization
  - JSON response creation

### 4. Constants (`src/constants.ts`)
- Configuration values
- Scoring weights
- Error messages
- Tool metadata

## Design Principles

1. **Separation of Concerns**: Each module has a single, well-defined responsibility
2. **Type Safety**: Extensive use of TypeScript types for compile-time safety
3. **Dependency Injection**: Services are loosely coupled and testable
4. **Immutability**: Data structures are treated as immutable where possible
5. **Error Handling**: Consistent error handling and messaging

## Data Flow

1. **Request Reception**: MCP server receives tool requests
2. **Action Routing**: Requests are routed to appropriate DebugServer methods
3. **Processing**: Business logic is executed (session management, searching)
4. **Persistence**: Data is saved to file system as needed
5. **Response**: Formatted responses are sent back to the client

## Key Improvements

- **Modularity**: Code is organized into logical modules
- **Maintainability**: Clear separation makes updates easier
- **Testability**: Services can be tested independently
- **Performance**: Search index is optimized for quick lookups
- **Extensibility**: New features can be added with minimal impact