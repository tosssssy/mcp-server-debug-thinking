# Code Debug & Iteration MCP Server

A Model Context Protocol (MCP) server that provides systematic debugging and code iteration tracking capabilities for Claude Code.

## Features

- **Structured Debugging**: Track problems, hypotheses, experiments, and results
- **Pattern Learning**: Automatically recognize and learn from error patterns
- **Session Management**: Organize debugging work into sessions
- **Persistent Storage**: Save debugging history and learned patterns
- **Visual Feedback**: Colorful console output for debugging steps

## Installation

```bash
npm install
npm run build
```

## Usage

### With Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "debug-iteration": {
      "command": "node",
      "args": ["/path/to/debug-iteration-mcp/dist/index.js"],
      "env": {
        "DISABLE_DEBUG_LOGGING": "false"
      }
    }
  }
}
```

### Available Actions

1. **Start Session**

   ```json
   { "action": "start_session" }
   ```

2. **Record Debugging Step**

   ```json
   {
     "action": "record_step",
     "problem": {
       "description": "Function throws TypeError",
       "errorMessage": "Cannot read property 'x' of undefined",
       "expectedBehavior": "Should return calculated value",
       "actualBehavior": "Throws error"
     },
     "hypothesis": {
       "cause": "Missing null check before accessing property",
       "affectedCode": ["src/calculator.js:42"],
       "confidence": 85
     },
     "experiment": {
       "changes": [
         {
           "file": "src/calculator.js",
           "lineRange": [42, 45],
           "oldCode": "return obj.x * 2;",
           "newCode": "return obj?.x ? obj.x * 2 : 0;",
           "reasoning": "Add optional chaining to handle undefined object"
         }
       ],
       "expectedOutcome": "Function returns 0 when obj is undefined"
     },
     "result": {
       "success": true,
       "learning": "Optional chaining prevents TypeError when accessing nested properties"
     },
     "nextAction": "fixed"
   }
   ```

3. **Get Session Summary**

   ```json
   { "action": "get_summary" }
   ```

4. **End Session**

   ```json
   { "action": "end_session" }
   ```

5. **List All Sessions**

   ```json
   { "action": "list_sessions" }
   ```

## Data Storage

All debugging data is stored in `.debug-iteration-mcp/` directory:

- `error-patterns.json` - Learned error patterns
- `successful-fixes.json` - Database of successful fixes
- `metadata.json` - Overall statistics
- `sessions/` - Individual session files

## Next Actions

- `fixed` - Problem is resolved
- `iterate` - Try a different approach with same hypothesis
- `pivot` - Change hypothesis completely
- `research` - Need more information

## Environment Variables

- `DISABLE_DEBUG_LOGGING` - Set to "true" to disable console output

## Development

```bash
# Watch mode for development
npm run dev

# Build for production
npm run build
```

## License

MIT
