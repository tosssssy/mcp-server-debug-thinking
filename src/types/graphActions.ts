import { NodeType, EdgeType } from './graph.js';

/**
 * グラフ操作用アクションタイプ
 * MCPツールが受け付ける3つの基本操作
 */
export enum ActionType {
  CREATE = 'create',
  CONNECT = 'connect',
  QUERY = 'query'
}

/**
 * ベースアクションインターフェース
 * すべてのアクションが共通で持つactionフィールド
 */
interface BaseAction {
  action: ActionType;
}

/**
 * CREATEアクション: 新規ノードの作成
 * parentIdを指定すると適切なエッジを自動生成
 */
export interface CreateAction extends BaseAction {
  action: ActionType.CREATE;
  nodeType: NodeType;
  content: string;
  parentId?: string;  // 親ノードID: 指定時は親子関係のエッジを自動作成
  metadata?: {
    confidence?: number;
    tags?: string[];
    [key: string]: any;
  };
}

/**
 * CONNECTアクション: ノード間の明示的な関係作成
 * 既存ノード間に意味的なエッジを追加
 */
export interface ConnectAction extends BaseAction {
  action: ActionType.CONNECT;
  from: string;  // ソースノードID: 関係の出発点
  to: string;    // ターゲットノードID: 関係の到達点
  type: EdgeType;
  strength?: number;  // 関係の強度(0-1): 未指定時は1(最強)
  metadata?: {
    reasoning?: string;
    evidence?: string;
    [key: string]: any;
  };
}

/**
 * クエリタイプ: グラフに対する検索・分析操作
 * 各タイプは異なる分析目的に特化
 */
export type QueryType = 
  | 'similar-problems'      // 類似問題検索: エラータイプやキーワードの一致度で判定
  | 'successful-patterns'   // 成功パターン分析: 問題→解決の有効なルートを抽出
  | 'failed-hypotheses'     // 失敗仮説検索: 検証で否定された仮説を特定
  | 'learning-path'         // 学習パス追跡: 特定ノードからの知見獲得経路
  | 'solution-candidates'   // 解決策候補検索: 問題に対する既存解決策の適用可能性
  | 'graph-visualization'   // グラフ可視化: Mermaid/DOT形式での出力生成
  | 'node-details'         // ノード詳細: 特定ノードとその接続関係
  | 'related-nodes'        // 関連ノード検索: 直接接続されたノード群
  | 'pattern-match';       // パターンマッチ: 正規表現やタグでの柔軟な検索

/**
 * QUERYアクション: グラフデータの検索・分析
 * パラメータで細かい検索条件を指定可能
 */
export interface QueryAction extends BaseAction {
  action: ActionType.QUERY;
  type: QueryType;
  parameters?: {
    nodeId?: string;        // 基準ノードID: このノードを中心に検索
    pattern?: string;       // 検索パターン: テキストまたは正規表現
    nodeTypes?: NodeType[]; // ノードタイプフィルタ: 特定タイプのみ対象
    edgeTypes?: EdgeType[]; // エッジタイプフィルタ: 特定関係のみ対象
    confidence?: number;    // 最小信頼度: この値以上のノードのみ
    limit?: number;         // 結果件数上限: デフォルト10件
    depth?: number;         // 探索深度: 基準ノードから何ホップまで探索
    timeRange?: {
      start?: Date;
      end?: Date;
    };
    tags?: string[];        // タグフィルタ: 指定タグを持つノードのみ
  };
}

/**
 * GraphActionユニオン型
 * MCPツールが受け付けるすべてのアクションの統合型
 */
export type GraphAction = CreateAction | ConnectAction | QueryAction;

/**
 * アクション実行結果のレスポンス型定義
 */
/**
 * CREATEアクションのレスポンス
 * 作成されたノード情報と提案を含む
 */
export interface CreateResponse {
  success: boolean;
  nodeId?: string;
  edgeId?: string;  // 自動作成されたエッジのID(parentId指定時)
  message?: string;
  suggestions?: {
    relatedProblems?: string[];
    possibleHypotheses?: string[];
    recommendedExperiments?: string[];
  };
  // 問題ノード作成時に自動検索される類似問題情報
  similarProblems?: Array<{
    nodeId: string;
    content: string;
    similarity: number;
    status?: 'open' | 'investigating' | 'solved' | 'abandoned';
    solutions: Array<{
      nodeId: string;
      content: string;
      verified: boolean;
    }>;
  }>;
}

/**
 * CONNECTアクションのレスポンス
 * 矛盾検出機能付き
 */
export interface ConnectResponse {
  success: boolean;
  edgeId?: string;
  message?: string;
  conflicts?: {  // 矛盾検出: supportsとcontradictsが共存する場合等
    conflictingEdges: string[];
    explanation: string;
  };
}

/**
 * QUERYアクションの汎用レスポンス
 * 実際の結果型はクエリタイプに依存
 */
export interface QueryResponse {
  success: boolean;
  results?: any;  // 実際の型はクエリタイプごとの専用インターフェースを参照
  message?: string;
  queryTime?: number;  // クエリ実行時間(ミリ秒): パフォーマンス指標
}

/**
 * クエリタイプ別の詳細レスポンス型
 * QueryResponse.resultsの実際の型定義
 */
/**
 * similar-problemsクエリの結果型
 * 類似度と解決策情報を含む問題リスト
 */
export interface SimilarProblemsResult {
  problems: Array<{
    nodeId: string;
    content: string;
    similarity: number;  // 類似度スコア(0-1): 1に近いほど類似
    status?: 'open' | 'investigating' | 'solved' | 'abandoned';
    solutions?: Array<{
      nodeId: string;
      content: string;
      verified: boolean;
    }>;
  }>;
}

/**
 * successful-patternsクエリの結果型
 * 成功パターンの統計と具体例
 */
export interface SuccessfulPatternsResult {
  patterns: Array<{
    description: string;
    frequency: number;
    successRate: number;
    examplePaths: Array<{
      problem: string;
      hypothesis: string;
      experiment: string;
      solution: string;
    }>;
  }>;
}

/**
 * learning-pathクエリの結果型
 * ノード間の接続関係を含む経路情報
 */
export interface LearningPathResult {
  path: Array<{
    nodeId: string;
    type: NodeType;
    content: string;
    connections: Array<{
      type: EdgeType;
      to: string;
    }>;
  }>;
}

/**
 * graph-visualizationクエリの結果型
 * 様々な形式でのグラフ出力
 */
export interface GraphVisualizationResult {
  format: 'mermaid' | 'dot' | 'json';
  content: string;
  nodeCount: number;
  edgeCount: number;
}

/**
 * 親子関係から適切なエッジタイプを自動判定
 * CREATEアクションでparentId指定時に使用
 * @param parentType 親ノードのタイプ
 * @param childType 子ノードのタイプ
 * @returns 適切なエッジタイプまたはnull(マッピングなしの場合)
 */
export function getAutoEdgeType(parentType: NodeType, childType: NodeType): EdgeType | null {
  const mapping: Record<string, EdgeType> = {
    'problem-problem': 'decomposes',
    'problem-hypothesis': 'hypothesizes',
    'hypothesis-experiment': 'tests',
    'experiment-observation': 'produces',
    'observation-learning': 'learns',
    'solution-problem': 'solves',
  };
  
  return mapping[`${parentType}-${childType}`] || null;
}