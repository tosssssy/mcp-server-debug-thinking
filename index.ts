#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import os from "os";

interface CodeChange {
  file: string;
  lineRange: [number, number];
  oldCode: string;
  newCode: string;
  reasoning: string;
}

interface Problem {
  description: string;
  errorMessage?: string;
  expectedBehavior: string;
  actualBehavior: string;
}

interface Hypothesis {
  cause: string;
  affectedCode: string[];
  confidence: number;
}

interface Experiment {
  changes: CodeChange[];
  testCommand?: string;
  expectedOutcome: string;
}

interface Result {
  success: boolean;
  output?: string;
  newErrors?: string[];
  learning: string;
}

interface CodeThinkingStep {
  id: string;
  timestamp: Date;
  problem?: Problem;
  hypothesis?: Hypothesis;
  experiment?: Experiment;
  result?: Result;
  nextAction?: "fixed" | "iterate" | "pivot" | "research";
}

interface ErrorPattern {
  pattern: string;
  commonCause: string;
  suggestedFix: string;
  occurrences: number;
}

interface Fix {
  problemId: string;
  solution: string;
  changes: CodeChange[];
  verified: boolean;
}

interface DebugSession {
  id: string;
  startTime: Date;
  problem?: Problem;  // Overall problem for the session
  steps: CodeThinkingStep[];
}

class CodeDebugServer {
  private debugSessions: Map<string, DebugSession> = new Map();
  private errorPatterns: ErrorPattern[] = [];
  private successfulFixes: Fix[] = [];
  private currentSessionId: string | null = null;
  private disableLogging: boolean;
  private dataDir: string;

  constructor() {
    this.disableLogging =
      (process.env.DISABLE_DEBUG_LOGGING || "").toLowerCase() === "true";
    // Use home directory or environment variable for data storage
    const baseDir = process.env.DEBUG_DATA_DIR || os.homedir();
    this.dataDir = path.join(baseDir, ".debug-iteration-mcp");
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      // Create data directory if it doesn't exist
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(path.join(this.dataDir, "sessions"), { recursive: true });

      // Load existing knowledge
      await this.loadKnowledge();

      if (!this.disableLogging) {
        console.error(chalk.dim(`📁 Using data directory: ${this.dataDir}`));
      }
    } catch (error) {
      console.error(chalk.red("Failed to initialize storage:"), error);
    }
  }

  private async loadKnowledge(): Promise<void> {
    try {
      // Load error patterns
      const patternsPath = path.join(this.dataDir, "error-patterns.json");
      const patternsData = await fs.readFile(patternsPath, "utf-8");
      this.errorPatterns = JSON.parse(patternsData);

      if (!this.disableLogging) {
        console.error(
          chalk.green(`✓ Loaded ${this.errorPatterns.length} error patterns`),
        );
      }
    } catch (error) {
      if ((error as any).code !== "ENOENT") {
        console.error(chalk.yellow("Failed to load error patterns:"), error);
      }
    }

    try {
      // Load successful fixes
      const fixesPath = path.join(this.dataDir, "successful-fixes.json");
      const fixesData = await fs.readFile(fixesPath, "utf-8");
      this.successfulFixes = JSON.parse(fixesData);

      if (!this.disableLogging) {
        console.error(
          chalk.green(
            `✓ Loaded ${this.successfulFixes.length} successful fixes`,
          ),
        );
      }
    } catch (error) {
      if ((error as any).code !== "ENOENT") {
        console.error(chalk.yellow("Failed to load fixes:"), error);
      }
    }
  }

  private async saveKnowledge(): Promise<void> {
    try {
      // Save error patterns
      await fs.writeFile(
        path.join(this.dataDir, "error-patterns.json"),
        JSON.stringify(this.errorPatterns, null, 2),
      );

      // Save successful fixes
      await fs.writeFile(
        path.join(this.dataDir, "successful-fixes.json"),
        JSON.stringify(this.successfulFixes, null, 2),
      );

      // Save metadata
      await fs.writeFile(
        path.join(this.dataDir, "metadata.json"),
        JSON.stringify(
          {
            lastUpdated: new Date().toISOString(),
            totalPatterns: this.errorPatterns.length,
            totalFixes: this.successfulFixes.length,
            totalSessions: await this.countSessions(),
          },
          null,
          2,
        ),
      );
    } catch (error) {
      console.error(chalk.red("Failed to save knowledge:"), error);
    }
  }

  private async countSessions(): Promise<number> {
    try {
      const files = await fs.readdir(path.join(this.dataDir, "sessions"));
      return files.filter((f) => f.endsWith(".json")).length;
    } catch {
      return 0;
    }
  }

  private async saveSession(sessionId: string): Promise<void> {
    const session = this.debugSessions.get(sessionId);
    if (!session) return;

    try {
      const sessionPath = path.join(
        this.dataDir,
        "sessions",
        `${sessionId}.json`,
      );
      await fs.writeFile(
        sessionPath,
        JSON.stringify(
          {
            id: sessionId,
            startTime: session.startTime,
            endTime: new Date(),
            problem: session.problem,
            steps: session.steps,
            summary: {
              totalSteps: session.steps.length,
              successfulFixes: session.steps.filter((s) => s.result?.success).length,
              finalStatus:
                session.steps[session.steps.length - 1]?.nextAction || "incomplete",
            },
          },
          null,
          2,
        ),
      );
    } catch (error) {
      console.error(chalk.red(`Failed to save session ${sessionId}:`), error);
    }
  }

  private generateId(): string {
    return `debug-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private formatDebugStep(step: CodeThinkingStep, sessionProblem?: Problem): string {
    const { hypothesis, experiment, result } = step;
    const problem = step.problem || sessionProblem;

    let status = "🔍 Investigating";
    let statusColor = chalk.yellow;

    if (result) {
      if (result.success) {
        status = "✅ Fixed";
        statusColor = chalk.green;
      } else if (step.nextAction === "iterate") {
        status = "🔄 Iterating";
        statusColor = chalk.blue;
      } else if (step.nextAction === "pivot") {
        status = "🔀 Pivoting";
        statusColor = chalk.magenta;
      }
    }

    const confidence = hypothesis?.confidence ?? 0;
    const header = statusColor(`${status} | Confidence: ${confidence}%`);
    const border = "═".repeat(60);

    let output = `
╔${border}╗
║ ${header.padEnd(58)} ║
╟${border}╢`;

    if (problem) {
      output += `\n║ ${chalk.bold("Problem:")} ${problem.description.substring(0, 49).padEnd(49)} ║`;
      if (problem.errorMessage) {
        output += `\n║ ${chalk.red("Error:")} ${problem.errorMessage.substring(0, 51).padEnd(51)} ║`;
      }
    }

    if (hypothesis) {
      output += `\n║ ${chalk.bold("Hypothesis:")} ${hypothesis.cause.substring(0, 45).padEnd(45)} ║`;
      output += `\n║ ${chalk.bold("Affected:")} ${hypothesis.affectedCode.join(", ").substring(0, 47).padEnd(47)} ║`;
    }

    if (experiment && experiment.changes.length > 0) {
      output += `\n╟${border}╢`;
      experiment.changes.forEach((change, idx) => {
        output += `
║ ${chalk.cyan(`Change ${idx + 1}:`)} ${change.file} (lines ${change.lineRange[0]}-${change.lineRange[1]}) ║
║ ${chalk.dim("Reason:")} ${change.reasoning.substring(0, 49).padEnd(49)} ║`;
      });
    }

    if (result) {
      output += `
╟${border}╢
║ ${chalk.bold("Result:")} ${result.success ? chalk.green("Success") : chalk.red("Failed")} ║
║ ${chalk.bold("Learning:")} ${result.learning.substring(0, 47).padEnd(47)} ║`;
    }

    output += `
╚${border}╝`;

    return output;
  }

  private learnFromResult(step: CodeThinkingStep, sessionProblem?: Problem): void {
    if (!step.result) return;

    const problem = step.problem || sessionProblem;
    
    // Learn from errors
    if (problem?.errorMessage && !step.result.success && step.hypothesis && step.experiment) {
      const existingPattern = this.errorPatterns.find(
        (p) => p.pattern === problem.errorMessage,
      );

      if (existingPattern) {
        existingPattern.occurrences++;
      } else {
        this.errorPatterns.push({
          pattern: problem.errorMessage,
          commonCause: step.hypothesis.cause,
          suggestedFix: step.experiment?.changes[0]?.reasoning || "",
          occurrences: 1,
        });
      }
    }

    // Record successful fixes
    if (step.result.success && step.experiment) {
      this.successfulFixes.push({
        problemId: step.id,
        solution: step.result.learning,
        changes: step.experiment.changes,
        verified: true,
      });
    }

    // Auto-save knowledge after learning
    this.saveKnowledge().catch(console.error);
  }

  public startSession(sessionId?: string, problem?: Problem): string {
    const id = sessionId || this.generateId();
    const session: DebugSession = {
      id,
      startTime: new Date(),
      problem,
      steps: []
    };
    this.debugSessions.set(id, session);
    this.currentSessionId = id;

    if (!this.disableLogging) {
      console.error(chalk.bold.blue(`\n🚀 Started debug session: ${id}\n`));
      if (problem) {
        console.error(chalk.yellow(`📋 Problem: ${problem.description}`));
      }
    }

    return id;
  }

  public recordStep(input: unknown): {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  } {
    try {
      const data = input as Record<string, unknown>;

      // Ensure session exists
      if (!this.currentSessionId) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: "No active session",
              solution: "Please start a session first with action: 'start_session'",
            }, null, 2),
          }],
          isError: true,
        };
      }

      // Create step with provided data - all fields are optional for flexibility
      const step: Partial<CodeThinkingStep> = {
        id: this.generateId(),
        timestamp: new Date(),
      };

      // Add provided fields
      if (data.problem) step.problem = data.problem as Problem;
      if (data.hypothesis) step.hypothesis = data.hypothesis as Hypothesis;
      if (data.experiment) step.experiment = data.experiment as Experiment;
      if (data.result) step.result = data.result as Result;
      if (data.nextAction) step.nextAction = data.nextAction as "fixed" | "iterate" | "pivot" | "research";

      // At least one field should be provided
      if (!step.problem && !step.hypothesis && !step.experiment && !step.result) {
        throw new Error("At least one of: problem, hypothesis, experiment, or result must be provided");
      }

      // Type assertion after validation
      const validStep = step as CodeThinkingStep;

      const session = this.debugSessions.get(this.currentSessionId!);
      if (!session) {
        throw new Error("Session not found");
      }
      
      session.steps.push(validStep);

      if (validStep.result) {
        this.learnFromResult(validStep, session.problem);
      }

      if (!this.disableLogging && (validStep.hypothesis || validStep.experiment)) {
        console.error(this.formatDebugStep(validStep, session.problem));
      }

      // Check for known patterns using session problem or step problem
      let patternMatch = null;
      const problemToCheck = validStep.problem || session.problem;
      if (problemToCheck?.errorMessage) {
        patternMatch = this.errorPatterns.find((p) =>
          problemToCheck.errorMessage?.includes(p.pattern),
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                stepId: step.id,
                sessionId: this.currentSessionId,
                recorded: true,
                nextAction: step.nextAction,
                patternMatch: patternMatch
                  ? {
                      pattern: patternMatch.pattern,
                      suggestedCause: patternMatch.commonCause,
                      previousOccurrences: patternMatch.occurrences,
                    }
                  : null,
                sessionSteps: session?.steps.length || 0,
                knownPatterns: this.errorPatterns.length,
                successfulFixes: this.successfulFixes.length,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red("Error in recordStep:"), errorMessage);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: errorMessage,
                status: "failed",
                details: "Please ensure all required fields (problem, hypothesis, experiment) are provided",
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
  }

  public async endSession(
    sessionId?: string,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const id = sessionId || this.currentSessionId;
    if (!id) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "No session to end" }, null, 2),
          },
        ],
      };
    }

    try {
      // Save session before removing
      await this.saveSession(id);

      // Save all knowledge
      await this.saveKnowledge();

      const session = this.debugSessions.get(id);
      const summary = {
        sessionId: id,
        ended: new Date().toISOString(),
        totalSteps: session?.steps.length || 0,
        saved: true,
        dataLocation: this.dataDir,
      };

      // Remove from active sessions
      this.debugSessions.delete(id);
      if (this.currentSessionId === id) {
        this.currentSessionId = null;
      }

      if (!this.disableLogging) {
        console.error(chalk.bold.red(`\n🏁 Ended debug session: ${id}\n`));
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: error instanceof Error ? error.message : String(error),
                status: "failed",
              },
              null,
              2,
            ),
          },
        ],
      };
    }
  }

  public async listSessions(): Promise<{
    content: Array<{ type: string; text: string }>;
  }> {
    try {
      const sessionsDir = path.join(this.dataDir, "sessions");
      const files = await fs.readdir(sessionsDir);
      const sessions = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const data = await fs.readFile(
              path.join(sessionsDir, file),
              "utf-8",
            );
            const session = JSON.parse(data);
            sessions.push({
              id: session.id,
              startTime: session.startTime,
              endTime: session.endTime,
              totalSteps: session.summary.totalSteps,
              status: session.summary.finalStatus,
            });
          } catch {
            // Skip invalid files
          }
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                activeSessions: Array.from(this.debugSessions.keys()),
                savedSessions: sessions,
                totalSessions: sessions.length,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: error instanceof Error ? error.message : String(error),
                sessions: [],
              },
              null,
              2,
            ),
          },
        ],
      };
    }
  }

  public getSessionSummary(sessionId?: string): {
    content: Array<{ type: string; text: string }>;
  } {
    const id = sessionId || this.currentSessionId;
    if (!id) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "No active session" }, null, 2),
          },
        ],
      };
    }

    const session = this.debugSessions.get(id);
    if (!session) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "Session not found" }, null, 2),
          },
        ],
      };
    }

    const summary = {
      sessionId: id,
      sessionProblem: session.problem,
      totalSteps: session.steps.length,
      successfulFixes: session.steps.filter((s) => s.result?.success).length,
      iterations: session.steps.filter((s) => s.nextAction === "iterate").length,
      pivots: session.steps.filter((s) => s.nextAction === "pivot").length,
      averageConfidence:
        session.steps.length > 0
          ? session.steps.reduce((acc, s) => acc + (s.hypothesis?.confidence || 0), 0) /
            session.steps.length
          : 0,
      problemsSolved: session.steps
        .filter((s) => s.nextAction === "fixed")
        .map((s) => ({
          hypothesis: s.hypothesis?.cause,
          solution: s.result?.learning,
        })),
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  public getActiveSessionIds(): string[] {
    return Array.from(this.debugSessions.keys());
  }

  public async saveAllKnowledge(): Promise<void> {
    return this.saveKnowledge();
  }
}

const CODE_DEBUG_TOOL: Tool = {
  name: "code_debug_think",
  description: `A systematic debugging and code iteration framework for Claude Code.
This tool helps track and learn from debugging sessions, building knowledge over time.

Key features:
- Structured problem analysis with hypothesis testing
- Code change tracking with reasoning
- Pattern recognition from previous errors
- Learning accumulation across sessions
- Confidence scoring for hypotheses
- Persistent storage in ~/.debug-iteration-mcp directory

Use this tool when:
- Debugging errors in code
- Iterating on implementations
- Tracking complex problem-solving processes
- Building a knowledge base of fixes

Actions:
1. start_session - Start a new debugging session (optionally with a problem)
2. record_step - Record a debugging step (requires hypothesis and experiment)
3. get_summary - Get summary of current or specific session
4. end_session - End and save a session
5. list_sessions - List all sessions

Data is stored in ~/.debug-iteration-mcp/ (or custom location via DEBUG_DATA_DIR env var).`,
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "record_step",
          "start_session",
          "get_summary",
          "end_session",
          "list_sessions",
        ],
        description: "Action to perform",
      },
      sessionId: {
        type: "string",
        description: "Session ID (optional for start_session and get_summary)",
      },
      problem: {
        type: "object",
        description: "Problem definition (optional for start_session only)",
        properties: {
          description: { type: "string" },
          errorMessage: { type: "string" },
          expectedBehavior: { type: "string" },
          actualBehavior: { type: "string" },
        },
        required: ["description", "expectedBehavior", "actualBehavior"],
      },
      hypothesis: {
        type: "object",
        description: "Hypothesis about the cause (required for record_step)",
        properties: {
          cause: { type: "string" },
          affectedCode: {
            type: "array",
            items: { type: "string" },
          },
          confidence: {
            type: "integer",
            minimum: 0,
            maximum: 100,
          },
        },
        required: ["cause", "affectedCode", "confidence"],
      },
      experiment: {
        type: "object",
        description: "Experiment to test the hypothesis (required for record_step)",
        properties: {
          changes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                file: { type: "string" },
                lineRange: {
                  type: "array",
                  items: { type: "integer" },
                  minItems: 2,
                  maxItems: 2,
                },
                oldCode: { type: "string" },
                newCode: { type: "string" },
                reasoning: { type: "string" },
              },
              required: [
                "file",
                "lineRange",
                "oldCode",
                "newCode",
                "reasoning",
              ],
            },
          },
          testCommand: { type: "string" },
          expectedOutcome: { type: "string" },
        },
        required: ["changes", "expectedOutcome"],
      },
      result: {
        type: "object",
        description: "Result of the experiment (optional for record_step)",
        properties: {
          success: { type: "boolean" },
          output: { type: "string" },
          newErrors: {
            type: "array",
            items: { type: "string" },
          },
          learning: { type: "string" },
        },
        required: ["success", "learning"],
      },
      nextAction: {
        type: "string",
        description: "Next action to take (optional for record_step)",
        enum: ["fixed", "iterate", "pivot", "research"],
      },
    },
    required: ["action"],
  },
};

const server = new Server(
  {
    name: "code-debug-iteration-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const debugServer = new CodeDebugServer();

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [CODE_DEBUG_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "code_debug_think") {
    const args = request.params.arguments as Record<string, unknown>;
    const action = args.action as string;

    switch (action) {
      case "start_session":
        const sessionId = debugServer.startSession(
          args.sessionId as string | undefined,
          args.problem as Problem | undefined,
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ 
                sessionId, 
                status: "started",
                problemSet: args.problem ? true : false
              }, null, 2),
            },
          ],
        };

      case "record_step":
        return debugServer.recordStep(args);

      case "get_summary":
        return debugServer.getSessionSummary(
          args.sessionId as string | undefined,
        );

      case "end_session":
        return await debugServer.endSession(
          args.sessionId as string | undefined,
        );

      case "list_sessions":
        return await debugServer.listSessions();

      default:
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Unknown action: ${action}`,
                validActions: ["start_session", "record_step", "get_summary", "end_session", "list_sessions"],
              }, null, 2),
            },
          ],
          isError: true,
        };
    }
  }

  return {
    content: [
      {
        type: "text",
        text: `Unknown tool: ${request.params.name}`,
      },
    ],
    isError: true,
  };
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Code Debug & Iteration MCP Server running on stdio");

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.error("\n📁 Saving all data before shutdown...");

    // End all active sessions
    for (const sessionId of debugServer.getActiveSessionIds()) {
      await debugServer.endSession(sessionId);
    }

    console.error("✅ All data saved successfully");
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await debugServer.saveAllKnowledge();
    process.exit(0);
  });
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
