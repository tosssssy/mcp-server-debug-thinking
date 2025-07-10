import { v4 as uuidv4 } from "uuid";
import type { Node, Edge } from "../types/graph.js";

// Test data factories for cleaner test code

export const createTestProblem = (overrides: Partial<Node> = {}): Node => ({
  id: uuidv4(),
  type: "problem",
  content: "Test problem content",
  metadata: {
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [],
    status: "open",
    ...overrides.metadata,
  },
  ...overrides,
});

export const createTestHypothesis = (overrides: Partial<Node> = {}): Node => ({
  id: uuidv4(),
  type: "hypothesis",
  content: "Test hypothesis content",
  metadata: {
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [],
    confidence: 70,
    testable: true,
    ...overrides.metadata,
  },
  ...overrides,
});

export const createTestSolution = (overrides: Partial<Node> = {}): Node => ({
  id: uuidv4(),
  type: "solution",
  content: "Test solution content",
  metadata: {
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [],
    verified: false,
    effectiveness: 80,
    ...overrides.metadata,
  },
  ...overrides,
});

export const createTestEdge = (
  from: string,
  to: string,
  type: Edge["type"],
  overrides: Partial<Edge> = {}
): Edge => ({
  id: uuidv4(),
  type,
  from,
  to,
  strength: 1,
  metadata: {
    createdAt: new Date(),
    ...overrides.metadata,
  },
  ...overrides,
});

// Common test scenarios
export const createProblemWithSolution = () => {
  const problem = createTestProblem({ content: "Memory leak in event listeners" });
  const solution = createTestSolution({
    content: "Remove event listeners in cleanup",
    metadata: {
      verified: true,
      effectiveness: 90,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
    },
  });
  const edge = createTestEdge(solution.id, problem.id, "solves");

  return { problem, solution, edge };
};

export const createDebugSession = () => {
  const problem = createTestProblem({ content: "Application crashes on startup" });
  const hypothesis1 = createTestHypothesis({
    content: "Memory overflow issue",
    metadata: {
      confidence: 80,
      testable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
    },
  });
  const hypothesis2 = createTestHypothesis({
    content: "Configuration error",
    metadata: {
      confidence: 60,
      testable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
    },
  });

  return { problem, hypothesis1, hypothesis2 };
};
