import { describe, it, expect } from 'vitest';
import {
  ActionType,
  CreateAction,
  ConnectAction,
  QueryAction,
  getAutoEdgeType,
} from '../../types/graphActions.js';

describe('Graph Actions', () => {
  describe('ActionType enum', () => {
    it('should have correct action types', () => {
      expect(ActionType.CREATE).toBe('create');
      expect(ActionType.CONNECT).toBe('connect');
      expect(ActionType.QUERY).toBe('query');
    });
  });

  describe('CreateAction', () => {
    it('should have correct structure', () => {
      const createAction: CreateAction = {
        action: ActionType.CREATE,
        nodeType: 'problem',
        content: 'Test problem',
        parentId: 'parent-123',
        metadata: {
          confidence: 80,
          tags: ['bug', 'critical'],
        },
      };

      expect(createAction.action).toBe(ActionType.CREATE);
      expect(createAction.nodeType).toBe('problem');
      expect(createAction.content).toBe('Test problem');
      expect(createAction.parentId).toBe('parent-123');
      expect(createAction.metadata?.confidence).toBe(80);
      expect(createAction.metadata?.tags).toEqual(['bug', 'critical']);
    });

    it('should work without optional fields', () => {
      const minimalAction: CreateAction = {
        action: ActionType.CREATE,
        nodeType: 'hypothesis',
        content: 'Simple hypothesis',
      };

      expect(minimalAction.parentId).toBeUndefined();
      expect(minimalAction.metadata).toBeUndefined();
    });
  });

  describe('ConnectAction', () => {
    it('should have correct structure', () => {
      const connectAction: ConnectAction = {
        action: ActionType.CONNECT,
        from: 'node-1',
        to: 'node-2',
        type: 'supports',
        strength: 0.9,
        metadata: {
          reasoning: 'Strong evidence',
          evidence: 'Test results',
        },
      };

      expect(connectAction.action).toBe(ActionType.CONNECT);
      expect(connectAction.from).toBe('node-1');
      expect(connectAction.to).toBe('node-2');
      expect(connectAction.type).toBe('supports');
      expect(connectAction.strength).toBe(0.9);
      expect(connectAction.metadata?.reasoning).toBe('Strong evidence');
    });

    it('should work without optional fields', () => {
      const minimalAction: ConnectAction = {
        action: ActionType.CONNECT,
        from: 'a',
        to: 'b',
        type: 'learns',
      };

      expect(minimalAction.strength).toBeUndefined();
      expect(minimalAction.metadata).toBeUndefined();
    });
  });

  describe('QueryAction', () => {
    it('should support all query types', () => {
      const queryTypes = [
        'similar-problems',
        'successful-patterns',
        'failed-hypotheses',
        'learning-path',
        'solution-candidates',
        'graph-visualization',
        'node-details',
        'related-nodes',
        'pattern-match',
      ];

      queryTypes.forEach(queryType => {
        const action: QueryAction = {
          action: ActionType.QUERY,
          type: queryType as any,
        };
        expect(action.type).toBe(queryType);
      });
    });

    it('should support query parameters', () => {
      const queryAction: QueryAction = {
        action: ActionType.QUERY,
        type: 'similar-problems',
        parameters: {
          nodeId: 'ref-node',
          pattern: 'memory leak',
          nodeTypes: ['problem', 'hypothesis'],
          edgeTypes: ['supports', 'contradicts'],
          confidence: 75,
          limit: 10,
          depth: 3,
          timeRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31'),
          },
          tags: ['performance', 'memory'],
        },
      };

      expect(queryAction.parameters?.nodeId).toBe('ref-node');
      expect(queryAction.parameters?.pattern).toBe('memory leak');
      expect(queryAction.parameters?.nodeTypes).toEqual(['problem', 'hypothesis']);
      expect(queryAction.parameters?.confidence).toBe(75);
      expect(queryAction.parameters?.limit).toBe(10);
      expect(queryAction.parameters?.tags).toContain('performance');
    });

    it('should work without parameters', () => {
      const minimalQuery: QueryAction = {
        action: ActionType.QUERY,
        type: 'graph-visualization',
      };

      expect(minimalQuery.parameters).toBeUndefined();
    });
  });

  describe('getAutoEdgeType', () => {
    it('should return correct edge type for valid parent-child combinations', () => {
      expect(getAutoEdgeType('problem', 'problem')).toBe('decomposes');
      expect(getAutoEdgeType('problem', 'hypothesis')).toBe('hypothesizes');
      expect(getAutoEdgeType('hypothesis', 'experiment')).toBe('tests');
      expect(getAutoEdgeType('experiment', 'observation')).toBe('produces');
      expect(getAutoEdgeType('observation', 'learning')).toBe('learns');
      expect(getAutoEdgeType('solution', 'problem')).toBe('solves');
    });

    it('should return null for invalid combinations', () => {
      expect(getAutoEdgeType('problem', 'experiment')).toBeNull();
      expect(getAutoEdgeType('hypothesis', 'learning')).toBeNull();
      expect(getAutoEdgeType('solution', 'hypothesis')).toBeNull();
      expect(getAutoEdgeType('learning', 'problem')).toBeNull();
    });
  });

  describe('Response types', () => {
    it('should support CreateResponse structure', () => {
      const response = {
        success: true,
        nodeId: 'new-node-123',
        edgeId: 'new-edge-456',
        message: 'Node created successfully',
        suggestions: {
          relatedProblems: ['prob-1', 'prob-2'],
          possibleHypotheses: ['hyp-1'],
          recommendedExperiments: ['exp-1'],
        },
      };

      expect(response.success).toBe(true);
      expect(response.nodeId).toBe('new-node-123');
      expect(response.suggestions?.relatedProblems).toHaveLength(2);
    });

    it('should support ConnectResponse with conflicts', () => {
      const response = {
        success: true,
        edgeId: 'edge-789',
        message: 'Connected successfully',
        conflicts: {
          conflictingEdges: ['edge-1', 'edge-2'],
          explanation: 'Contradicts existing support relationship',
        },
      };

      expect(response.conflicts?.conflictingEdges).toHaveLength(2);
      expect(response.conflicts?.explanation).toContain('Contradicts');
    });

    it('should support QueryResponse', () => {
      const response = {
        success: true,
        results: {
          problems: [
            {
              nodeId: 'p1',
              content: 'Memory leak',
              similarity: 0.85,
              solutions: [
                {
                  nodeId: 's1',
                  content: 'Fix event listeners',
                  verified: true,
                },
              ],
            },
          ],
        },
        message: 'Found 1 similar problem',
        queryTime: 45,
      };

      expect(response.success).toBe(true);
      expect(response.queryTime).toBe(45);
      expect(response.results.problems[0].similarity).toBe(0.85);
    });
  });
});