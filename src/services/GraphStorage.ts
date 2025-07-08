import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { Node, Edge, DebugGraph } from '../types/graph.js';
import { 
  ensureDirectory, 
  writeJsonFile,
  appendJsonLine,
  readJsonLines,
  fileExists
} from '../utils/storage.js';
import { logger } from '../utils/logger.js';
import { DATA_DIR_NAME } from '../constants.js';

/**
 * グラフデータの永続化を担当するストレージクラス
 * JSONL形式でノードとエッジを追記保存し、メタデータはJSONで保存
 * データディレクトリ: ~/.debug-thinking-mcp/
 */
export class GraphStorage {
  private dataDir: string;
  private nodesFile: string;
  private edgesFile: string;
  private metadataFile: string;

  /**
   * ストレージパスを初期化
   * 環境変数DEBUG_DATA_DIRが設定されていればそれを使用
   * 指定がなければホームディレクトリ以下に保存
   */
  constructor() {
    const baseDir = process.env.DEBUG_DATA_DIR || os.homedir();
    this.dataDir = path.join(baseDir, DATA_DIR_NAME);
    this.nodesFile = path.join(this.dataDir, 'nodes.jsonl');
    this.edgesFile = path.join(this.dataDir, 'edges.jsonl');
    this.metadataFile = path.join(this.dataDir, 'graph-metadata.json');
  }

  /**
   * ストレージディレクトリを作成して初期化
   * ディレクトリが存在しない場合は再帰的に作成
   */
  async initialize(): Promise<void> {
    await ensureDirectory(this.dataDir);
    logger.dim(`📁 Graph storage initialized at: ${this.dataDir}`);
  }

  async saveNode(node: Node): Promise<void> {
    try {
      // DateオブジェクトをISO文字列に変換してJSONシリアライズ可能に
      const serializable = {
        ...node,
        metadata: {
          ...node.metadata,
          createdAt: node.metadata.createdAt.toISOString(),
          updatedAt: node.metadata.updatedAt.toISOString()
        }
      };
      await appendJsonLine(this.nodesFile, serializable);
    } catch (error) {
      logger.error('Failed to save node:', error);
      throw error;
    }
  }

  /**
   * エッジをJSONLファイルに追記保存
   * メタデータが存在する場合のみ日付を変換
   */
  async saveEdge(edge: Edge): Promise<void> {
    try {
      // メタデータが存在する場合のみ日付をISO文字列に変換
      const serializable = {
        ...edge,
        metadata: edge.metadata ? {
          ...edge.metadata,
          createdAt: edge.metadata.createdAt.toISOString()
        } : undefined
      };
      await appendJsonLine(this.edgesFile, serializable);
    } catch (error) {
      logger.error('Failed to save edge:', error);
      throw error;
    }
  }

  /**
   * グラフメタデータをJSONファイルに保存
   * ルートノードリストとノード/エッジ数も記録
   * 毎回上書き保存（追記ではない）
   */
  async saveGraphMetadata(graph: DebugGraph): Promise<void> {
    try {
      const metadata = {
        ...graph.metadata,
        createdAt: graph.metadata.createdAt.toISOString(),
        lastModified: graph.metadata.lastModified.toISOString(),
        roots: graph.roots,
        nodeCount: graph.nodes.size,
        edgeCount: graph.edges.size
      };
      await writeJsonFile(this.metadataFile, metadata);
    } catch (error) {
      logger.error('Failed to save graph metadata:', error);
      throw error;
    }
  }

  /**
   * 保存されたグラフデータを読み込み
   * JSONLファイルからノードとエッジを復元し、Map構造を再構築
   * 重複データは最新のものを保持
   * @returns 復元されたグラフまたはnull(データがない場合)
   */
  async loadGraph(): Promise<DebugGraph | null> {
    try {
      // 各ファイルの存在を確認（非同期で並列処理）
      const hasNodes = await fileExists(this.nodesFile);
      const hasEdges = await fileExists(this.edgesFile);
      const hasMetadata = await fileExists(this.metadataFile);

      if (!hasNodes && !hasEdges && !hasMetadata) {
        return null;
      }

      // メタデータファイルから基本情報を読み込み
      // ファイルがない/読み込み失敗時はデフォルト値を使用
      let metadata: any = {
        createdAt: new Date(),
        lastModified: new Date(),
        sessionCount: 0
      };
      let roots: string[] = [];

      if (hasMetadata) {
        try {
          const content = await fs.readFile(this.metadataFile, 'utf-8');
          const meta = JSON.parse(content);
          metadata = {
            ...meta,
            createdAt: new Date(meta.createdAt),
            lastModified: new Date(meta.lastModified)
          };
          // ルート問題ノードのIDリストを復元
          roots = meta.roots || [];
        } catch (error) {
          logger.error('Failed to load metadata:', error);
        }
      }

      // 空のグラフ構造を作成してデータをロード
      const graph: DebugGraph = {
        nodes: new Map(),
        edges: new Map(),
        roots,
        metadata
      };

      // JSONLファイルからすべてのノードを読み込み
      if (hasNodes) {
        const nodes = await readJsonLines<any>(this.nodesFile);
        // 同一IDのノードが複数ある場合は最後のものを使用(アップンド形式のため)
        const nodeMap = new Map<string, any>();
        for (const node of nodes) {
          nodeMap.set(node.id, node);
        }
        
        for (const node of nodeMap.values()) {
          graph.nodes.set(node.id, {
            ...node,
            metadata: {
              ...node.metadata,
              createdAt: new Date(node.metadata.createdAt),
              updatedAt: new Date(node.metadata.updatedAt)
            }
          });
        }
      }

      // JSONLファイルからすべてのエッジを読み込み
      if (hasEdges) {
        const edges = await readJsonLines<any>(this.edgesFile);
        // 同一IDのエッジが複数ある場合は最後のものを使用
        const edgeMap = new Map<string, any>();
        for (const edge of edges) {
          edgeMap.set(edge.id, edge);
        }
        
        for (const edge of edgeMap.values()) {
          graph.edges.set(edge.id, {
            ...edge,
            metadata: edge.metadata ? {
              ...edge.metadata,
              createdAt: new Date(edge.metadata.createdAt)
            } : undefined
          });
        }
      }

      return graph;
    } catch (error) {
      logger.error('Failed to load graph:', error);
      return null;
    }
  }

  /**
   * ストレージをクリア（テスト/リセット用）
   * TODO: 実装予定 - ファイル削除またはディレクトリクリア
   */
  async clearStorage(): Promise<void> {
    // TODO: 実装予定
  }
}