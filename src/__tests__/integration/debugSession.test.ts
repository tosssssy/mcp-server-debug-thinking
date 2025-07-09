import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GraphService } from '../../services/GraphService.js';
import { ActionType } from '../../types/graphActions.js';

describe('Debug Session Integration Tests', () => {
  let graphService: GraphService;

  beforeEach(async () => {
    process.env.DEBUG_DATA_DIR = `.test-integration-${Date.now()}`;
    graphService = new GraphService();
    await graphService.initialize();
  });

  afterEach(async () => {
    if (process.env.DEBUG_DATA_DIR) {
      const fs = await import('fs/promises');
      try {
        await fs.rm(process.env.DEBUG_DATA_DIR, { recursive: true, force: true });
      } catch (error) {
        // Directory might not exist
      }
      delete process.env.DEBUG_DATA_DIR;
    }
  });

  it('should handle a complete debugging workflow', async () => {
    // 1. Create a problem
    const problemResult = await graphService.create({
      action: ActionType.CREATE,
      nodeType: 'problem',
      content: 'TypeError: Cannot read property "data" of undefined in UserList component',
      metadata: {
        tags: ['react', 'frontend', 'production-bug'],
        severity: 'high'
      }
    });
    const problem = JSON.parse(problemResult.content[0].text);
    expect(problem.success).toBe(true);
    
    // Check if similar problems were found
    if (problem.similarProblems) {
      console.log(`Found ${problem.similarProblems.length} similar problems`);
    }

    // 2. Create hypotheses
    const hypothesis1Result = await graphService.create({
      action: ActionType.CREATE,
      nodeType: 'hypothesis',
      content: 'API response might be returning null instead of empty object',
      parentId: problem.nodeId,
      metadata: {
        confidence: 85
      }
    });
    const hypothesis1 = JSON.parse(hypothesis1Result.content[0].text);

    const hypothesis2Result = await graphService.create({
      action: ActionType.CREATE,
      nodeType: 'hypothesis',
      content: 'Component might be rendering before data is loaded',
      parentId: problem.nodeId,
      metadata: {
        confidence: 70
      }
    });
    const hypothesis2 = JSON.parse(hypothesis2Result.content[0].text);

    // 3. Create and conduct experiments
    const experimentResult = await graphService.create({
      action: ActionType.CREATE,
      nodeType: 'experiment',
      content: 'Add console.log to check API response structure',
      parentId: hypothesis1.nodeId,
      metadata: {
        code: 'console.log("API Response:", response.data);'
      }
    });
    const experiment = JSON.parse(experimentResult.content[0].text);

    // 4. Record observations
    const observationResult = await graphService.create({
      action: ActionType.CREATE,
      nodeType: 'observation',
      content: 'API returns undefined when user has no data, not an empty object',
      parentId: experiment.nodeId
    });
    const observation = JSON.parse(observationResult.content[0].text);

    // Connect observation supports hypothesis
    await graphService.connect({
      action: ActionType.CONNECT,
      from: observation.nodeId,
      to: hypothesis1.nodeId,
      type: 'supports'
    });

    // 5. Extract learning
    const learningResult = await graphService.create({
      action: ActionType.CREATE,
      nodeType: 'learning',
      content: 'Always use optional chaining or default values when accessing API response data',
      metadata: {
        confidence: 95,
        applicability: 'All API response handling'
      }
    });
    const learning = JSON.parse(learningResult.content[0].text);

    // Connect observation leads to learning
    await graphService.connect({
      action: ActionType.CONNECT,
      from: observation.nodeId,
      to: learning.nodeId,
      type: 'learns'
    });

    // 6. Apply solution
    const solutionResult = await graphService.create({
      action: ActionType.CREATE,
      nodeType: 'solution',
      content: 'Use optional chaining: response?.data || {}',
      metadata: {
        code: 'const userData = response?.data || {};',
        verified: true
      }
    });
    const solution = JSON.parse(solutionResult.content[0].text);

    // Connect solution solves problem
    await graphService.connect({
      action: ActionType.CONNECT,
      from: solution.nodeId,
      to: problem.nodeId,
      type: 'solves'
    });

    // 7. Check recent activity
    const recentResult = await graphService.query({
      action: ActionType.QUERY,
      type: 'recent-activity',
      parameters: {
        limit: 5
      }
    });
    const recent = JSON.parse(recentResult.content[0].text);
    expect(recent.success).toBe(true);
    expect(recent.results.nodes.length).toBeGreaterThan(0);
    expect(recent.results.nodes[0].type).toBe('solution'); // Most recent should be the solution

    // 8. Verify persistence
    await graphService.saveGraph();
    
    // Create new instance and verify data persists
    const newGraphService = new GraphService();
    await newGraphService.initialize();
    
    const similarResult = await newGraphService.query({
      action: ActionType.QUERY,
      type: 'similar-problems',
      parameters: {
        pattern: 'TypeError property undefined',
        limit: 5
      }
    });
    const similar = JSON.parse(similarResult.content[0].text);
    expect(similar.success).toBe(true);
    expect(similar.results.problems.length).toBeGreaterThan(0);
    expect(similar.results.problems[0].solutions.length).toBeGreaterThan(0);
  });

  it('should efficiently handle similar problem search', async () => {
    // Create multiple similar problems with solutions
    const problems = [
      { content: 'TypeError: Cannot read property "id" of null', solution: 'Add null check for id' },
      { content: 'TypeError: Cannot read property "name" of undefined', solution: 'Use optional chaining for name' },
      { content: 'ReferenceError: user is not defined', solution: 'Define user variable' },
      { content: 'TypeError: Cannot access property "email" of null', solution: 'Add null check for email' }
    ];

    for (const { content, solution } of problems) {
      const problemResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'problem',
        content
      });
      const problem = JSON.parse(problemResult.content[0].text);
      
      const solutionResult = await graphService.create({
        action: ActionType.CREATE,
        nodeType: 'solution',
        content: solution,
        metadata: { verified: true }
      });
      const sol = JSON.parse(solutionResult.content[0].text);
      
      await graphService.connect({
        action: ActionType.CONNECT,
        from: sol.nodeId,
        to: problem.nodeId,
        type: 'solves'
      });
    }

    // Search for similar TypeError problems
    const searchResult = await graphService.query({
      action: ActionType.QUERY,
      type: 'similar-problems',
      parameters: {
        pattern: 'TypeError property',
        limit: 10
      }
    });

    const search = JSON.parse(searchResult.content[0].text);
    expect(search.success).toBe(true);
    expect(search.results.problems.length).toBeGreaterThanOrEqual(3); // Should find at least 3 TypeErrors
    
    // Verify that similar problems have solutions
    const typeErrorProblems = search.results.problems.filter((p: any) => 
      p.content.includes('TypeError')
    );
    expect(typeErrorProblems.length).toBeGreaterThanOrEqual(3);
    expect(typeErrorProblems.every((p: any) => p.solutions.length > 0)).toBe(true);
  });
});