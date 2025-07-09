import { v4 as uuidv4 } from 'uuid';
import { 
  Node, 
  Edge, 
  DebugGraph, 
  EdgeType,
  NodeType,
  ProblemNode,
  HypothesisNode,
  LearningNode,
  SolutionNode
} from '../types/graph.js';
import {
  CreateAction,
  ConnectAction,
  QueryAction,
  CreateResponse,
  ConnectResponse,
  QueryResponse,
  SimilarProblemsResult,
  RecentActivityResult,
  getAutoEdgeType
} from '../types/graphActions.js';
import { logger } from '../utils/logger.js';
import { GraphStorage } from './GraphStorage.js';
import { createJsonResponse } from '../utils/format.js';

export class GraphService {
  private graph: DebugGraph;
  private storage: GraphStorage;
  private errorTypeIndex: Map<string, Set<string>> = new Map();
  private readonly ERROR_TYPE_REGEX = /\b(type|reference|syntax|range|eval|uri)\s*error\b/i;
  
  // パフォーマンス最適化用インデックス
  private nodesByType: Map<NodeType, Set<string>> = new Map();
  private edgesByNode: Map<string, { incoming: Edge[], outgoing: Edge[] }> = new Map();
  private parentIndex: Map<string, string> = new Map(); // 子ID → 親ID

  constructor() {
    this.graph = {
      nodes: new Map(),
      edges: new Map(),
      roots: [],
      metadata: {
        createdAt: new Date(),
        lastModified: new Date(),
        sessionCount: 0
      }
    };
    this.storage = new GraphStorage();
  }

  async initialize(): Promise<void> {
    try {
      await this.storage.initialize();
      const loadedGraph = await this.storage.loadGraph();
      if (loadedGraph) {
        this.graph = loadedGraph;
        logger.success(`Loaded graph with ${this.graph.nodes.size} nodes and ${this.graph.edges.size} edges`);
        
        // 高速検索のためのインデックスを構築
        this.buildErrorTypeIndex();
        this.buildPerformanceIndexes();
      }
    } catch (error) {
      logger.error('Failed to initialize GraphService:', error);
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
          ...action.metadata
        }
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
          return createJsonResponse({
            success: false,
            message: `Parent node ${action.parentId} not found`
          }, true);
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
      } else if (action.nodeType === 'problem') {
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
      if (action.nodeType === 'problem') {
        const errorType = this.extractErrorType(action.content) || 'other';
        if (!this.errorTypeIndex.has(errorType)) {
          this.errorTypeIndex.set(errorType, new Set());
        }
        this.errorTypeIndex.get(errorType)!.add(nodeId);
        logger.debug(`Added node ${nodeId} to error type index: ${errorType}`);
      }

      // ノードタイプに応じた次のアクション提案を生成
      const suggestions = await this.generateSuggestions(node);

      // 問題ノードの場合、過去の類似問題とその解決策を自動検索
      let similarProblems: CreateResponse['similarProblems'];
      if (action.nodeType === 'problem') {
        const similarResult = await this.findSimilarProblems({
          pattern: action.content,
          limit: 5,
          minSimilarity: 0.3
        });
        
        // 類似問題が見つかった場合のみレスポンスに含める
        if (similarResult.problems.length > 0) {
          similarProblems = similarResult.problems.map(p => ({
            nodeId: p.nodeId,
            content: p.content,
            similarity: p.similarity,
            status: p.status,
            solutions: p.solutions || []
          }));
        }
      }

      const response: CreateResponse = {
        success: true,
        nodeId,
        edgeId,
        message: `Created ${action.nodeType} node`,
        suggestions,
        similarProblems
      };
      return createJsonResponse(response);
    } catch (error) {
      logger.error('Error in create action:', error);
      return createJsonResponse({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      }, true);
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
        return createJsonResponse({
          success: false,
          message: `Node(s) not found: ${!fromNode ? action.from : ''} ${!toNode ? action.to : ''}`
        }, true);
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
        conflicts: conflicts.length > 0 ? {
          conflictingEdges: conflicts.map(e => e.id),
          explanation: 'This connection may contradict existing relationships'
        } : undefined
      };
      return createJsonResponse(response);
    } catch (error) {
      logger.error('Error in connect action:', error);
      return createJsonResponse({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      }, true);
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
        case 'similar-problems':
          results = await this.findSimilarProblems(action.parameters);
          break;
        case 'recent-activity':
          results = await this.getRecentActivity(action.parameters);
          break;
        default:
          return createJsonResponse({
            success: false,
            message: `Unknown query type: ${action.type}`
          }, true);
      }

      const response: QueryResponse = {
        success: true,
        results,
        queryTime: Date.now() - startTime
      };
      return createJsonResponse(response);
    } catch (error) {
      logger.error('Error in query action:', error);
      return createJsonResponse({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        queryTime: Date.now() - startTime
      }, true);
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
      case 'problem':
        (node as ProblemNode).metadata.status = 'open';
        (node as ProblemNode).metadata.isRoot = false;
        break;
      case 'hypothesis':
        if (!node.metadata.confidence) {
          (node as HypothesisNode).metadata.confidence = 50;
        }
        (node as HypothesisNode).metadata.testable = true;
        break;
      case 'learning':
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
        ...metadata
      }
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
    if (action.type === 'contradicts') {
      // 同一方向の'supports'関係を検索
      for (const edge of this.graph.edges.values()) {
        if (edge.type === 'supports' && 
            edge.from === action.from && 
            edge.to === action.to) {
          conflicts.push(edge);
        }
      }
    } else if (action.type === 'supports') {
      // 同一方向の'contradicts'関係を検索
      for (const edge of this.graph.edges.values()) {
        if (edge.type === 'contradicts' && 
            edge.from === action.from && 
            edge.to === action.to) {
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
    
    if (node.type === 'problem') {
      // 関連する問題を最大3件まで検索
      const similar = await this.findSimilarProblems({
        pattern: node.content,
        limit: 3
      });
      if (similar.problems.length > 0) {
        suggestions.relatedProblems = similar.problems.map(p => p.nodeId);
      }
    } else if (node.type === 'hypothesis') {
      // 仮説を検証するための標準的な実験手法を提案
      suggestions.recommendedExperiments = [
        'Test the hypothesis in isolation',
        'Create a minimal reproducible example',
        'Check assumptions with logging'
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
    const pattern = params?.pattern || '';
    const minSimilarity = params?.minSimilarity || 0.3;
    const errorType = this.extractErrorType(pattern);
    
    // エラータイプ別インデックスを使用して検索対象を効率的に絞り込む
    let candidateNodeIds: Set<string>;
    
    if (errorType && this.errorTypeIndex.has(errorType)) {
      // 同一エラータイプの問題ノードのみを検索対象に
      candidateNodeIds = this.errorTypeIndex.get(errorType)!;
      logger.debug(`Searching ${candidateNodeIds.size} nodes with error type: ${errorType}`);
    } else if (!errorType && this.errorTypeIndex.has('other')) {
      // エラータイプが抽出できない場合は 'other' カテゴリを検索
      candidateNodeIds = this.errorTypeIndex.get('other')!;
      logger.debug(`Searching ${candidateNodeIds.size} nodes without specific error type`);
    } else {
      // インデックスが未構築の場合は全問題ノードを総当たり（フォールバック）
      candidateNodeIds = new Set();
      for (const [nodeId, node] of this.graph.nodes) {
        if (node.type === 'problem') {
          candidateNodeIds.add(nodeId);
        }
      }
      logger.debug(`Fallback: searching all ${candidateNodeIds.size} problem nodes`);
    }
    
    // 絞り込まれた候補に対して類似度計算を実施
    for (const nodeId of candidateNodeIds) {
      const node = this.graph.nodes.get(nodeId);
      if (!node || node.type !== 'problem') continue;
      
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
          status: (node as ProblemNode).metadata.status || 'open',
          solutions
        });
      }
    }
    
    // 結果をソート: 1.解決済み問題を優先 2.類似度の高い順
    problems.sort((a, b) => {
      // 解決済み(solved)の問題を優先表示
      if (a.status === 'solved' && b.status !== 'solved') return -1;
      if (b.status === 'solved' && a.status !== 'solved') return 1;
      
      // ステータスが同じ場合は類似度の降順でソート
      return b.similarity - a.similarity;
    });
    
    return {
      problems: problems.slice(0, params?.limit || 10)
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
      if (edge.type === 'solves' && edge.to === problemId) {
        const solutionNode = this.graph.nodes.get(edge.from);
        if (solutionNode && solutionNode.type === 'solution') {
          // 解決策から問題までのデバッグパスを構築
          const debugPath = this.buildDebugPath(problemId, solutionNode.id);
          
          solutions.push({
            nodeId: solutionNode.id,
            content: solutionNode.content,
            verified: (solutionNode as SolutionNode).metadata.verified,
            debugPath: debugPath.map(node => ({
              nodeId: node.id,
              type: node.type,
              content: node.content
            }))
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
   * @returns エラータイプ名(小文字)またはnull
   */
  private extractErrorType(content: string): string | null {
    const match = content.toLowerCase().match(this.ERROR_TYPE_REGEX);
    return match ? match[0].toLowerCase() : null;
  }

  /**
   * 2つの問題テキストの類似度を計算(0-1の範囲)
   * 計算要素:
   * - エラータイプの一致: 40%
   * - 主要エラーフレーズの一致: 30%
   * - 単語ベースの一致: 30%
   */
  private calculateSimilarity(pattern: string, content: string): number {
    const p1 = pattern.toLowerCase();
    const p2 = content.toLowerCase();
    
    // 両方のテキストからエラータイプを抽出して比較準備
    const errorType1 = this.extractErrorType(pattern);
    const errorType2 = this.extractErrorType(content);
    
    let score = 0;
    
    // スコア計算: エラータイプの一致度(40%の重み)
    if (errorType1 && errorType2) {
      if (errorType1 === errorType2) {
        score += 0.4;
      } else {
        score += 0.1; // 異なるエラータイプでも部分点を付与
      }
    }
    
    // 高頻度エラーフレーズのパターン定義
    const keyPhrases = [
      /cannot\s+read\s+property/i,
      /cannot\s+access/i,
      /is\s+not\s+defined/i,
      /is\s+not\s+a\s+function/i,
      /undefined\s+or\s+null/i,
      /maximum\s+call\s+stack/i,
      /out\s+of\s+memory/i,
      /permission\s+denied/i
    ];
    
    // スコア計算: 主要フレーズの一致度(30%の重み)
    let phraseMatches = 0;
    for (const phrase of keyPhrases) {
      const match1 = phrase.test(p1);
      phrase.lastIndex = 0; // 正規表現のlastIndexをリセット(gフラグ対策)
      const match2 = phrase.test(p2);
      phrase.lastIndex = 0; // 正規表現のlastIndexをリセット(gフラグ対策)
      if (match1 && match2) {
        phraseMatches++;
      }
    }
    if (keyPhrases.length > 0) {
      score += (phraseMatches / keyPhrases.length) * 0.3;
    }
    
    // スコア計算: 共通単語の割合(30%の重み)
    // 2文字以下の単語はノイズとして除外
    const words1 = p1.split(/\s+/).filter(w => w.length > 2);
    const words2 = p2.split(/\s+/).filter(w => w.length > 2);
    const commonWords = words1.filter(w => words2.includes(w));
    if (words1.length > 0 && words2.length > 0) {
      score += (commonWords.length / Math.max(words1.length, words2.length)) * 0.3;
    }
    
    return Math.min(score, 1.0);
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
    const limit = params?.limit || 10;
    
    // すべてのノードを配列に変換して時刻でソート
    const sortedNodes = Array.from(this.graph.nodes.values())
      .sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime())
      .slice(0, limit);
    
    const result: RecentActivityResult = {
      nodes: sortedNodes.map(node => {
        // インデックスを使ってこのノードに関連するエッジを効率的に取得
        const nodeEdges = this.edgesByNode.get(node.id) || { incoming: [], outgoing: [] };
        const edges: Array<{type: EdgeType; targetNodeId: string; direction: 'from' | 'to'}> = [];
        
        // 送信エッジ
        for (const edge of nodeEdges.outgoing) {
          edges.push({
            type: edge.type,
            targetNodeId: edge.to,
            direction: 'from'
          });
        }
        
        // 受信エッジ
        for (const edge of nodeEdges.incoming) {
          edges.push({
            type: edge.type,
            targetNodeId: edge.from,
            direction: 'to'
          });
        }
        
        // 親ノードをインデックスから取得
        let parent: any = undefined;
        const parentId = this.parentIndex.get(node.id);
        if (parentId) {
          const parentNode = this.graph.nodes.get(parentId);
          if (parentNode) {
            parent = {
              nodeId: parentNode.id,
              type: parentNode.type,
              content: parentNode.content
            };
          }
        }
        
        return {
          nodeId: node.id,
          type: node.type,
          content: node.content,
          createdAt: node.metadata.createdAt.toISOString(),
          parent,
          edges
        };
      }),
      totalNodes: this.graph.nodes.size
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
      if (node.type === 'problem') {
        const errorType = this.extractErrorType(node.content);
        
        if (errorType) {
          if (!this.errorTypeIndex.has(errorType)) {
            this.errorTypeIndex.set(errorType, new Set());
          }
          this.errorTypeIndex.get(errorType)!.add(nodeId);
        } else {
          // エラータイプが不明な場合は "other" に分類
          if (!this.errorTypeIndex.has('other')) {
            this.errorTypeIndex.set('other', new Set());
          }
          this.errorTypeIndex.get('other')!.add(nodeId);
        }
      }
    }
    
    logger.info(`Error type index built: ${this.errorTypeIndex.size} types, ${this.graph.nodes.size} total nodes`);
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
      const parentChildTypes = ['decomposes', 'hypothesizes', 'tests', 'produces', 'learns'];
      if (parentChildTypes.includes(edge.type)) {
        this.parentIndex.set(edge.to, edge.from);
      }
    }

    logger.info(`Performance indexes built: ${this.nodesByType.size} node types, ${this.edgesByNode.size} nodes indexed`);
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
    const parentChildTypes = ['decomposes', 'hypothesizes', 'tests', 'produces', 'learns'];
    if (parentChildTypes.includes(edge.type)) {
      this.parentIndex.set(edge.to, edge.from);
    }
  }

  getGraph(): DebugGraph {
    return this.graph;
  }
}