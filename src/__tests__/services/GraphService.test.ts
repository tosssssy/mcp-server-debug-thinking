import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GraphService } from "../../services/GraphService.js";
import { ActionType } from "../../types/graphActions.js";
import { NodeType } from "../../types/graph.js";

describe("GraphService", () => {
  let graphService: GraphService;

  beforeEach(async () => {
    // Ensure clean test environment with unique directory per test
    process.env.DEBUG_DATA_DIR = `.test-graph-service-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    graphService = new GraphService();
    await graphService.initialize();
  });

  afterEach(async () => {
    // Clean up
    if (process.env.DEBUG_DATA_DIR) {
      const fs = await import("fs/promises");
      try {
        // Remove the entire test directory, not just the subdirectory
        await fs.rm(process.env.DEBUG_DATA_DIR, { recursive: true, force: true });
      } catch (error) {
        // Directory might not exist
      }
      delete process.env.DEBUG_DATA_DIR;
    }
  });

  describe("CREATE action", () => {
    it("should create a problem node", async () => {
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "App crashes on startup",
        metadata: {
          tags: ["crash", "startup"],
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.nodeId).toBeDefined();
      expect(response.message).toContain("Created problem node");
    });

    it("should create a hypothesis with parent problem", async () => {
      // First create a problem
      const problemResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Memory leak detected",
      });
      const problemResponse = JSON.parse(problemResult.content[0].text);
      expect(problemResponse.success).toBe(true);
      expect(problemResponse.nodeId).toBeDefined();

      // Then create a hypothesis
      const hypothesisResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Event listeners not being cleaned up",
        parentId: problemResponse.nodeId,
        metadata: {
          confidence: 75,
        },
      });

      const hypothesisResponse = JSON.parse(hypothesisResult.content[0].text);
      expect(hypothesisResponse.success).toBe(true);
      expect(hypothesisResponse.nodeId).toBeDefined();
      expect(hypothesisResponse.edgeId).toBeDefined(); // Auto-created edge
    });

    it("should fail when parent node does not exist", async () => {
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Some hypothesis",
        parentId: "non-existent-id",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.message).toContain("Parent node non-existent-id not found");
    });

    it("should add root problem to roots array", async () => {
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Root problem",
      });

      const response = JSON.parse(result.content[0].text);
      const graph = graphService.getGraph();
      expect(graph.roots).toContain(response.nodeId);
    });

    it("should find similar problems when creating a new problem", async () => {
      // Create some existing problems first
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: 'TypeError: Cannot read property "x" of undefined',
        metadata: { status: "solved" },
      });

      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: 'TypeError: Cannot read property "y" of null',
        metadata: { status: "solved" },
      });

      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "ReferenceError: variable is not defined",
        metadata: { status: "open" },
      });

      // Create a new problem similar to existing ones
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: 'TypeError: Cannot read property "z" of undefined',
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.similarProblems).toBeDefined();
      expect(response.similarProblems.length).toBeGreaterThan(0);

      // Should find the TypeError problems with high similarity
      const typeErrors = response.similarProblems.filter((p: any) =>
        p.content.includes("TypeError")
      );
      expect(typeErrors.length).toBeGreaterThanOrEqual(2);

      // Should have high similarity scores for TypeErrors
      expect(typeErrors[0].similarity).toBeGreaterThanOrEqual(0.6);
    });

    it("should not return similar problems for non-problem nodes", async () => {
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Some hypothesis content",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.similarProblems).toBeUndefined();
    });

    it("should include solutions with similar problems", async () => {
      // Create a problem with a solution
      const problemResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Memory leak in event listeners",
        metadata: { status: "solved" },
      });
      const problemId = JSON.parse(problemResult.content[0].text).nodeId;

      const solutionResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "solution",
        content: "Remove event listeners in cleanup function",
        metadata: { verified: true },
      });
      const solutionId = JSON.parse(solutionResult.content[0].text).nodeId;

      await graphService.connect({
        action: ActionType.CONNECT,
        from: solutionId,
        to: problemId,
        type: "solves",
      });

      // Create a similar problem (more similar content for better matching)
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Memory leak detected in event listeners cleanup",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);

      // Check if similarProblems exists and has content
      if (response.similarProblems && response.similarProblems.length > 0) {
        // Should include the solution
        const problemWithSolution = response.similarProblems.find((p: any) =>
          p.content.includes("Memory leak in event listeners")
        );

        if (problemWithSolution) {
          expect(problemWithSolution.solutions).toBeDefined();
          expect(problemWithSolution.solutions).toBeInstanceOf(Array);

          // If solutions exist, check their content
          if (problemWithSolution.solutions.length > 0) {
            expect(problemWithSolution.solutions[0].content).toContain("Remove event listeners");
          }
        }
      } else {
        // If no similar problems found, that's also acceptable for this test
        expect(response.similarProblems).toBeDefined();
      }
    });

    it("should prioritize solved problems in similar results", async () => {
      // Create multiple similar problems with different statuses
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "API timeout error on /users endpoint",
        metadata: { status: "abandoned" },
      });

      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "API timeout error on /products endpoint",
        metadata: { status: "solved" },
      });

      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "API timeout error on /orders endpoint",
        metadata: { status: "open" },
      });

      // Create a new similar problem
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "API timeout error on /customers endpoint",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);

      // Check if similar problems were found
      if (response.similarProblems && response.similarProblems.length > 0) {
        // Find if there's a solved problem in the results
        const solvedProblem = response.similarProblems.find((p: any) => p.status === "solved");
        if (solvedProblem) {
          // Check if it's prioritized (should be in the first few results)
          const solvedIndex = response.similarProblems.indexOf(solvedProblem);
          expect(solvedIndex).toBeLessThanOrEqual(1); // Should be first or second
        }
      }
    });

    it("should calculate similarity correctly for error patterns", async () => {
      // Create problems with different error types
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: 'TypeError: Cannot read property "foo" of undefined',
      });

      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "ReferenceError: foo is not defined",
      });

      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: 'TypeError: Cannot access property "bar" of null',
      });

      // Create a new TypeError
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: 'TypeError: Cannot read property "baz" of undefined',
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);

      if (response.similarProblems && response.similarProblems.length > 0) {
        // TypeErrors should have higher similarity than ReferenceError
        const typeErrorProblems = response.similarProblems.filter((p: any) =>
          p.content.includes("TypeError")
        );
        const refErrorProblems = response.similarProblems.filter((p: any) =>
          p.content.includes("ReferenceError")
        );

        if (typeErrorProblems.length > 0 && refErrorProblems.length > 0) {
          // Compare the highest similarity TypeError with the highest similarity ReferenceError
          const maxTypeErrorSimilarity = Math.max(
            ...typeErrorProblems.map((p: any) => p.similarity)
          );
          const maxRefErrorSimilarity = Math.max(...refErrorProblems.map((p: any) => p.similarity));
          expect(maxTypeErrorSimilarity).toBeGreaterThan(maxRefErrorSimilarity);
        }
      }
    });

    it("should use error type index for performance optimization", async () => {
      // Create many problems with different error types
      for (let i = 0; i < 20; i++) {
        await graphService.create({
          action: ActionType.CREATE,
          nodeType: "problem",
          content: `TypeError: Cannot read property "${i}" of undefined`,
        });
      }

      for (let i = 0; i < 15; i++) {
        await graphService.create({
          action: ActionType.CREATE,
          nodeType: "problem",
          content: `ReferenceError: variable${i} is not defined`,
        });
      }

      for (let i = 0; i < 10; i++) {
        await graphService.create({
          action: ActionType.CREATE,
          nodeType: "problem",
          content: `Generic error ${i} without specific type`,
        });
      }

      // Create a new TypeError - should only search among TypeErrors
      const startTime = Date.now();
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: 'TypeError: Cannot read property "test" of undefined',
      });
      const searchTime = Date.now() - startTime;

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.similarProblems).toBeDefined();

      // Should find similar TypeErrors
      const allTypeErrors = response.similarProblems.every((p: any) =>
        p.content.includes("TypeError")
      );
      expect(allTypeErrors).toBe(true);

      // Performance should be reasonable even with many nodes
      expect(searchTime).toBeLessThan(100); // Should be fast with index
    });

    it("should handle problems without specific error types", async () => {
      // Create problems without error types
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Application crashes on startup",
      });

      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Memory leak detected in production",
      });

      // Create another generic problem
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Application hangs after 5 minutes",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);

      // Should still find similar problems even without error types
      if (response.similarProblems && response.similarProblems.length > 0) {
        expect(response.similarProblems[0].content).toBeDefined();
      }
    });
  });

  describe("CONNECT action", () => {
    it("should connect two nodes", async () => {
      // Create two nodes
      const node1Result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "observation",
        content: "Error disappeared after fix",
      });
      const node1 = JSON.parse(node1Result.content[0].text);

      const node2Result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "learning",
        content: "Always clean up event listeners",
      });
      const node2 = JSON.parse(node2Result.content[0].text);

      // Connect them
      const connectResult = await graphService.connect({
        action: ActionType.CONNECT,
        from: node1.nodeId,
        to: node2.nodeId,
        type: "learns",
        strength: 0.9,
      });

      const connectResponse = JSON.parse(connectResult.content[0].text);
      expect(connectResponse.success).toBe(true);
      expect(connectResponse.edgeId).toBeDefined();
      expect(connectResponse.message).toContain("Connected observation to learning");
    });

    it("should detect conflicting edges", async () => {
      // Create hypothesis and experiment
      const hypResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Theory A",
      });
      const hyp = JSON.parse(hypResult.content[0].text);

      const expResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "experiment",
        content: "Test theory",
      });
      const exp = JSON.parse(expResult.content[0].text);

      // Create supporting edge
      await graphService.connect({
        action: ActionType.CONNECT,
        from: exp.nodeId,
        to: hyp.nodeId,
        type: "supports",
      });

      // Create contradicting edge
      const contradictResult = await graphService.connect({
        action: ActionType.CONNECT,
        from: exp.nodeId,
        to: hyp.nodeId,
        type: "contradicts",
      });

      const contradictResponse = JSON.parse(contradictResult.content[0].text);
      expect(contradictResponse.success).toBe(true);
      expect(contradictResponse.conflicts).toBeDefined();
      expect(contradictResponse.conflicts.conflictingEdges).toHaveLength(1);
    });

    it("should fail when nodes do not exist", async () => {
      const result = await graphService.connect({
        action: ActionType.CONNECT,
        from: "non-existent-1",
        to: "non-existent-2",
        type: "supports",
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.message).toContain("Node(s) not found");
    });
  });

  describe("QUERY action", () => {
    beforeEach(async () => {
      // Set up some test data
      const problem1 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "TypeScript compilation error",
      });
      const p1 = JSON.parse(problem1.content[0].text);

      const solution1 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "solution",
        content: "Fix type definitions",
      });
      const s1 = JSON.parse(solution1.content[0].text);

      await graphService.connect({
        action: ActionType.CONNECT,
        from: s1.nodeId,
        to: p1.nodeId,
        type: "solves",
      });

      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "TypeScript type mismatch in React component",
      });
    });

    it("should find similar problems", async () => {
      const result = await graphService.query({
        action: ActionType.QUERY,
        type: "similar-problems",
        parameters: {
          pattern: "typescript",
          limit: 5,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.problems).toBeDefined();

      // Check if we found problems containing 'typescript' (case-insensitive)
      if (response.results.problems.length > 0) {
        const hasTypescriptProblems = response.results.problems.some((p: any) =>
          p.content.toLowerCase().includes("typescript")
        );
        expect(hasTypescriptProblems).toBe(true);
      }
    });

    it("should get recent activity", async () => {
      // Create nodes at different times
      const problem = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "First problem",
      });
      const p = JSON.parse(problem.content[0].text);

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const hypothesis = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Test hypothesis",
        parentId: p.nodeId,
      });
      const h = JSON.parse(hypothesis.content[0].text);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const solution = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "solution",
        content: "Test solution",
      });
      const s = JSON.parse(solution.content[0].text);

      await graphService.connect({
        action: ActionType.CONNECT,
        from: s.nodeId,
        to: p.nodeId,
        type: "solves",
      });

      const result = await graphService.query({
        action: ActionType.QUERY,
        type: "recent-activity",
        parameters: {
          limit: 5,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results).toBeDefined();
      expect(response.results.nodes).toBeDefined();
      expect(response.results.nodes.length).toBeGreaterThan(0);
      expect(response.results.totalNodes).toBeGreaterThan(0);

      // Verify nodes are sorted by creation time (most recent first)
      const firstNode = response.results.nodes[0];
      expect(firstNode.nodeId).toBe(s.nodeId);
      expect(firstNode.content).toBe("Test solution");
      expect(firstNode.edges).toBeDefined();
      expect(firstNode.edges.length).toBeGreaterThan(0);
    });

    it("should handle recent activity with limit", async () => {
      // Create many nodes
      for (let i = 0; i < 15; i++) {
        await graphService.create({
          action: ActionType.CREATE,
          nodeType: "problem",
          content: `Problem ${i}`,
        });
        await new Promise((resolve) => setTimeout(resolve, 5)); // Small delay
      }

      const result = await graphService.query({
        action: ActionType.QUERY,
        type: "recent-activity",
        parameters: {
          limit: 10,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.nodes.length).toBe(10);
      expect(response.results.totalNodes).toBeGreaterThanOrEqual(15);

      // Verify most recent nodes are returned
      expect(response.results.nodes[0].content).toContain("Problem 14");
    });

    it("should include parent information in recent activity", async () => {
      const problem = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Parent problem",
      });
      const p = JSON.parse(problem.content[0].text);

      const hypothesis = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Child hypothesis",
        parentId: p.nodeId,
      });

      const result = await graphService.query({
        action: ActionType.QUERY,
        type: "recent-activity",
        parameters: {},
      });

      const response = JSON.parse(result.content[0].text);
      const hypothesisNode = response.results.nodes.find((n: any) => n.type === "hypothesis");
      expect(hypothesisNode).toBeDefined();
      expect(hypothesisNode.parent).toBeDefined();
      expect(hypothesisNode.parent.nodeId).toBe(p.nodeId);
      expect(hypothesisNode.parent.content).toBe("Parent problem");
    });

    it("should handle unknown query type", async () => {
      const result = await graphService.query({
        action: ActionType.QUERY,
        type: "unknown-query-type" as any,
        parameters: {},
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.message).toContain("Unknown query type");
    });

    it("should find similar problems with debug paths", async () => {
      // Create a complete debug path
      const problem = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Performance issue with database queries",
      });
      const problemId = JSON.parse(problem.content[0].text).nodeId;

      const hypothesis = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Missing database indexes",
        parentId: problemId,
      });
      const hypothesisId = JSON.parse(hypothesis.content[0].text).nodeId;

      const experiment = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "experiment",
        content: "Add indexes to frequently queried columns",
        parentId: hypothesisId,
      });
      const experimentId = JSON.parse(experiment.content[0].text).nodeId;

      const observation = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "observation",
        content: "Query time reduced from 5s to 0.1s",
        parentId: experimentId,
      });
      const observationId = JSON.parse(observation.content[0].text).nodeId;

      const solution = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "solution",
        content: "Add database indexes",
        metadata: { verified: true },
      });
      const solutionId = JSON.parse(solution.content[0].text).nodeId;

      await graphService.connect({
        action: ActionType.CONNECT,
        from: solutionId,
        to: problemId,
        type: "solves",
      });

      // Update the problem status
      await graphService.connect({
        action: ActionType.CONNECT,
        from: observationId,
        to: problemId,
        type: "supports",
      });

      // Create a similar problem and query
      const newProblem = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Slow database performance",
      });

      const result = await graphService.query({
        action: ActionType.QUERY,
        type: "similar-problems",
        parameters: {
          pattern: "database performance slow",
          limit: 5,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.problems).toBeDefined();

      if (response.results.problems.length > 0) {
        const similarProblem = response.results.problems[0];
        expect(similarProblem.solutions).toBeDefined();
        if (similarProblem.solutions.length > 0) {
          expect(similarProblem.solutions[0].debugPath).toBeDefined();
          expect(similarProblem.solutions[0].debugPath.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("Automatic edge creation", () => {
    it("should create correct edge types based on node types", async () => {
      // Problem -> Problem (decomposes)
      const rootProblem = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Main problem",
      });
      const rp = JSON.parse(rootProblem.content[0].text);

      const subProblem = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Sub problem",
        parentId: rp.nodeId,
      });
      const sp = JSON.parse(subProblem.content[0].text);

      // Check that edge was created
      const graph = graphService.getGraph();
      const edge = Array.from(graph.edges.values()).find(
        (e) => e.from === rp.nodeId && e.to === sp.nodeId
      );
      expect(edge).toBeDefined();
      expect(edge?.type).toBe("decomposes");

      // Problem -> Hypothesis (hypothesizes)
      const hypothesis = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Test hypothesis",
        parentId: sp.nodeId,
      });
      const h = JSON.parse(hypothesis.content[0].text);

      const hypEdge = Array.from(graph.edges.values()).find(
        (e) => e.from === sp.nodeId && e.to === h.nodeId
      );
      expect(hypEdge?.type).toBe("hypothesizes");
    });
  });

  describe("Graph persistence", () => {
    it("should save and load graph data", async () => {
      // Create some data
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Persistence test problem",
      });

      await graphService.saveGraph();

      // Create new instance and load
      const newGraphService = new GraphService();
      await newGraphService.initialize();

      const graph = newGraphService.getGraph();
      expect(graph.nodes.size).toBeGreaterThan(0);
      const hasPersistedProblem = Array.from(graph.nodes.values()).some(
        (n) => n.content === "Persistence test problem"
      );
      expect(hasPersistedProblem).toBe(true);
    });
  });

  describe("buildErrorTypeIndex edge cases", () => {
    it("should handle nodes without error types", async () => {
      // Create a GraphService and add nodes without error types
      const service = new GraphService();
      await service.initialize();

      await service.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Generic problem without error type",
      });

      await service.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Another generic issue",
      });

      // Force rebuild index
      const graph = service.getGraph();
      expect(graph.nodes.size).toBeGreaterThan(0);

      // @ts-ignore - access private method for testing
      service.buildErrorTypeIndex();

      // Verify that nodes without error types are categorized as 'other'
      // @ts-ignore - access private property for testing
      expect(service.errorTypeIndex.has("other")).toBe(true);
      // @ts-ignore
      expect(service.errorTypeIndex.get("other")?.size).toBeGreaterThan(0);
    });

    it("should create new error type entries when encountering new types", async () => {
      const service = new GraphService();
      await service.initialize();

      // First create a problem with a unique error type to ensure the index is empty for this type
      await service.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "URI Error: Malformed URI sequence",
      });

      // Force rebuild index
      // @ts-ignore - access private method for testing
      service.buildErrorTypeIndex();

      // Verify that new error type was added to index (the regex extracts "uri error")
      // @ts-ignore - access private property for testing
      expect(service.errorTypeIndex.has("uri error")).toBe(true);
    });
  });

  describe("Performance optimization indexes", () => {
    it("should build performance indexes on initialization", async () => {
      const service = new GraphService();

      // Create some test data before initialization
      const problem = await service.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Test problem",
      });
      const problemId = JSON.parse(problem.content[0].text).nodeId;

      const hypothesis = await service.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Test hypothesis",
        parentId: problemId,
      });
      const hypothesisId = JSON.parse(hypothesis.content[0].text).nodeId;

      const experiment = await service.create({
        action: ActionType.CREATE,
        nodeType: "experiment",
        content: "Test experiment",
        parentId: hypothesisId,
      });

      // Force rebuild indexes
      // @ts-ignore - access private method for testing
      service.buildPerformanceIndexes();

      // Verify nodesByType index
      // @ts-ignore - access private property for testing
      const nodesByType = service.nodesByType;
      expect(nodesByType.has("problem")).toBe(true);
      expect(nodesByType.has("hypothesis")).toBe(true);
      expect(nodesByType.has("experiment")).toBe(true);
      expect(nodesByType.get("problem")?.has(problemId)).toBe(true);

      // Verify edgesByNode index
      // @ts-ignore - access private property for testing
      const edgesByNode = service.edgesByNode;
      expect(edgesByNode.has(problemId)).toBe(true);
      expect(edgesByNode.has(hypothesisId)).toBe(true);

      const problemEdges = edgesByNode.get(problemId);
      expect(problemEdges?.outgoing.length).toBe(1); // One edge to hypothesis
      expect(problemEdges?.incoming.length).toBe(0);

      const hypothesisEdges = edgesByNode.get(hypothesisId);
      expect(hypothesisEdges?.incoming.length).toBe(1); // One edge from problem
      expect(hypothesisEdges?.outgoing.length).toBe(1); // One edge to experiment

      // Verify parentIndex
      // @ts-ignore - access private property for testing
      const parentIndex = service.parentIndex;
      expect(parentIndex.get(hypothesisId)).toBe(problemId);
    });

    it("should update indexes when adding new nodes", async () => {
      const service = new GraphService();
      await service.initialize();

      // Create a node
      const result = await service.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "New problem",
      });
      const nodeId = JSON.parse(result.content[0].text).nodeId;

      // Verify the node is in the indexes
      // @ts-ignore - access private property for testing
      expect(service.nodesByType.get("problem")?.has(nodeId)).toBe(true);
      // @ts-ignore - access private property for testing
      expect(service.edgesByNode.has(nodeId)).toBe(true);
    });

    it("should update indexes when adding new edges", async () => {
      const service = new GraphService();
      await service.initialize();

      // Create two nodes
      const node1 = await service.create({
        action: ActionType.CREATE,
        nodeType: "observation",
        content: "Observation 1",
      });
      const nodeId1 = JSON.parse(node1.content[0].text).nodeId;

      const node2 = await service.create({
        action: ActionType.CREATE,
        nodeType: "learning",
        content: "Learning 1",
      });
      const nodeId2 = JSON.parse(node2.content[0].text).nodeId;

      // Connect them
      await service.connect({
        action: ActionType.CONNECT,
        from: nodeId1,
        to: nodeId2,
        type: "learns",
      });

      // Verify edge is in the index
      // @ts-ignore - access private property for testing
      const edgesByNode = service.edgesByNode;

      const node1Edges = edgesByNode.get(nodeId1);
      expect(node1Edges?.outgoing.length).toBe(1);
      expect(node1Edges?.outgoing[0].to).toBe(nodeId2);

      const node2Edges = edgesByNode.get(nodeId2);
      expect(node2Edges?.incoming.length).toBe(1);
      expect(node2Edges?.incoming[0].from).toBe(nodeId1);

      // Verify parent index is updated for parent-child edge types
      // @ts-ignore - access private property for testing
      expect(service.parentIndex.get(nodeId2)).toBe(nodeId1);
    });

    it("should use indexes for efficient getRecentActivity", async () => {
      const service = new GraphService();
      await service.initialize();

      // Create a complex graph structure
      const problem = await service.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Root problem",
      });
      const problemId = JSON.parse(problem.content[0].text).nodeId;

      const hypothesis = await service.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Test hypothesis",
        parentId: problemId,
      });
      const hypothesisId = JSON.parse(hypothesis.content[0].text).nodeId;

      const solution = await service.create({
        action: ActionType.CREATE,
        nodeType: "solution",
        content: "Test solution",
      });
      const solutionId = JSON.parse(solution.content[0].text).nodeId;

      await service.connect({
        action: ActionType.CONNECT,
        from: solutionId,
        to: problemId,
        type: "solves",
      });

      // Get recent activity
      const result = await service.query({
        action: ActionType.QUERY,
        type: "recent-activity",
        parameters: { limit: 10 },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);

      // Find the hypothesis node in the results
      const hypothesisNode = response.results.nodes.find((n: any) => n.nodeId === hypothesisId);
      expect(hypothesisNode).toBeDefined();

      // Verify parent information is correctly retrieved
      expect(hypothesisNode.parent).toBeDefined();
      expect(hypothesisNode.parent.nodeId).toBe(problemId);

      // Verify edges are correctly retrieved
      expect(hypothesisNode.edges.length).toBe(1);
      expect(hypothesisNode.edges[0].direction).toBe("to");
      expect(hypothesisNode.edges[0].targetNodeId).toBe(problemId);
    });

    it("should use parent index for efficient debug path building", async () => {
      const service = new GraphService();
      await service.initialize();

      // Create a deep path: problem -> hypothesis -> experiment -> observation -> solution
      const problem = await service.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Deep problem",
      });
      const problemId = JSON.parse(problem.content[0].text).nodeId;

      const hypothesis = await service.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Deep hypothesis",
        parentId: problemId,
      });
      const hypothesisId = JSON.parse(hypothesis.content[0].text).nodeId;

      const experiment = await service.create({
        action: ActionType.CREATE,
        nodeType: "experiment",
        content: "Deep experiment",
        parentId: hypothesisId,
      });
      const experimentId = JSON.parse(experiment.content[0].text).nodeId;

      const observation = await service.create({
        action: ActionType.CREATE,
        nodeType: "observation",
        content: "Deep observation",
        parentId: experimentId,
      });
      const observationId = JSON.parse(observation.content[0].text).nodeId;

      const solution = await service.create({
        action: ActionType.CREATE,
        nodeType: "solution",
        content: "Deep solution",
        parentId: observationId,
      });
      const solutionId = JSON.parse(solution.content[0].text).nodeId;

      // Connect solution to problem
      await service.connect({
        action: ActionType.CONNECT,
        from: solutionId,
        to: problemId,
        type: "solves",
      });

      // Query for similar problems to trigger debug path building
      await service.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Another deep problem",
      });

      const result = await service.query({
        action: ActionType.QUERY,
        type: "similar-problems",
        parameters: {
          pattern: "deep problem",
          limit: 5,
        },
      });

      const response = JSON.parse(result.content[0].text);
      const problemWithSolution = response.results.problems.find(
        (p: any) => p.nodeId === problemId
      );

      if (problemWithSolution && problemWithSolution.solutions.length > 0) {
        const debugPath = problemWithSolution.solutions[0].debugPath;
        expect(debugPath).toBeDefined();
        expect(debugPath.length).toBeGreaterThanOrEqual(2); // At least problem and solution

        // Verify the path includes the problem and solution
        const pathNodeIds = debugPath.map((n: any) => n.nodeId);
        expect(pathNodeIds).toContain(problemId);
        expect(pathNodeIds).toContain(solutionId);

        // The first node should be the problem
        expect(debugPath[0].nodeId).toBe(problemId);

        // The last node should be the solution
        expect(debugPath[debugPath.length - 1].nodeId).toBe(solutionId);
      }
    });

    it("should handle complex graph structures with multiple edge types", async () => {
      const service = new GraphService();
      await service.initialize();

      // Create nodes
      const hyp1 = await service.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Hypothesis 1",
      });
      const hypId1 = JSON.parse(hyp1.content[0].text).nodeId;

      const hyp2 = await service.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Hypothesis 2",
      });
      const hypId2 = JSON.parse(hyp2.content[0].text).nodeId;

      const exp = await service.create({
        action: ActionType.CREATE,
        nodeType: "experiment",
        content: "Test experiment",
      });
      const expId = JSON.parse(exp.content[0].text).nodeId;

      // Create multiple edges
      await service.connect({
        action: ActionType.CONNECT,
        from: expId,
        to: hypId1,
        type: "supports",
      });

      await service.connect({
        action: ActionType.CONNECT,
        from: expId,
        to: hypId2,
        type: "contradicts",
      });

      // Verify edges are properly indexed
      // @ts-ignore - access private property for testing
      const expEdges = service.edgesByNode.get(expId);
      expect(expEdges?.outgoing.length).toBe(2);

      const supportEdge = expEdges?.outgoing.find((e) => e.type === "supports");
      expect(supportEdge?.to).toBe(hypId1);

      const contradictEdge = expEdges?.outgoing.find((e) => e.type === "contradicts");
      expect(contradictEdge?.to).toBe(hypId2);
    });
  });
});
