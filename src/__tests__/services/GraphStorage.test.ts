import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GraphStorage } from '../../services/GraphStorage.js';
import { Node, Edge, DebugGraph } from '../../types/graph.js';
import { ensureDirectory } from '../../utils/storage.js';
import fs from 'fs/promises';
import path from 'path';

describe('GraphStorage', () => {
  let storage: GraphStorage;
  const testDataDir = '.debug-thinking-mcp-test';

  beforeEach(async () => {
    // Set test data directory
    process.env.DEBUG_DATA_DIR = testDataDir;
    storage = new GraphStorage();
    await storage.initialize();
  });

  afterEach(async () => {
    // Clean up test files
    try {
      // Remove the entire test directory
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
    // Clean up environment variable
    delete process.env.DEBUG_DATA_DIR;
  });

  describe('initialize', () => {
    it('should create data directory', async () => {
      const actualDir = path.join(testDataDir, '.debug-thinking-mcp');
      const dirExists = await fs.access(actualDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
    });
  });

  describe('saveNode', () => {
    it('should save a node to JSONL file', async () => {
      const node: Node = {
        id: 'test-node-1',
        type: 'problem',
        content: 'Test problem',
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['test'],
          status: 'open',
        },
      };

      await storage.saveNode(node);

      const nodesFile = path.join(testDataDir, '.debug-thinking-mcp', 'nodes.jsonl');
      const fileContent = await fs.readFile(nodesFile, 'utf-8');
      const savedNode = JSON.parse(fileContent.trim());

      expect(savedNode.id).toBe(node.id);
      expect(savedNode.type).toBe(node.type);
      expect(savedNode.content).toBe(node.content);
      expect(savedNode.metadata.tags).toEqual(node.metadata.tags);
    });

    it('should append multiple nodes', async () => {
      const node1: Node = {
        id: 'node-1',
        type: 'problem',
        content: 'Problem 1',
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        },
      };

      const node2: Node = {
        id: 'node-2',
        type: 'hypothesis',
        content: 'Hypothesis 1',
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          confidence: 80,
        },
      };

      await storage.saveNode(node1);
      await storage.saveNode(node2);

      const nodesFile = path.join(testDataDir, '.debug-thinking-mcp', 'nodes.jsonl');
      const fileContent = await fs.readFile(nodesFile, 'utf-8');
      const lines = fileContent.trim().split('\n');

      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]).id).toBe('node-1');
      expect(JSON.parse(lines[1]).id).toBe('node-2');
    });
  });

  describe('saveEdge', () => {
    it('should save an edge to JSONL file', async () => {
      const edge: Edge = {
        id: 'edge-1',
        type: 'hypothesizes',
        from: 'node-1',
        to: 'node-2',
        strength: 0.8,
        metadata: {
          createdAt: new Date(),
          reasoning: 'Test reasoning',
        },
      };

      await storage.saveEdge(edge);

      const edgesFile = path.join(testDataDir, '.debug-thinking-mcp', 'edges.jsonl');
      const fileContent = await fs.readFile(edgesFile, 'utf-8');
      const savedEdge = JSON.parse(fileContent.trim());

      expect(savedEdge.id).toBe(edge.id);
      expect(savedEdge.type).toBe(edge.type);
      expect(savedEdge.from).toBe(edge.from);
      expect(savedEdge.to).toBe(edge.to);
      expect(savedEdge.strength).toBe(edge.strength);
    });
  });

  describe('saveGraphMetadata', () => {
    it('should save graph metadata as JSON', async () => {
      const graph: DebugGraph = {
        nodes: new Map([
          ['n1', { id: 'n1', type: 'problem', content: 'Test', metadata: { createdAt: new Date(), updatedAt: new Date(), tags: [] } }],
        ]),
        edges: new Map([
          ['e1', { id: 'e1', type: 'supports', from: 'n1', to: 'n2', strength: 1 }],
        ]),
        roots: ['n1'],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          sessionCount: 5,
        },
      };

      await storage.saveGraphMetadata(graph);

      const metadataFile = path.join(testDataDir, '.debug-thinking-mcp', 'graph-metadata.json');
      const fileContent = await fs.readFile(metadataFile, 'utf-8');
      const savedMetadata = JSON.parse(fileContent);

      expect(savedMetadata.roots).toEqual(['n1']);
      expect(savedMetadata.sessionCount).toBe(5);
      expect(savedMetadata.nodeCount).toBe(1);
      expect(savedMetadata.edgeCount).toBe(1);
    });
  });

  describe('loadGraph', () => {
    it('should return null when no data exists', async () => {
      const graph = await storage.loadGraph();
      expect(graph).toBeNull();
    });

    it('should load graph from saved files', async () => {
      // Save some data first
      const node1: Node = {
        id: 'node-1',
        type: 'problem',
        content: 'Saved problem',
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['saved'],
        },
      };

      const edge1: Edge = {
        id: 'edge-1',
        type: 'decomposes',
        from: 'node-1',
        to: 'node-2',
        strength: 0.9,
      };

      const graph: DebugGraph = {
        nodes: new Map([['node-1', node1]]),
        edges: new Map([['edge-1', edge1]]),
        roots: ['node-1'],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          sessionCount: 1,
        },
      };

      await storage.saveNode(node1);
      await storage.saveEdge(edge1);
      await storage.saveGraphMetadata(graph);

      // Load the graph
      const loadedGraph = await storage.loadGraph();

      expect(loadedGraph).not.toBeNull();
      expect(loadedGraph!.nodes.size).toBe(1);
      expect(loadedGraph!.edges.size).toBe(1);
      expect(loadedGraph!.roots).toEqual(['node-1']);

      const loadedNode = loadedGraph!.nodes.get('node-1');
      expect(loadedNode?.content).toBe('Saved problem');
      expect(loadedNode?.metadata.tags).toEqual(['saved']);

      const loadedEdge = loadedGraph!.edges.get('edge-1');
      expect(loadedEdge?.type).toBe('decomposes');
      expect(loadedEdge?.strength).toBe(0.9);
    });

    it('should handle duplicate nodes by keeping the latest', async () => {
      const nodesFile = path.join(testDataDir, '.debug-thinking-mcp', 'nodes.jsonl');
      
      // Create directory first
      await fs.mkdir(testDataDir, { recursive: true });

      // Write duplicate nodes
      const node1v1 = {
        id: 'node-1',
        type: 'problem',
        content: 'Version 1',
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
        },
      };

      const node1v2 = {
        id: 'node-1',
        type: 'problem',
        content: 'Version 2',
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
        },
      };

      await fs.writeFile(nodesFile, JSON.stringify(node1v1) + '\n' + JSON.stringify(node1v2) + '\n');

      const loadedGraph = await storage.loadGraph();
      expect(loadedGraph).not.toBeNull();
      expect(loadedGraph!.nodes.size).toBe(1);
      
      const loadedNode = loadedGraph!.nodes.get('node-1');
      expect(loadedNode?.content).toBe('Version 2'); // Latest version
    });

    it('should handle malformed data gracefully', async () => {
      const metadataFile = path.join(testDataDir, '.debug-thinking-mcp', 'graph-metadata.json');
      
      // Create directory and write invalid JSON
      await fs.mkdir(testDataDir, { recursive: true });
      await fs.writeFile(metadataFile, 'invalid json data');

      // Should not throw, just return default metadata
      const graph = await storage.loadGraph();
      expect(graph).not.toBeNull();
      expect(graph!.metadata.sessionCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle save errors gracefully', async () => {
      const node: Node = {
        id: 'test-node',
        type: 'problem',
        content: 'Test',
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        },
      };

      // Mock file system error on appendFile (used by appendJsonLine)
      const originalAppendFile = fs.appendFile;
      vi.spyOn(fs, 'appendFile').mockRejectedValueOnce(new Error('Write failed'));

      // The error is thrown by saveNode
      await expect(storage.saveNode(node)).rejects.toThrow('Write failed');
      
      // Verify the mock was called
      expect(vi.mocked(fs.appendFile)).toHaveBeenCalled();

      vi.spyOn(fs, 'appendFile').mockImplementation(originalAppendFile);
    });

    it('should handle load errors gracefully', async () => {
      // Create files that exist but fail to parse
      await ensureDirectory(path.join(testDataDir, '.debug-thinking-mcp'));
      const metadataFile = path.join(testDataDir, '.debug-thinking-mcp', 'graph-metadata.json');
      
      // Write invalid JSON to metadata file
      await fs.writeFile(metadataFile, '{ invalid json');
      
      // This should trigger the error handling in loadGraph but still return a valid graph
      const result = await storage.loadGraph();
      expect(result).not.toBeNull();
      // The graph should have default metadata due to error handling
      expect(result!.metadata.sessionCount).toBe(0);
    });

    it('should handle edge metadata parsing', async () => {
      // Save an edge with metadata
      const edge: Edge = {
        id: 'edge-with-meta',
        type: 'supports',
        from: 'n1',
        to: 'n2',
        strength: 0.9,
        metadata: {
          createdAt: new Date(),
          reason: 'test reason',
        },
      };

      await storage.saveEdge(edge);

      // Load and verify metadata is preserved
      const graph = await storage.loadGraph();
      expect(graph).not.toBeNull();
      const loadedEdge = graph!.edges.get('edge-with-meta');
      expect(loadedEdge?.metadata).toBeDefined();
      expect(loadedEdge?.metadata?.reason).toBe('test reason');
    });
  });

  describe('clearStorage', () => {
    it('should have clearStorage method', () => {
      expect(storage.clearStorage).toBeDefined();
      expect(typeof storage.clearStorage).toBe('function');
    });

    it('should be able to call clearStorage', async () => {
      // Just verify it doesn't throw
      await expect(storage.clearStorage()).resolves.not.toThrow();
    });
  });
});