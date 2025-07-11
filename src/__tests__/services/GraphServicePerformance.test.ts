import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GraphService } from "../../services/GraphService.js";
import { ActionType } from "../../types/graphActions.js";
import type { NodeType } from "../../types/graph.js";

// Test suite for performance characteristics
describe("GraphService - Performance Tests", () => {
  let graphService: GraphService;

  beforeEach(async () => {
    process.env.DEBUG_DATA_DIR = `.test-performance-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    graphService = new GraphService();
    await graphService.initialize();
  });

  afterEach(async () => {
    if (process.env.DEBUG_DATA_DIR) {
      const fs = await import("fs/promises");
      try {
        await fs.rm(process.env.DEBUG_DATA_DIR, { recursive: true, force: true });
      } catch (_error) {
        // Directory might not exist
      }
      delete process.env.DEBUG_DATA_DIR;
    }
  });

  describe("Similarity calculation performance", () => {
    it("should calculate similarity efficiently for short texts", async () => {
      // Create baseline problems
      for (let i = 0; i < 100; i++) {
        await graphService.create({
          action: ActionType.CREATE,
          nodeType: "problem",
          content: `Short error ${i}`,
        });
      }

      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await graphService.create({
          action: ActionType.CREATE,
          nodeType: "problem",
          content: `Short error test ${i}`,
        });
        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b) / times.length;
      console.log(`Average time for short text similarity: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(50); // Should be very fast for short texts
    });

    it("should handle long text similarity efficiently", { timeout: 30000 }, async () => {
      // Create problems with long content
      const longText = "Lorem ipsum dolor sit amet ".repeat(100);

      for (let i = 0; i < 20; i++) {
        await graphService.create({
          action: ActionType.CREATE,
          nodeType: "problem",
          content: `${longText} variation ${i}`,
        });
      }

      const startTime = performance.now();
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: `${longText} new variation`,
      });
      const endTime = performance.now();

      const duration = endTime - startTime;
      console.log(`Time for long text similarity: ${duration.toFixed(2)}ms`);
      // パフォーマンス最適化により、長いテキストでも許容範囲内の時間で処理
      expect(duration).toBeLessThan(300); // Should use word-level similarity for efficiency
    });

    it("should use error type indexing for performance", async () => {
      // Create many problems with different error types
      const errorTypes = ["TypeError", "ReferenceError", "SyntaxError", "RangeError", "Error"];

      for (let i = 0; i < 500; i++) {
        const errorType = errorTypes[i % errorTypes.length];
        await graphService.create({
          action: ActionType.CREATE,
          nodeType: "problem",
          content: `${errorType}: Problem number ${i} in module ${i % 10}`,
        });
      }

      // Measure search time with error type
      const startTimeWithType = performance.now();
      const resultWithType = await graphService.query({
        action: ActionType.QUERY,
        type: "similar-problems",
        parameters: {
          pattern: "TypeError: New problem in module 5",
          limit: 10,
        },
      });
      const endTimeWithType = performance.now();
      const durationWithType = endTimeWithType - startTimeWithType;

      // Measure search time without specific error type
      const startTimeWithoutType = performance.now();
      const resultWithoutType = await graphService.query({
        action: ActionType.QUERY,
        type: "similar-problems",
        parameters: {
          pattern: "Generic problem in module 5",
          limit: 10,
        },
      });
      const endTimeWithoutType = performance.now();
      const durationWithoutType = endTimeWithoutType - startTimeWithoutType;

      console.log(`Search with error type: ${durationWithType.toFixed(2)}ms`);
      console.log(`Search without error type: ${durationWithoutType.toFixed(2)}ms`);

      // Both should be fast, but error type search should be faster
      expect(durationWithType).toBeLessThan(100);
      expect(durationWithoutType).toBeLessThan(150);

      // Verify results are meaningful
      const responseWithType = JSON.parse(resultWithType.content[0].text);
      const responseWithoutType = JSON.parse(resultWithoutType.content[0].text);
      expect(responseWithType.success).toBe(true);
      expect(responseWithoutType.success).toBe(true);
    });
  });

  describe("Scalability tests", () => {
    it("should maintain performance with increasing graph size", { timeout: 30000 }, async () => {
      const measurements = [];
      const checkpoints = [10, 50, 100, 200, 500];

      let totalNodes = 0;
      for (const checkpoint of checkpoints) {
        // Add nodes up to checkpoint
        while (totalNodes < checkpoint) {
          await graphService.create({
            action: ActionType.CREATE,
            nodeType: "problem",
            content: `Problem ${totalNodes}: ${totalNodes % 2 === 0 ? "TypeError" : "Error"} in module`,
          });
          totalNodes++;
        }

        // Measure query performance at this checkpoint
        const startTime = performance.now();
        const _result = await graphService.query({
          action: ActionType.QUERY,
          type: "similar-problems",
          parameters: {
            pattern: "TypeError in module with issue",
            limit: 10,
          },
        });
        const endTime = performance.now();

        measurements.push({
          nodeCount: checkpoint,
          queryTime: endTime - startTime,
        });
      }

      console.log("Scalability measurements:");
      measurements.forEach((m) => {
        console.log(`  ${m.nodeCount} nodes: ${m.queryTime.toFixed(2)}ms`);
      });

      // Query time should not increase linearly with node count
      const firstTime = measurements[0].queryTime;
      const lastTime = measurements[measurements.length - 1].queryTime;
      const timeIncrease = lastTime / firstTime;
      const nodeIncrease = checkpoints[checkpoints.length - 1] / checkpoints[0];

      console.log(`Time increased ${timeIncrease.toFixed(2)}x for ${nodeIncrease}x more nodes`);
      expect(timeIncrease).toBeLessThan(nodeIncrease); // Should not scale linearly
    });

    it("should handle complex graph structures efficiently", async () => {
      // Create a complex interconnected graph
      const problemCount = 50;
      const problemIds: string[] = [];

      // Create problems
      for (let i = 0; i < problemCount; i++) {
        const result = await graphService.create({
          action: ActionType.CREATE,
          nodeType: "problem",
          content: `Complex problem ${i}`,
        });
        problemIds.push(JSON.parse(result.content[0].text).nodeId);
      }

      // Create hypotheses for each problem
      const hypothesisIds: string[] = [];
      for (let i = 0; i < problemCount; i++) {
        const result = await graphService.create({
          action: ActionType.CREATE,
          nodeType: "hypothesis",
          content: `Hypothesis for problem ${i}`,
          parentId: problemIds[i],
        });
        hypothesisIds.push(JSON.parse(result.content[0].text).nodeId);
      }

      // Create cross-connections
      for (let i = 0; i < 20; i++) {
        const from = hypothesisIds[i];
        const to = hypothesisIds[(i + 5) % hypothesisIds.length];
        await graphService.connect({
          action: ActionType.CONNECT,
          from,
          to,
          type: "supports",
        });
      }

      // Measure recent activity query performance
      const startTime = performance.now();
      const result = await graphService.query({
        action: ActionType.QUERY,
        type: "recent-activity",
        parameters: {
          limit: 20,
        },
      });
      const endTime = performance.now();

      const duration = endTime - startTime;
      console.log(`Recent activity query on complex graph: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50); // Should be fast even with complex structure

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.nodes.length).toBe(20);
    });
  });

  describe("Memory efficiency", () => {
    it("should handle large numbers of similar problems efficiently", async () => {
      // Create many very similar problems
      const baseError =
        "TypeError: Cannot read property 'data' of undefined in UserService.getUser()";

      for (let i = 0; i < 200; i++) {
        // Slight variations
        const variation = baseError.replace("data", `data${i % 10}`);
        await graphService.create({
          action: ActionType.CREATE,
          nodeType: "problem",
          content: variation,
        });
      }

      // Memory shouldn't explode with similar content
      const startTime = performance.now();
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "TypeError: Cannot read property 'data5' of undefined in UserService.getUser()",
      });
      const endTime = performance.now();

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.similarProblems).toBeDefined();
      expect(response.similarProblems.length).toBeGreaterThan(0);

      const duration = endTime - startTime;
      console.log(`Time to find similar among 200 near-duplicates: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(150);
    });
  });

  describe("Algorithm efficiency", () => {
    it("should efficiently compute longest common substring", async () => {
      // Test the LCS algorithm performance
      const text1 = `${"a".repeat(500)}unique_pattern${"b".repeat(500)}`;
      const text2 = `${"c".repeat(500)}unique_pattern${"d".repeat(500)}`;

      const startTime = performance.now();
      // @ts-ignore - accessing private method for testing
      const lcs = graphService.findLongestCommonSubstring(text1, text2);
      const endTime = performance.now();

      expect(lcs).toBe("unique_pattern");
      const duration = endTime - startTime;
      console.log(`LCS for 1000+ char strings: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50);
    });

    it("should efficiently compute edit distance", async () => {
      // Test Levenshtein distance performance
      const text1 = "The quick brown fox jumps over the lazy dog";
      const text2 = "The quick brown cat jumps over the lazy dog";

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // @ts-ignore - accessing private method for testing
        graphService.calculateLevenshteinSimilarity(text1, text2);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      console.log(`Average Levenshtein calculation: ${avgTime.toFixed(3)}ms`);
      expect(avgTime).toBeLessThan(1); // Should be sub-millisecond
    });

    it("should use word-level similarity for long texts", { timeout: 30000 }, async () => {
      const longText1 = "Lorem ipsum dolor sit amet consectetur adipiscing elit ".repeat(50);
      const longText2 = "Lorem ipsum dolor sit amet consectetur adipiscing elit sed ".repeat(50);

      const startTime = performance.now();
      // @ts-ignore - accessing private method for testing
      const similarity = graphService.calculateWordLevelSimilarity(longText1, longText2);
      const endTime = performance.now();

      const duration = endTime - startTime;
      console.log(`Word-level similarity for long texts: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50);
      expect(similarity).toBeGreaterThan(0.8); // Should be similar
    });
  });

  describe("Batch operation performance", () => {
    it("should handle batch creation efficiently", async () => {
      const batchSize = 100;
      const batches = 5;

      const batchTimes: number[] = [];

      for (let batch = 0; batch < batches; batch++) {
        const startTime = performance.now();

        const promises = [];
        for (let i = 0; i < batchSize; i++) {
          promises.push(
            graphService.create({
              action: ActionType.CREATE,
              nodeType: "problem",
              content: `Batch ${batch} problem ${i}`,
            })
          );
        }

        await Promise.all(promises);
        const endTime = performance.now();
        batchTimes.push(endTime - startTime);
      }

      const avgBatchTime = batchTimes.reduce((a, b) => a + b) / batchTimes.length;
      console.log(`Average time for ${batchSize} concurrent creates: ${avgBatchTime.toFixed(2)}ms`);
      console.log(`Average time per operation: ${(avgBatchTime / batchSize).toFixed(2)}ms`);

      // Should handle concurrent operations efficiently
      expect(avgBatchTime).toBeLessThan(1000); // Less than 1 second for 100 operations
    });

    it("should maintain consistency during concurrent operations", async () => {
      // Create a base problem
      const baseResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content: "Base problem for concurrent test",
      });
      const baseId = JSON.parse(baseResult.content[0].text).nodeId;

      // Create many hypotheses concurrently
      const concurrentCount = 50;
      const promises = [];

      for (let i = 0; i < concurrentCount; i++) {
        promises.push(
          graphService.create({
            action: ActionType.CREATE,
            nodeType: "hypothesis",
            content: `Concurrent hypothesis ${i}`,
            parentId: baseId,
          })
        );
      }

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const endTime = performance.now();

      // All should succeed
      results.forEach((result) => {
        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
      });

      // Verify graph consistency
      const graph = graphService.getGraph();
      const edges = Array.from(graph.edges.values()).filter(
        (e) => e.from === baseId && e.type === "hypothesizes"
      );
      expect(edges.length).toBe(concurrentCount);

      const duration = endTime - startTime;
      console.log(
        `Time for ${concurrentCount} concurrent parent-child creates: ${duration.toFixed(2)}ms`
      );
      expect(duration).toBeLessThan(500);
    });
  });

  describe("Index performance", () => {
    it("should build indexes efficiently", { timeout: 30000 }, async () => {
      // Create a large graph
      const nodeCount = 1000;

      for (let i = 0; i < nodeCount; i++) {
        const nodeType = [
          "problem",
          "hypothesis",
          "experiment",
          "observation",
          "learning",
          "solution",
        ][i % 6];
        await graphService.create({
          action: ActionType.CREATE,
          nodeType: nodeType as NodeType,
          content: `Node ${i} of type ${nodeType}`,
        });
      }

      // Force index rebuild and measure time
      const startTime = performance.now();
      // @ts-ignore - accessing private methods for testing
      graphService.buildErrorTypeIndex();
      // @ts-ignore
      graphService.buildPerformanceIndexes();
      const endTime = performance.now();

      const duration = endTime - startTime;
      console.log(`Index rebuild for ${nodeCount} nodes: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100); // Should be very fast

      // Verify indexes are populated
      // @ts-ignore - accessing private property for testing
      expect(graphService.nodesByType.size).toBeGreaterThan(0);
      // @ts-ignore
      expect(graphService.edgesByNode.size).toBe(nodeCount);
    });

    it("should use indexes to accelerate queries", async () => {
      // Create nodes with specific patterns
      for (let i = 0; i < 100; i++) {
        await graphService.create({
          action: ActionType.CREATE,
          nodeType: "problem",
          content: `${i % 3 === 0 ? "TypeError" : "Error"}: Issue in module ${i}`,
        });
      }

      // Query without index (simulate by searching for generic pattern)
      const startTimeGeneric = performance.now();
      await graphService.query({
        action: ActionType.QUERY,
        type: "similar-problems",
        parameters: {
          pattern: "Issue in module",
          limit: 10,
        },
      });
      const endTimeGeneric = performance.now();
      const durationGeneric = endTimeGeneric - startTimeGeneric;

      // Query with index benefit (specific error type)
      const startTimeIndexed = performance.now();
      await graphService.query({
        action: ActionType.QUERY,
        type: "similar-problems",
        parameters: {
          pattern: "TypeError: Issue in module 42",
          limit: 10,
        },
      });
      const endTimeIndexed = performance.now();
      const durationIndexed = endTimeIndexed - startTimeIndexed;

      console.log(`Generic query: ${durationGeneric.toFixed(2)}ms`);
      console.log(`Indexed query: ${durationIndexed.toFixed(2)}ms`);

      // Both should be fast, but indexed should generally be faster
      expect(durationIndexed).toBeLessThan(50);
      expect(durationGeneric).toBeLessThan(100);
    });
  });

  describe("Real-world performance scenarios", () => {
    it("should handle typical debugging session efficiently", async () => {
      // Simulate a typical debugging session
      const sessionStartTime = performance.now();

      // 1. Create initial problem
      const problem = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "problem",
        content:
          "TypeError: Cannot read property 'user' of undefined in AuthService.validateToken()",
      });
      const problemId = JSON.parse(problem.content[0].text).nodeId;

      // Check for similar problems (should find some from setup)
      expect(JSON.parse(problem.content[0].text).similarProblems).toBeDefined();

      // 2. Create hypotheses
      const hyp1 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "Token might be expired",
        parentId: problemId,
      });
      const hypId1 = JSON.parse(hyp1.content[0].text).nodeId;

      const hyp2 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "hypothesis",
        content: "User object not properly initialized",
        parentId: problemId,
      });
      const hypId2 = JSON.parse(hyp2.content[0].text).nodeId;

      // 3. Create experiments
      const _exp1 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "experiment",
        content: "Check token expiration time",
        parentId: hypId1,
      });

      const exp2 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "experiment",
        content: "Log user object before access",
        parentId: hypId2,
      });
      const expId2 = JSON.parse(exp2.content[0].text).nodeId;

      // 4. Create observation
      const _obs = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "observation",
        content: "User object is null when token is valid but user deleted",
        parentId: expId2,
      });

      // 5. Create solution
      const solution = await graphService.create({
        action: ActionType.CREATE,
        nodeType: "solution",
        content: "Add null check for user object after token validation",
      });
      const solutionId = JSON.parse(solution.content[0].text).nodeId;

      // 6. Connect solution
      await graphService.connect({
        action: ActionType.CONNECT,
        from: solutionId,
        to: problemId,
        type: "solves",
      });

      // 7. Query recent activity
      await graphService.query({
        action: ActionType.QUERY,
        type: "recent-activity",
        parameters: { limit: 10 },
      });

      const sessionEndTime = performance.now();
      const sessionDuration = sessionEndTime - sessionStartTime;

      console.log(`Full debugging session simulation: ${sessionDuration.toFixed(2)}ms`);
      expect(sessionDuration).toBeLessThan(500); // Should complete quickly
    });

    it("should handle continuous problem logging efficiently", async () => {
      // Simulate continuous error logging (e.g., from production monitoring)
      const logDuration = 100; // milliseconds
      const startTime = performance.now();
      let count = 0;

      while (performance.now() - startTime < logDuration) {
        await graphService.create({
          action: ActionType.CREATE,
          nodeType: "problem",
          content: `Production error ${count}: ${count % 3 === 0 ? "TypeError" : "Error"} at ${new Date().toISOString()}`,
        });
        count++;
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const opsPerSecond = (count / totalDuration) * 1000;

      console.log(`Logged ${count} problems in ${totalDuration.toFixed(2)}ms`);
      console.log(`Rate: ${opsPerSecond.toFixed(2)} operations per second`);

      expect(opsPerSecond).toBeGreaterThan(10); // Should handle at least 10 ops/sec
    });
  });
});
