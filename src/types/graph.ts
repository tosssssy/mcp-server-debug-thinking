/**
 * デバッグプロセスをグラフ構造で表現するための型定義
 * 問題解決の流れをノードとエッジでモデル化
 */

/**
 * ノードタイプ: デバッグプロセスの各段階を表現
 * - problem: デバッグ対象の問題/エラー
 * - hypothesis: 問題の原因に関する仮説
 * - experiment: 仮説を検証するための実験
 * - observation: 実験結果の観察
 * - learning: 観察から得た知見
 * - solution: 問題の解決策
 */
export type NodeType =
  | "problem"
  | "hypothesis"
  | "experiment"
  | "observation"
  | "learning"
  | "solution";

/**
 * エッジタイプ: ノード間の意味的な関係を定義
 * 各タイプはデバッグプロセスの自然な流れを表現
 */
export type EdgeType =
  | "decomposes" // 問題をより小さなサブ問題に分解
  | "hypothesizes" // 問題に対して仮説を立てる
  | "tests" // 仮説を検証する実験を実施
  | "produces" // 実験が観察結果を生成
  | "learns" // 観察結果から学習を得る
  | "contradicts" // 証拠が仮説を否定/矛盾
  | "supports" // 証拠が仮説を支持/裏付け
  | "solves"; // 解決策が問題を解決

/**
 * 基本ノードインターフェース
 * すべてのノードタイプが共通で持つプロパティ
 */
export interface Node {
  id: string;
  type: NodeType;
  content: string;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    confidence?: number; // 信頼度(0-100): 仮説や解決策の確実性
    status?: "open" | "investigating" | "solved" | "abandoned";
    tags: string[];
    // ノードタイプ固有の拡張フィールド用
    [key: string]: unknown;
  };
}

/**
 * エッジインターフェース
 * ノード間の方向性を持つ関係を表現
 */
export interface Edge {
  id: string;
  type: EdgeType;
  from: string; // 出発ノードのID
  to: string; // 到達ノードのID
  strength: number; // 関係の強度(0-1): 1に近いほど強い関係
  metadata?: {
    reasoning?: string;
    evidence?: string;
    createdAt: Date;
    [key: string]: unknown;
  };
}

/**
 * デバッググラフ全体の構造
 * ノードとエッジのMap、ルート問題、メタ情報を保持
 */
export interface DebugGraph {
  nodes: Map<string, Node>;
  edges: Map<string, Edge>;
  roots: string[]; // ルート問題ノードのIDリスト(親を持たない問題)
  metadata: {
    createdAt: Date;
    lastModified: Date;
    sessionCount: number;
  };
}

/**
 * ノードタイプ別の詳細インターフェース
 * 各ノードタイプが持つ固有のメタデータを型安全に定義
 */
/**
 * 問題ノード: デバッグ対象のエラーや不具合
 */
export interface ProblemNode extends Node {
  type: "problem";
  metadata: Node["metadata"] & {
    errorMessage?: string;
    context?: {
      language?: string;
      framework?: string;
      environment?: string;
    };
    isRoot: boolean;
  };
}

/**
 * 仮説ノード: 問題の原因に関する推測
 */
export interface HypothesisNode extends Node {
  type: "hypothesis";
  metadata: Node["metadata"] & {
    confidence: number; // 信頼度(必須): 仮説の確からしさ
    assumptions?: string[];
    testable: boolean;
  };
}

/**
 * 実験ノード: 仮説を検証するためのアクション
 */
export interface ExperimentNode extends Node {
  type: "experiment";
  metadata: Node["metadata"] & {
    code?: string;
    commands?: string[];
    expectedOutcome: string;
    environment?: Record<string, unknown>;
  };
}

/**
 * 観察ノード: 実験の結果として得られたデータ
 */
export interface ObservationNode extends Node {
  type: "observation";
  metadata: Node["metadata"] & {
    output?: string;
    metrics?: Record<string, unknown>;
    unexpected?: boolean;
  };
}

/**
 * 学習ノード: デバッグプロセスから得た知見や教訓
 */
export interface LearningNode extends Node {
  type: "learning";
  metadata: Node["metadata"] & {
    applicability: string; // 適用範囲: この学習が有効な状況や条件
    confidence: number;
    category?: "pattern" | "anti-pattern" | "best-practice" | "insight";
  };
}

/**
 * 解決策ノード: 問題を解決する具体的な方法
 */
export interface SolutionNode extends Node {
  type: "solution";
  metadata: Node["metadata"] & {
    implementation: string;
    verified: boolean;
    sideEffects?: string[];
    alternativeApproaches?: string[];
  };
}

/**
 * 型ガード関数群
 * ノードが特定の型であることを安全にチェック
 */
export function isProblemNode(node: Node): node is ProblemNode {
  return node.type === "problem";
}

export function isHypothesisNode(node: Node): node is HypothesisNode {
  return node.type === "hypothesis";
}

export function isExperimentNode(node: Node): node is ExperimentNode {
  return node.type === "experiment";
}

export function isObservationNode(node: Node): node is ObservationNode {
  return node.type === "observation";
}

export function isLearningNode(node: Node): node is LearningNode {
  return node.type === "learning";
}

export function isSolutionNode(node: Node): node is SolutionNode {
  return node.type === "solution";
}
