import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GraphService } from '../../services/GraphService.js';
import { ActionType } from '../../types/graphActions.js';
import { NodeType } from '../../types/graph.js';

describe('GraphService', () => {
  let graphService: GraphService;

  beforeEach(async () => {
    // Ensure clean test environment
    process.env.DEBUG_DATA_DIR = `.test-graph-service-${Date.now()}`;
    graphService = new GraphService();
    await graphService.initialize();
  });

  afterEach(async () => {
    // Clean up
    if (process.env.DEBUG_DATA_DIR) {
      const fs = await import('fs/promises');
      try {
        // Remove the entire test directory, not just the subdirectory
        await fs.rm(process.env.DEBUG_DATA_DIR, { recursive: true, force: true });
      } catch (error) {
        // Directory might not exist
      }
      delete process.env.DEBUG_DATA_DIR;
    }
  });

  describe('CREATE action', () => {
    it('should create a problem node', async () => {
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'problem',
        content: 'App crashes on startup',
        metadata: {
          tags: ['crash', 'startup'],
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.nodeId).toBeDefined();
      expect(response.message).toContain('Created problem node');
    });

    it('should create a hypothesis with parent problem', async () => {
      // First create a problem
      const problemResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'problem',
        content: 'Memory leak detected',
      });
      const problemResponse = JSON.parse(problemResult.content[0].text);
      expect(problemResponse.success).toBe(true);
      expect(problemResponse.nodeId).toBeDefined();

      // Then create a hypothesis
      const hypothesisResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'hypothesis',
        content: 'Event listeners not being cleaned up',
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

    it('should fail when parent node does not exist', async () => {
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'hypothesis',
        content: 'Some hypothesis',
        parentId: 'non-existent-id',
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.message).toContain('Parent node non-existent-id not found');
    });

    it('should add root problem to roots array', async () => {
      const result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'problem',
        content: 'Root problem',
      });

      const response = JSON.parse(result.content[0].text);
      const graph = graphService.getGraph();
      expect(graph.roots).toContain(response.nodeId);
    });
  });

  describe('CONNECT action', () => {
    it('should connect two nodes', async () => {
      // Create two nodes
      const node1Result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'observation',
        content: 'Error disappeared after fix',
      });
      const node1 = JSON.parse(node1Result.content[0].text);

      const node2Result = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'learning',
        content: 'Always clean up event listeners',
      });
      const node2 = JSON.parse(node2Result.content[0].text);

      // Connect them
      const connectResult = await graphService.connect({
        action: ActionType.CONNECT,
        from: node1.nodeId,
        to: node2.nodeId,
        type: 'learns',
        strength: 0.9,
      });

      const connectResponse = JSON.parse(connectResult.content[0].text);
      expect(connectResponse.success).toBe(true);
      expect(connectResponse.edgeId).toBeDefined();
      expect(connectResponse.message).toContain('Connected observation to learning');
    });

    it('should detect conflicting edges', async () => {
      // Create hypothesis and experiment
      const hypResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'hypothesis',
        content: 'Theory A',
      });
      const hyp = JSON.parse(hypResult.content[0].text);

      const expResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'experiment',
        content: 'Test theory',
      });
      const exp = JSON.parse(expResult.content[0].text);

      // Create supporting edge
      await graphService.connect({
        action: ActionType.CONNECT,
        from: exp.nodeId,
        to: hyp.nodeId,
        type: 'supports',
      });

      // Create contradicting edge
      const contradictResult = await graphService.connect({
        action: ActionType.CONNECT,
        from: exp.nodeId,
        to: hyp.nodeId,
        type: 'contradicts',
      });

      const contradictResponse = JSON.parse(contradictResult.content[0].text);
      expect(contradictResponse.success).toBe(true);
      expect(contradictResponse.conflicts).toBeDefined();
      expect(contradictResponse.conflicts.conflictingEdges).toHaveLength(1);
    });

    it('should fail when nodes do not exist', async () => {
      const result = await graphService.connect({
        action: ActionType.CONNECT,
        from: 'non-existent-1',
        to: 'non-existent-2',
        type: 'supports',
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.message).toContain('Node(s) not found');
    });
  });

  describe('QUERY action', () => {
    beforeEach(async () => {
      // Set up some test data
      const problem1 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'problem',
        content: 'TypeScript compilation error',
      });
      const p1 = JSON.parse(problem1.content[0].text);

      const solution1 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'solution',
        content: 'Fix type definitions',
      });
      const s1 = JSON.parse(solution1.content[0].text);

      await graphService.connect({
        action: ActionType.CONNECT,
        from: s1.nodeId,
        to: p1.nodeId,
        type: 'solves',
      });

      await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'problem',
        content: 'TypeScript type mismatch in React component',
      });
    });

    it('should find similar problems', async () => {
      const result = await graphService.query({
        action: ActionType.QUERY,
        type: 'similar-problems',
        parameters: {
          pattern: 'typescript',
          limit: 5,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.problems).toBeDefined();
      expect(response.results.problems.length).toBeGreaterThan(0);
      expect(response.results.problems[0].content).toContain('TypeScript');
    });

    it('should get node details', async () => {
      const problem = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'problem',
        content: 'Test problem for details',
      });
      const p = JSON.parse(problem.content[0].text);

      const result = await graphService.query({
        action: ActionType.QUERY,
        type: 'node-details',
        parameters: {
          nodeId: p.nodeId,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results).toBeDefined();
      expect(response.results.node).toBeDefined();
      expect(response.results.node.content).toBe('Test problem for details');
      expect(response.results.incomingEdges).toBeDefined();
      expect(response.results.outgoingEdges).toBeDefined();
    });

    it('should trace learning path', async () => {
      // Create a path: problem -> hypothesis -> experiment -> observation -> learning
      const problem = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'problem',
        content: 'Path test problem',
      });
      const p = JSON.parse(problem.content[0].text);

      const hypothesis = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'hypothesis',
        content: 'Path test hypothesis',
        parentId: p.nodeId,
      });
      const h = JSON.parse(hypothesis.content[0].text);

      const experiment = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'experiment',
        content: 'Path test experiment',
        parentId: h.nodeId,
      });

      const result = await graphService.query({
        action: ActionType.QUERY,
        type: 'learning-path',
        parameters: {
          nodeId: p.nodeId,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.path).toBeDefined();
      expect(response.results.path.length).toBeGreaterThanOrEqual(3);
    });

    it('should generate graph visualization', async () => {
      const result = await graphService.query({
        action: ActionType.QUERY,
        type: 'graph-visualization',
        parameters: {},
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.format).toBe('mermaid');
      expect(response.results.content).toContain('graph TD');
      expect(response.results.nodeCount).toBeGreaterThan(0);
    });

    it('should handle unknown query type', async () => {
      const result = await graphService.query({
        action: ActionType.QUERY,
        type: 'unknown-query-type' as any,
        parameters: {},
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.message).toContain('Unknown query type');
    });

    it('should find successful patterns', async () => {
      // Create a successful pattern: problem -> hypothesis -> solution
      const problem = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'problem',
        content: 'Performance issue',
      });
      const problemId = JSON.parse(problem.content[0].text).nodeId;

      const hypothesis = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'hypothesis',
        content: 'Memory leak',
        parentId: problemId,
      });
      const hypothesisId = JSON.parse(hypothesis.content[0].text).nodeId;

      const solution = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'solution',
        content: 'Fix memory leak',
      });
      const solutionId = JSON.parse(solution.content[0].text).nodeId;

      await graphService.connect({
        action: ActionType.CONNECT,
        from: solutionId,
        to: problemId,
        type: 'solves',
      });

      const result = await graphService.query({
        action: ActionType.QUERY,
        type: 'successful-patterns',
        parameters: {},
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.patterns).toBeDefined();
    });

    it('should find failed hypotheses', async () => {
      // Create a failed hypothesis
      const problem = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'problem',
        content: 'Bug in code',
      });
      const problemId = JSON.parse(problem.content[0].text).nodeId;

      const hypothesis = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'hypothesis',
        content: 'Wrong theory',
        parentId: problemId,
        metadata: { confidence: 20 },
      });

      const result = await graphService.query({
        action: ActionType.QUERY,
        type: 'failed-hypotheses',
        parameters: {},
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results).toBeDefined();
    });

    it('should find solution candidates', async () => {
      // Create a problem and potential solutions
      const problem = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'problem',
        content: 'API timeout issue',
      });
      const problemId = JSON.parse(problem.content[0].text).nodeId;

      // Create a relevant solution
      const solution = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'solution',
        content: 'Increase API timeout value',
        metadata: { verified: true },
      });

      const result = await graphService.query({
        action: ActionType.QUERY,
        type: 'solution-candidates',
        parameters: { nodeId: problemId },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.candidates).toBeDefined();
      expect(response.results.candidates.length).toBeGreaterThan(0);
    });

    it('should handle solution candidates with no node ID', async () => {
      const result = await graphService.query({
        action: ActionType.QUERY,
        type: 'solution-candidates',
        parameters: {},
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.candidates).toEqual([]);
    });

    it('should handle solution candidates for non-problem node', async () => {
      const hypothesis = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'hypothesis',
        content: 'Test hypothesis',
      });
      const hypothesisId = JSON.parse(hypothesis.content[0].text).nodeId;

      const result = await graphService.query({
        action: ActionType.QUERY,
        type: 'solution-candidates',
        parameters: { nodeId: hypothesisId },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.candidates).toEqual([]);
    });

    it('should find related nodes', async () => {
      const node1 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'problem',
        content: 'Test problem',
      });
      const nodeId1 = JSON.parse(node1.content[0].text).nodeId;

      const node2 = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'hypothesis',
        content: 'Related hypothesis',
        parentId: nodeId1,
      });

      const result = await graphService.query({
        action: ActionType.QUERY,
        type: 'related-nodes',
        parameters: { nodeId: nodeId1 },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results).toBeDefined();
    });

    it('should handle pattern-match query', async () => {
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'problem',
        content: 'Memory leak in production',
        metadata: { tags: ['memory', 'production'] },
      });

      const result = await graphService.query({
        action: ActionType.QUERY,
        type: 'pattern-match',
        parameters: {
          pattern: 'memory',
          nodeTypes: ['problem'],
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results).toBeDefined();
      expect(response.results.matches.length).toBeGreaterThan(0);
    });

    it('should match patterns in tags', async () => {
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'problem',
        content: 'Some other issue',
        metadata: { tags: ['performance', 'critical'] },
      });

      const result = await graphService.query({
        action: ActionType.QUERY,
        type: 'pattern-match',
        parameters: {
          pattern: 'critical',
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.matches.length).toBeGreaterThan(0);
      expect(response.results.matches[0].matchType).toBe('tag');
    });

    it('should handle pattern-match with no pattern', async () => {
      const result = await graphService.query({
        action: ActionType.QUERY,
        type: 'pattern-match',
        parameters: {},
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.results.matches).toEqual([]);
    });
  });

  describe('Automatic edge creation', () => {
    it('should create correct edge types based on node types', async () => {
      // Problem -> Problem (decomposes)
      const rootProblem = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'problem',
        content: 'Main problem',
      });
      const rp = JSON.parse(rootProblem.content[0].text);

      const subProblem = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'problem',
        content: 'Sub problem',
        parentId: rp.nodeId,
      });
      const sp = JSON.parse(subProblem.content[0].text);

      // Check that edge was created
      const graph = graphService.getGraph();
      const edge = Array.from(graph.edges.values()).find(
        e => e.from === rp.nodeId && e.to === sp.nodeId
      );
      expect(edge).toBeDefined();
      expect(edge?.type).toBe('decomposes');

      // Problem -> Hypothesis (hypothesizes)
      const hypothesis = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'hypothesis',
        content: 'Test hypothesis',
        parentId: sp.nodeId,
      });
      const h = JSON.parse(hypothesis.content[0].text);

      const hypEdge = Array.from(graph.edges.values()).find(
        e => e.from === sp.nodeId && e.to === h.nodeId
      );
      expect(hypEdge?.type).toBe('hypothesizes');
    });
  });

  describe('Graph persistence', () => {
    it('should save and load graph data', async () => {
      // Create some data
      await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'problem',
        content: 'Persistence test problem',
      });

      await graphService.saveGraph();

      // Create new instance and load
      const newGraphService = new GraphService();
      await newGraphService.initialize();

      const graph = newGraphService.getGraph();
      expect(graph.nodes.size).toBeGreaterThan(0);
      const hasPersistedProblem = Array.from(graph.nodes.values()).some(
        n => n.content === 'Persistence test problem'
      );
      expect(hasPersistedProblem).toBe(true);
    });
  });
});