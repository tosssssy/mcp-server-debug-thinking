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
 * Claude Codeでの実用性を重視した最小限のセット
 */
export type QueryType = 
  | 'similar-problems'      // 類似問題検索: 過去の類似エラーとその解決策を取得
  | 'recent-activity';      // 最近の活動: 直近のデバッグノードを時系列で取得

/**
 * QUERYアクション: グラフデータの検索・分析
 * シンプルで実用的なパラメータのみ
 */
export interface QueryAction extends BaseAction {
  action: ActionType.QUERY;
  type: QueryType;
  parameters?: {
    pattern?: string;       // similar-problems用: 検索パターン
    limit?: number;         // 結果件数上限: デフォルト10件
    minSimilarity?: number; // similar-problems用: 最小類似度（0-1）
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
 * 類似問題とその解決策を包括的に返す
 */
export interface SimilarProblemsResult {
  problems: Array<{
    nodeId: string;
    content: string;
    similarity: number;  // 類似度スコア(0-1): 1に近いほど類似
    errorType?: string;  // エラータイプ（例：'type error'）
    status: 'open' | 'investigating' | 'solved' | 'abandoned';
    // 解決策の詳細情報
    solutions: Array<{
      nodeId: string;
      content: string;
      verified: boolean;
      // 解決までのデバッグパス（問題→仮説→実験→観察→解決）
      debugPath?: Array<{
        nodeId: string;
        type: NodeType;
        content: string;
      }>;
    }>;
  }>;
}

/**
 * recent-activityクエリの結果型
 * 最近のデバッグ活動を時系列で返す
 */
export interface RecentActivityResult {
  nodes: Array<{
    nodeId: string;
    type: NodeType;
    content: string;
    createdAt: string;  // ISO 8601形式
    // 親ノードがある場合はその情報
    parent?: {
      nodeId: string;
      type: NodeType;
      content: string;
    };
    // 接続されているエッジ
    edges: Array<{
      type: EdgeType;
      targetNodeId: string;
      direction: 'from' | 'to';
    }>;
  }>;
  totalNodes: number;  // グラフ内の総ノード数
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