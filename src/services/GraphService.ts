import { v4 as uuidv4 } from "uuid";
import type {
  Node,
  Edge,
  DebugGraph,
  EdgeType,
  NodeType,
  ProblemNode,
  HypothesisNode,
  LearningNode,
  SolutionNode,
} from "../types/graph.js";
import {
  type CreateAction,
  type ConnectAction,
  type QueryAction,
  type CreateResponse,
  type ConnectResponse,
  type QueryResponse,
  type SimilarProblemsResult,
  type RecentActivityResult,
  getAutoEdgeType,
} from "../types/graphActions.js";
import { logger } from "../utils/logger.js";
import { GraphStorage } from "./GraphStorage.js";
import { createJsonResponse } from "../utils/format.js";

export class GraphService {
  private graph: DebugGraph;
  private storage: GraphStorage;
  private errorTypeIndex: Map<string, Set<string>> = new Map();
  private readonly ERROR_TYPE_REGEX =
    /\b(type\s*error|reference\s*error|syntax\s*error|range\s*error|eval\s*error|uri\s*error|typeerror|referenceerror|syntaxerror|rangeerror|evalerror|urierror)\b/i;

  // パフォーマンス最適化用インデックス
  private nodesByType: Map<NodeType, Set<string>> = new Map();
  private edgesByNode: Map<string, { incoming: Edge[]; outgoing: Edge[] }> = new Map();
  private parentIndex: Map<string, string> = new Map(); // 子ID → 親ID

  constructor() {
    this.graph = {
      nodes: new Map(),
      edges: new Map(),
      roots: [],
      metadata: {
        createdAt: new Date(),
        lastModified: new Date(),
        sessionCount: 0,
      },
    };
    this.storage = new GraphStorage();
  }

  async initialize(): Promise<void> {
    try {
      await this.storage.initialize();
      const loadedGraph = await this.storage.loadGraph();
      if (loadedGraph) {
        this.graph = loadedGraph;
        logger.success(
          `Loaded graph with ${this.graph.nodes.size} nodes and ${this.graph.edges.size} edges`
        );

        // 高速検索のためのインデックスを構築
        this.buildErrorTypeIndex();
        this.buildPerformanceIndexes();
      }
    } catch (error) {
      logger.error("Failed to initialize GraphService:", error);
      throw error;
    }
  }

  /**
   * CREATEアクション実装
   * 新しいノードを作成し、親ノードが指定されていれば自動的に適切なエッジを生成
   * 問題ノードの場合は類似問題も自動検索して返す
   */
  async create(action: CreateAction) {
    try {
      const nodeId = uuidv4();
      const now = new Date();

      // ベースノード構造を作成（全ノードタイプ共通の基本情報）
      const node: Node = {
        id: nodeId,
        type: action.nodeType,
        content: action.content,
        metadata: {
          createdAt: now,
          updatedAt: now,
          tags: action.metadata?.tags || [],
          ...action.metadata,
        },
      };

      // ノードタイプに応じた必須メタデータを自動設定
      // (例: 問題ノードにstatus、仮説ノードにconfidence等)
      this.enrichNodeMetadata(node);

      // ノードをグラフの内部Map構造に追加
      this.graph.nodes.set(nodeId, node);

      // パフォーマンスインデックスを更新
      this.updateIndexesForNewNode(node);

      // 親ノードとの関係を自動判定して適切なエッジを作成
      // (例: 問題→仮説なら'hypothesizes'エッジ)
      let edgeId: string | undefined;
      if (action.parentId) {
        const parentNode = this.graph.nodes.get(action.parentId);
        if (!parentNode) {
          return createJsonResponse(
            {
              success: false,
              message: `Parent node ${action.parentId} not found`,
            },
            true
          );
        }

        // 親ノードタイプと子ノードタイプから適切なエッジタイプを自動判定
        const edgeType = getAutoEdgeType(parentNode.type, action.nodeType);
        if (edgeType) {
          const edge = this.createEdge(action.parentId, nodeId, edgeType);
          this.graph.edges.set(edge.id, edge);
          edgeId = edge.id;

          // パフォーマンスインデックスを更新
          this.updateIndexesForNewEdge(edge);
        }
      } else if (action.nodeType === "problem") {
        // 親が指定されていない問題ノードはルート問題として登録
        this.graph.roots.push(nodeId);
        (node as ProblemNode).metadata.isRoot = true;
      }

      // グラフ全体の最終更新日時を記録
      this.graph.metadata.lastModified = now;

      // ノードとエッジを永続化ストレージに保存
      await this.storage.saveNode(node);
      if (edgeId) {
        await this.storage.saveEdge(this.graph.edges.get(edgeId)!);
      }

      // グラフメタデータも更新して保存
      await this.storage.saveGraphMetadata(this.graph);

      // 問題ノードの場合、エラータイプ別インデックスを更新
      // (例: 'TypeError'などを抽出して分類)
      if (action.nodeType === "problem") {
        const errorType = this.extractErrorType(action.content) || "other";
        if (!this.errorTypeIndex.has(errorType)) {
          this.errorTypeIndex.set(errorType, new Set());
        }
        this.errorTypeIndex.get(errorType)!.add(nodeId);
        logger.debug(`Added node ${nodeId} to error type index: ${errorType}`);
      }

      // ノードタイプに応じた次のアクション提案を生成
      const suggestions = await this.generateSuggestions(node);

      // 問題ノードの場合、過去の類似問題とその解決策を自動検索
      let similarProblems: CreateResponse["similarProblems"];
      if (action.nodeType === "problem") {
        const similarResult = await this.findSimilarProblems({
          pattern: action.content,
          limit: 5,
          minSimilarity: 0.2,
        });

        // 類似問題が見つかった場合のみレスポンスに含める
        if (similarResult.problems.length > 0) {
          similarProblems = similarResult.problems.map((p) => ({
            nodeId: p.nodeId,
            content: p.content,
            similarity: p.similarity,
            status: p.status,
            solutions: p.solutions || [],
          }));
        }
      }

      const response: CreateResponse = {
        success: true,
        nodeId,
        edgeId,
        message: `Created ${action.nodeType} node`,
        suggestions,
        similarProblems,
      };
      return createJsonResponse(response);
    } catch (error) {
      logger.error("Error in create action:", error);
      return createJsonResponse(
        {
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        },
        true
      );
    }
  }

  /**
   * CONNECTアクション実装
   * 既存の2つのノード間に明示的な関係（エッジ）を作成
   * 矛盾する関係（supports vs contradicts等）を自動検出
   */
  async connect(action: ConnectAction) {
    try {
      const fromNode = this.graph.nodes.get(action.from);
      const toNode = this.graph.nodes.get(action.to);

      if (!fromNode || !toNode) {
        return createJsonResponse(
          {
            success: false,
            message: `Node(s) not found: ${!fromNode ? action.from : ""} ${!toNode ? action.to : ""}`,
          },
          true
        );
      }

      // 既存の関係と矛盾するエッジがないかチェック
      // (例: 同じノード間に'supports'と'contradicts'が共存しないように)
      const conflicts = this.checkForConflicts(action);

      // 指定されたパラメータでエッジを作成
      // strengthは0-1の範囲で関係の強さを表現
      const edge = this.createEdge(
        action.from,
        action.to,
        action.type,
        action.strength,
        action.metadata
      );

      this.graph.edges.set(edge.id, edge);

      // パフォーマンスインデックスを更新
      this.updateIndexesForNewEdge(edge);

      // グラフ全体の最終更新日時を記録
      this.graph.metadata.lastModified = new Date();

      // ノードとエッジを永続化ストレージに保存
      await this.storage.saveEdge(edge);

      // グラフメタデータも更新して保存
      await this.storage.saveGraphMetadata(this.graph);

      const response: ConnectResponse = {
        success: true,
        edgeId: edge.id,
        message: `Connected ${fromNode.type} to ${toNode.type} with ${action.type}`,
        conflicts:
          conflicts.length > 0
            ? {
                conflictingEdges: conflicts.map((e) => e.id),
                explanation: "This connection may contradict existing relationships",
              }
            : undefined,
      };
      return createJsonResponse(response);
    } catch (error) {
      logger.error("Error in connect action:", error);
      return createJsonResponse(
        {
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        },
        true
      );
    }
  }

  /**
   * QUERYアクション実装
   * グラフ内のデータを様々な方法で検索・分析
   * 実行時間を計測してパフォーマンス情報も返す
   */
  async query(action: QueryAction) {
    const startTime = Date.now();

    try {
      let results: any;

      switch (action.type) {
        case "similar-problems":
          results = await this.findSimilarProblems(action.parameters);
          break;
        case "recent-activity":
          results = await this.getRecentActivity(action.parameters);
          break;
        default:
          return createJsonResponse(
            {
              success: false,
              message: `Unknown query type: ${action.type}`,
            },
            true
          );
      }

      const response: QueryResponse = {
        success: true,
        results,
        queryTime: Date.now() - startTime,
      };
      return createJsonResponse(response);
    } catch (error) {
      logger.error("Error in query action:", error);
      return createJsonResponse(
        {
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
          queryTime: Date.now() - startTime,
        },
        true
      );
    }
  }

  /**
   * ヘルパーメソッド
   * 内部処理用のユーティリティ関数群
   */
  /**
   * ノードタイプに応じたデフォルトメタデータを自動設定
   * - 問題ノード: status='open', isRoot=false
   * - 仮説ノード: confidence=50(未設定時), testable=true
   * - 学習ノード: confidence=70(未設定時)
   */
  private enrichNodeMetadata(node: Node): void {
    switch (node.type) {
      case "problem":
        if (!(node as ProblemNode).metadata.status) {
          (node as ProblemNode).metadata.status = "open";
        }
        (node as ProblemNode).metadata.isRoot = false;
        break;
      case "hypothesis":
        if (!node.metadata.confidence) {
          (node as HypothesisNode).metadata.confidence = 50;
        }
        (node as HypothesisNode).metadata.testable = true;
        break;
      case "learning":
        if (!node.metadata.confidence) {
          (node as LearningNode).metadata.confidence = 70;
        }
        break;
    }
  }

  /**
   * エッジオブジェクトを作成
   * strengthを自動的に0-1の範囲に正規化
   * ユニークIDとタイムスタンプを自動付与
   */
  private createEdge(
    from: string,
    to: string,
    type: EdgeType,
    strength: number = 1,
    metadata?: any
  ): Edge {
    return {
      id: uuidv4(),
      type,
      from,
      to,
      strength: Math.max(0, Math.min(1, strength)),
      metadata: {
        createdAt: new Date(),
        ...metadata,
      },
    };
  }

  /**
   * 関係の矛盾をチェック
   * 'supports'と'contradicts'のような相反する関係が
   * 同じノード間に存在しないよう検証
   * @returns 矛盾するエッジの配列
   */
  private checkForConflicts(action: ConnectAction): Edge[] {
    const conflicts: Edge[] = [];

    // 'contradicts'エッジを作成しようとした場合、
    // 同じノード間に既存の'supports'エッジがないか確認
    if (action.type === "contradicts") {
      // 同一方向の'supports'関係を検索
      for (const edge of this.graph.edges.values()) {
        if (edge.type === "supports" && edge.from === action.from && edge.to === action.to) {
          conflicts.push(edge);
        }
      }
    } else if (action.type === "supports") {
      // 同一方向の'contradicts'関係を検索
      for (const edge of this.graph.edges.values()) {
        if (edge.type === "contradicts" && edge.from === action.from && edge.to === action.to) {
          conflicts.push(edge);
        }
      }
    }

    return conflicts;
  }

  /**
   * ノードタイプに応じた次のアクション提案を生成
   * - 問題ノード: 関連する問題のIDリスト
   * - 仮説ノード: 推奨される実験方法
   */
  private async generateSuggestions(node: Node): Promise<any> {
    const suggestions: any = {};

    if (node.type === "problem") {
      // 関連する問題を最大3件まで検索
      const similar = await this.findSimilarProblems({
        pattern: node.content,
        limit: 3,
      });
      if (similar.problems.length > 0) {
        suggestions.relatedProblems = similar.problems.map((p) => p.nodeId);
      }
    } else if (node.type === "hypothesis") {
      // 仮説を検証するための標準的な実験手法を提案
      suggestions.recommendedExperiments = [
        "Test the hypothesis in isolation",
        "Create a minimal reproducible example",
        "Check assumptions with logging",
      ];
    }

    return suggestions;
  }

  /**
   * クエリ実装メソッド群
   * 様々な検索・分析機能の実装
   */
  /**
   * 類似問題検索
   * エラータイプ別インデックスを活用して高速に類似問題を検索
   * 類似度計算はエラータイプ、キーフレーズ、単語ベースで実施
   * 解決済み問題を優先的に返す
   */
  private async findSimilarProblems(params: any): Promise<SimilarProblemsResult> {
    const problems: any[] = [];
    const pattern = params?.pattern || "";
    const minSimilarity = params?.minSimilarity || 0.2;
    const errorType = this.extractErrorType(pattern);

    // エラータイプ別インデックスを使用して検索対象を効率的に絞り込む
    let candidateNodeIds: Set<string>;

    if (errorType && this.errorTypeIndex.has(errorType)) {
      // 同一エラータイプの問題ノードのみを検索対象に
      candidateNodeIds = this.errorTypeIndex.get(errorType)!;
      logger.debug(`Searching ${candidateNodeIds.size} nodes with error type: ${errorType}`);
    } else if (!errorType && this.errorTypeIndex.has("other")) {
      // エラータイプが抽出できない場合は 'other' カテゴリを検索
      candidateNodeIds = this.errorTypeIndex.get("other")!;
      logger.debug(`Searching ${candidateNodeIds.size} nodes without specific error type`);
    } else {
      // インデックスが未構築の場合は全問題ノードを総当たり（フォールバック）
      candidateNodeIds = new Set();
      for (const [nodeId, node] of this.graph.nodes) {
        if (node.type === "problem") {
          candidateNodeIds.add(nodeId);
        }
      }
      logger.debug(`Fallback: searching all ${candidateNodeIds.size} problem nodes`);
    }

    // 絞り込まれた候補に対して類似度計算を実施
    for (const nodeId of candidateNodeIds) {
      const node = this.graph.nodes.get(nodeId);
      if (!node || node.type !== "problem") continue;

      const similarity = this.calculateSimilarity(pattern, node.content);

      // 最小類似度以上の問題のみを結果に含める
      if (similarity >= minSimilarity) {
        const solutions = this.findSolutionsForProblem(node.id);
        const nodeErrorType = this.extractErrorType(node.content);

        problems.push({
          nodeId: node.id,
          content: node.content,
          similarity,
          errorType: nodeErrorType,
          status: (node as ProblemNode).metadata.status || "open",
          solutions,
        });
      }
    }

    // 結果をソート: 1.解決済み問題を優先 2.類似度の高い順
    problems.sort((a, b) => {
      // 解決済み(solved)の問題を優先表示
      if (a.status === "solved" && b.status !== "solved") return -1;
      if (b.status === "solved" && a.status !== "solved") return 1;

      // ステータスが同じ場合は類似度の降順でソート
      return b.similarity - a.similarity;
    });

    return {
      problems: problems.slice(0, params?.limit || 10),
    };
  }

  /**
   * 特定の問題に対する解決策を検索
   * 'solves'エッジを追跡して関連する解決策ノードを収集
   * デバッグパス（問題→仮説→実験→観察→解決）も含める
   * @param problemId 問題ノードのID
   * @returns 解決策情報の配列(検証済みフラグとデバッグパス付き)
   */
  private findSolutionsForProblem(problemId: string): any[] {
    const solutions: any[] = [];

    for (const edge of this.graph.edges.values()) {
      if (edge.type === "solves" && edge.to === problemId) {
        const solutionNode = this.graph.nodes.get(edge.from);
        if (solutionNode && solutionNode.type === "solution") {
          // 解決策から問題までのデバッグパスを構築
          const debugPath = this.buildDebugPath(problemId, solutionNode.id);

          solutions.push({
            nodeId: solutionNode.id,
            content: solutionNode.content,
            verified: (solutionNode as SolutionNode).metadata.verified,
            debugPath: debugPath.map((node) => ({
              nodeId: node.id,
              type: node.type,
              content: node.content,
            })),
          });
        }
      }
    }

    return solutions;
  }

  /**
   * 問題から解決策までのデバッグパスを構築
   * 親子関係を辿って経路を復元
   */
  private buildDebugPath(problemId: string, solutionId: string): Node[] {
    const path: Node[] = [];
    const solutionNode = this.graph.nodes.get(solutionId);

    if (!solutionNode) return [];

    // 解決策ノードから親を辿る
    let currentNode: Node | undefined = solutionNode;
    const visited = new Set<string>();

    while (currentNode && !visited.has(currentNode.id)) {
      path.unshift(currentNode);
      visited.add(currentNode.id);

      if (currentNode.id === problemId) {
        break;
      }

      // 親ノードをインデックスから効率的に取得
      const parentId = this.parentIndex.get(currentNode.id);
      if (parentId) {
        currentNode = this.graph.nodes.get(parentId);
      } else {
        // 親子関係インデックスにない場合は受信エッジから親を探す
        const nodeEdges = this.edgesByNode.get(currentNode.id);
        if (nodeEdges && nodeEdges.incoming.length > 0) {
          const parentEdge = nodeEdges.incoming[0];
          currentNode = this.graph.nodes.get(parentEdge.from);
        } else {
          currentNode = undefined;
        }
      }
    }

    // 問題ノードがパスに含まれていない場合は追加
    const problemNode = this.graph.nodes.get(problemId);
    if (problemNode && path.length > 0 && path[0].id !== problemId) {
      path.unshift(problemNode);
    }

    return path;
  }

  /**
   * エラーメッセージからエラータイプを抽出
   * 正規表現で'TypeError', 'ReferenceError'等を検出
   * @returns エラータイプ名(小文字、スペース区切り)またはnull
   */
  private extractErrorType(content: string): string | null {
    const match = content.toLowerCase().match(this.ERROR_TYPE_REGEX);
    if (!match) return null;

    // "typeerror" -> "type error", "referenceerror" -> "reference error" に正規化
    const errorType = match[0].toLowerCase();
    if (errorType.includes(" ")) {
      return errorType; // すでにスペースがある場合はそのまま
    }

    // スペースなしのエラータイプを分割
    const normalized = errorType.replace(/(type|reference|syntax|range|eval|uri)error/, "$1 error");
    return normalized;
  }

  /**
   * 2つの問題テキストの類似度を計算(0-1の範囲)
   * 計算要素:
   * - エラータイプの類似度: 20%
   * - 部分文字列マッチング: 20%
   * - 編集距離による類似度: 15%
   * - キーフレーズの部分一致: 15%
   * - 単語ベースの類似度: 20%
   * - 重要な識別子の一致: 10%
   */
  private calculateSimilarity(pattern: string, content: string): number {
    const p1 = pattern.toLowerCase();
    const p2 = content.toLowerCase();

    // 両方のテキストからエラータイプを抽出して比較準備
    const errorType1 = this.extractErrorType(pattern);
    const errorType2 = this.extractErrorType(content);

    let score = 0;

    // スコア計算: エラータイプの類似度(20%の重み)
    if (errorType1 && errorType2) {
      if (errorType1 === errorType2) {
        score += 0.2;
      } else {
        // 関連するエラータイプのグループ化
        const errorGroups = [
          ["typeerror", "type error", "type mismatch"],
          ["referenceerror", "reference error", "not defined"],
          ["syntaxerror", "syntax error", "invalid syntax"],
          ["rangeerror", "range error", "out of range"],
        ];

        let groupMatch = false;
        for (const group of errorGroups) {
          if (group.includes(errorType1) && group.includes(errorType2)) {
            groupMatch = true;
            break;
          }
        }
        score += groupMatch ? 0.12 : 0.04;
      }
    } else if (errorType1 || errorType2) {
      // 片方だけエラータイプがある場合も部分点
      score += 0.04;
    }

    // スコア計算: 部分文字列マッチング(20%の重み)
    const longestCommonSubstring = this.findLongestCommonSubstring(p1, p2);
    const avgLength = (p1.length + p2.length) / 2;
    if (longestCommonSubstring.length > 5) {
      // 5文字以上の共通部分文字列
      score += Math.min(0.2, (longestCommonSubstring.length / avgLength) * 0.4);
    }

    // スコア計算: 編集距離による類似度(15%の重み)
    // 短い文字列の場合は文字レベル、長い文字列の場合は単語レベルで計算
    if (p1.length < 50 && p2.length < 50) {
      const charSimilarity = this.calculateLevenshteinSimilarity(p1, p2);
      score += charSimilarity * 0.15;
    } else {
      const wordSimilarity = this.calculateWordLevelSimilarity(pattern, content);
      score += wordSimilarity * 0.15;
    }

    // 高頻度エラーフレーズのパターン定義（部分一致も評価）
    const keyPhrases = [
      /cannot\s+read\s+property/i,
      /cannot\s+access/i,
      /is\s+not\s+defined/i,
      /is\s+not\s+a\s+function/i,
      /undefined\s+or\s+null/i,
      /maximum\s+call\s+stack/i,
      /out\s+of\s+memory/i,
      /permission\s+denied/i,
      /failed\s+to/i,
      /unable\s+to/i,
      /expected.*but.*got/i,
      /missing\s+required/i,
    ];

    // スコア計算: キーフレーズのファジーマッチング(15%の重み)
    let phraseScore = 0;
    for (const phrase of keyPhrases) {
      const match1 = phrase.test(p1);
      phrase.lastIndex = 0;
      const match2 = phrase.test(p2);
      phrase.lastIndex = 0;

      if (match1 && match2) {
        phraseScore += 1.0;
      } else if (match1 || match2) {
        // 片方だけマッチした場合、もう片方に類似表現があるかチェック
        const phraseStr = phrase.source.replace(/\\s\+/g, " ");
        const keywords = phraseStr.split(/\s+/).filter((k) => k.length > 3 && !k.includes("\\"));
        let partialMatch = 0;
        for (const keyword of keywords) {
          if (p1.includes(keyword) && p2.includes(keyword)) {
            partialMatch++;
          }
        }
        if (keywords.length > 0) {
          phraseScore += (partialMatch / keywords.length) * 0.5;
        }
      }
    }
    if (keyPhrases.length > 0) {
      score += (phraseScore / keyPhrases.length) * 0.15;
    }

    // スコア計算: 単語ベースの類似度(20%の重み)
    // トークン化を改善: 記号で分割、3文字以上の意味のある単語を抽出
    const tokenize = (text: string) => {
      return text
        .split(/[\s\-_./\\:;,()[\]{}<>'"]+/)
        .filter((w) => w.length >= 3 && !/^\d+$/.test(w)); // 数字のみは除外
    };

    const words1 = tokenize(p1);
    const words2 = tokenize(p2);

    if (words1.length > 0 && words2.length > 0) {
      const commonWords = new Set<string>();
      const partialMatches = new Set<string>();

      for (const w1 of words1) {
        for (const w2 of words2) {
          if (w1 === w2) {
            commonWords.add(w1);
          } else if (w1.includes(w2) || w2.includes(w1)) {
            partialMatches.add(w1.length < w2.length ? w1 : w2);
          }
        }
      }

      const exactMatchScore = commonWords.size / Math.max(words1.length, words2.length);
      const partialMatchScore = partialMatches.size / Math.max(words1.length, words2.length);
      score += exactMatchScore * 0.15 + partialMatchScore * 0.05;
    }

    // スコア計算: 重要な識別子の一致(10%の重み)
    // ファイル名、関数名、変数名などを抽出
    const identifierPattern = /['"`]([^'"`]+)['"`]|(\w+)\(/g;
    const extractIdentifiers = (text: string) => {
      const identifiers = new Set<string>();
      let match;
      while ((match = identifierPattern.exec(text)) !== null) {
        identifiers.add((match[1] || match[2]).toLowerCase());
      }
      identifierPattern.lastIndex = 0;
      return identifiers;
    };

    const ids1 = extractIdentifiers(pattern);
    const ids2 = extractIdentifiers(content);

    if (ids1.size > 0 && ids2.size > 0) {
      const commonIds = new Set([...ids1].filter((id) => ids2.has(id)));
      score += (commonIds.size / Math.max(ids1.size, ids2.size)) * 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * 最長共通部分文字列を見つける
   * 動的計画法を使用して効率的に計算
   */
  private findLongestCommonSubstring(s1: string, s2: string): string {
    if (!s1 || !s2) return "";

    const m = s1.length;
    const n = s2.length;
    let maxLength = 0;
    let endPos = 0;

    // DPテーブル（メモリ効率のため1次元配列を使用）
    let prev = new Array(n + 1).fill(0);
    let curr = new Array(n + 1).fill(0);

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          curr[j] = prev[j - 1] + 1;
          if (curr[j] > maxLength) {
            maxLength = curr[j];
            endPos = i;
          }
        } else {
          curr[j] = 0;
        }
      }
      // 配列をスワップ
      [prev, curr] = [curr, prev];
      curr.fill(0);
    }

    return maxLength > 0 ? s1.substring(endPos - maxLength, endPos) : "";
  }

  /**
   * レーベンシュタイン距離（編集距離）を計算
   * 一方の文字列を他方に変換するために必要な最小の編集操作数
   * @returns 正規化された類似度スコア (0-1の範囲、1が完全一致)
   */
  private calculateLevenshteinSimilarity(s1: string, s2: string): number {
    if (!s1 && !s2) return 1;
    if (!s1 || !s2) return 0;

    const m = s1.length;
    const n = s2.length;

    // 空間効率のため、2行のみを使用
    let prev = new Array(n + 1);
    let curr = new Array(n + 1);

    // 初期化
    for (let j = 0; j <= n; j++) {
      prev[j] = j;
    }

    for (let i = 1; i <= m; i++) {
      curr[0] = i;

      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1, // 削除
          curr[j - 1] + 1, // 挿入
          prev[j - 1] + cost // 置換
        );
      }

      // 配列をスワップ
      [prev, curr] = [curr, prev];
    }

    const distance = prev[n];
    const maxLength = Math.max(m, n);

    // 距離を類似度に変換 (0-1の範囲)
    return maxLength > 0 ? 1 - distance / maxLength : 0;
  }

  /**
   * 単語レベルでのレーベンシュタイン距離を計算
   * エラーメッセージの構造的な類似性を評価
   */
  private calculateWordLevelSimilarity(s1: string, s2: string): number {
    const words1 = s1
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    const words2 = s2
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    if (words1.length === 0 && words2.length === 0) return 1;
    if (words1.length === 0 || words2.length === 0) return 0;

    const m = words1.length;
    const n = words2.length;
    const dp = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    // 初期化
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // 単語レベルでの編集距離を計算
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (words1[i - 1] === words2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          // 部分的な類似性も考慮
          const similarity = this.calculateLevenshteinSimilarity(words1[i - 1], words2[j - 1]);
          const cost = similarity > 0.7 ? 0.3 : 1; // 70%以上類似していれば低コスト

          dp[i][j] = Math.min(
            dp[i - 1][j] + 1, // 削除
            dp[i][j - 1] + 1, // 挿入
            dp[i - 1][j - 1] + cost // 置換
          );
        }
      }
    }

    const distance = dp[m][n];
    const maxLength = Math.max(m, n);

    return maxLength > 0 ? 1 - distance / maxLength : 0;
  }

  /**
   * セッション管理用パブリックメソッド
   */
  /**
   * グラフメタデータをストレージに保存
   * シャットダウン時などに呼び出される
   */
  async saveGraph(): Promise<void> {
    await this.storage.saveGraphMetadata(this.graph);
  }

  /**
   * 最近のアクティビティを取得
   * ノードを作成時刻の降順でソートして返す
   */
  private async getRecentActivity(params: any): Promise<RecentActivityResult> {
    const limit = params?.limit;

    // limit が undefined の場合はデフォルト値を使用
    const effectiveLimit = limit === undefined ? 10 : limit;

    // limit が 0 の場合は空の結果を返す
    if (effectiveLimit === 0) {
      return {
        nodes: [],
        totalNodes: this.graph.nodes.size,
      };
    }

    // すべてのノードを配列に変換して時刻でソート
    const sortedNodes = Array.from(this.graph.nodes.values())
      .sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime())
      .slice(0, effectiveLimit);

    const result: RecentActivityResult = {
      nodes: sortedNodes.map((node) => {
        // インデックスを使ってこのノードに関連するエッジを効率的に取得
        const nodeEdges = this.edgesByNode.get(node.id) || { incoming: [], outgoing: [] };
        const edges: Array<{ type: EdgeType; targetNodeId: string; direction: "from" | "to" }> = [];

        // 送信エッジ
        for (const edge of nodeEdges.outgoing) {
          edges.push({
            type: edge.type,
            targetNodeId: edge.to,
            direction: "from",
          });
        }

        // 受信エッジ
        for (const edge of nodeEdges.incoming) {
          edges.push({
            type: edge.type,
            targetNodeId: edge.from,
            direction: "to",
          });
        }

        // 親ノードをインデックスから取得
        let parent: any;
        const parentId = this.parentIndex.get(node.id);
        if (parentId) {
          const parentNode = this.graph.nodes.get(parentId);
          if (parentNode) {
            parent = {
              nodeId: parentNode.id,
              type: parentNode.type,
              content: parentNode.content,
            };
          }
        }

        return {
          nodeId: node.id,
          type: node.type,
          content: node.content,
          createdAt: node.metadata.createdAt.toISOString(),
          parent,
          edges,
        };
      }),
      totalNodes: this.graph.nodes.size,
    };

    return result;
  }

  /**
   * エラータイプ別インデックスの構築
   * すべての問題ノードをスキャンしてエラータイプ別に分類
   * エラータイプが不明な場合は'other'カテゴリに分類
   */
  private buildErrorTypeIndex(): void {
    this.errorTypeIndex.clear();

    for (const [nodeId, node] of this.graph.nodes) {
      if (node.type === "problem") {
        const errorType = this.extractErrorType(node.content);

        if (errorType) {
          if (!this.errorTypeIndex.has(errorType)) {
            this.errorTypeIndex.set(errorType, new Set());
          }
          this.errorTypeIndex.get(errorType)!.add(nodeId);
        } else {
          // エラータイプが不明な場合は "other" に分類
          if (!this.errorTypeIndex.has("other")) {
            this.errorTypeIndex.set("other", new Set());
          }
          this.errorTypeIndex.get("other")!.add(nodeId);
        }
      }
    }

    logger.info(
      `Error type index built: ${this.errorTypeIndex.size} types, ${this.graph.nodes.size} total nodes`
    );
  }

  /**
   * パフォーマンス最適化用インデックスを構築
   * ノードタイプ別、エッジ関係、親子関係のインデックスを作成
   */
  private buildPerformanceIndexes(): void {
    // インデックスをクリア
    this.nodesByType.clear();
    this.edgesByNode.clear();
    this.parentIndex.clear();

    // ノードタイプ別インデックスを構築
    for (const [nodeId, node] of this.graph.nodes) {
      if (!this.nodesByType.has(node.type)) {
        this.nodesByType.set(node.type, new Set());
      }
      this.nodesByType.get(node.type)!.add(nodeId);
    }

    // エッジ関係インデックスを構築
    for (const [nodeId] of this.graph.nodes) {
      this.edgesByNode.set(nodeId, { incoming: [], outgoing: [] });
    }

    for (const edge of this.graph.edges.values()) {
      // 送信元ノードの送信エッジ
      const fromEdges = this.edgesByNode.get(edge.from);
      if (fromEdges) {
        fromEdges.outgoing.push(edge);
      }

      // 宛先ノードの受信エッジ
      const toEdges = this.edgesByNode.get(edge.to);
      if (toEdges) {
        toEdges.incoming.push(edge);
      }

      // 親子関係インデックス（自動作成されたエッジから親子関係を抽出）
      const parentChildTypes = ["decomposes", "hypothesizes", "tests", "produces", "learns"];
      if (parentChildTypes.includes(edge.type)) {
        this.parentIndex.set(edge.to, edge.from);
      }
    }

    logger.info(
      `Performance indexes built: ${this.nodesByType.size} node types, ${this.edgesByNode.size} nodes indexed`
    );
  }

  /**
   * ノードが追加された時のインデックス更新
   */
  private updateIndexesForNewNode(node: Node): void {
    // ノードタイプ別インデックスを更新
    if (!this.nodesByType.has(node.type)) {
      this.nodesByType.set(node.type, new Set());
    }
    this.nodesByType.get(node.type)!.add(node.id);

    // エッジ関係インデックスを初期化
    this.edgesByNode.set(node.id, { incoming: [], outgoing: [] });
  }

  /**
   * エッジが追加された時のインデックス更新
   */
  private updateIndexesForNewEdge(edge: Edge): void {
    // エッジ関係インデックスを更新
    const fromEdges = this.edgesByNode.get(edge.from);
    if (fromEdges) {
      fromEdges.outgoing.push(edge);
    }

    const toEdges = this.edgesByNode.get(edge.to);
    if (toEdges) {
      toEdges.incoming.push(edge);
    }

    // 親子関係インデックスを更新
    const parentChildTypes = ["decomposes", "hypothesizes", "tests", "produces", "learns"];
    if (parentChildTypes.includes(edge.type)) {
      this.parentIndex.set(edge.to, edge.from);
    }
  }

  getGraph(): DebugGraph {
    return this.graph;
  }
}
