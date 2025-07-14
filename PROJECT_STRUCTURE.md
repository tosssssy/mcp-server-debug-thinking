# Debug Thinking MCP - プロジェクト構造と実装詳細

## ディレクトリ構造

```
debug-thinking-mcp/
├── src/
│   ├── index.ts                 # MCPサーバーのエントリーポイント
│   ├── constants.ts             # アプリケーション定数
│   ├── types/                   # 型定義
│   │   ├── graph.ts            # グラフ構造の型定義
│   │   └── graphActions.ts     # アクション関連の型定義
│   ├── services/               # コアサービス
│   │   ├── GraphService.ts     # グラフ操作のメインサービス
│   │   └── GraphStorage.ts     # データ永続化サービス
│   └── utils/                  # ユーティリティ関数
│       ├── format.ts           # レスポンスフォーマット
│       ├── logger.ts           # ロギングユーティリティ
│       └── storage.ts          # ファイルシステム操作
├── __tests__/                  # テストファイル
├── dist/                       # ビルド出力
├── .debug-thinking-mcp/        # データストレージ（実行時作成）
│   ├── nodes.jsonl            # ノードデータ
│   ├── edges.jsonl            # エッジデータ
│   └── graph-metadata.json    # グラフメタデータ
└── 設定ファイル群
    ├── package.json
    ├── tsconfig.json
    ├── biome.json
    └── vitest.config.ts
```

## 実装されているクラス

### 1. GraphService (/src/services/GraphService.ts)
**役割**: デバッグ知識グラフの操作を管理するメインサービス

**主要なプロパティ**:
- `graph: DebugGraph` - グラフデータ本体
- `storage: GraphStorage` - ストレージサービス
- `errorTypeIndex: Map<string, Set<string>>` - エラータイプ別インデックス
- `nodesByType: Map<NodeType, Set<string>>` - ノードタイプ別インデックス
- `edgesByNode: Map<string, { incoming: Edge[]; outgoing: Edge[] }>` - ノード別エッジインデックス
- `parentIndex: Map<string, string>` - 親子関係インデックス

**パブリックメソッド**:
- `constructor()` - インスタンス初期化
- `async initialize()` - グラフの初期化とデータ読み込み
- `async create(action: CreateAction)` - ノード作成
- `async connect(action: ConnectAction)` - エッジ作成
- `async query(action: QueryAction)` - グラフ検索
- `async saveGraph()` - グラフデータの保存
- `getGraph()` - グラフデータの取得

**プライベートメソッド**:
- `enrichNodeMetadata(node: Node)` - ノードメタデータの自動設定
- `createEdge(...)` - エッジオブジェクトの作成
- `checkForConflicts(action: ConnectAction)` - 矛盾するエッジの検出
- `async generateSuggestions(node: Node)` - 次のアクション提案
- `async findSimilarProblems(params)` - 類似問題検索
- `findSolutionsForProblem(problemId: string)` - 解決策検索
- `buildDebugPath(problemId, solutionId)` - デバッグパス構築
- `extractErrorType(content: string)` - エラータイプ抽出
- `calculateSimilarity(pattern, content)` - 類似度計算
- `findLongestCommonSubstring(s1, s2)` - 最長共通部分文字列
- `calculateLevenshteinSimilarity(s1, s2)` - 編集距離による類似度
- `calculateWordLevelSimilarity(s1, s2)` - 単語レベルの類似度
- `async getRecentActivity(params)` - 最近の活動取得
- `buildErrorTypeIndex()` - エラータイプインデックス構築
- `buildPerformanceIndexes()` - パフォーマンスインデックス構築
- `updateIndexesForNewNode(node)` - ノード追加時のインデックス更新
- `updateIndexesForNewEdge(edge)` - エッジ追加時のインデックス更新

### 2. GraphStorage (/src/services/GraphStorage.ts)
**役割**: グラフデータの永続化を管理

**プロパティ**:
- `dataDir: string` - データディレクトリパス
- `nodesFile: string` - ノードファイルパス
- `edgesFile: string` - エッジファイルパス
- `metadataFile: string` - メタデータファイルパス

**パブリックメソッド**:
- `constructor()` - ストレージパスの初期化
- `async initialize()` - ストレージディレクトリの作成
- `async saveNode(node: Node)` - ノードの保存
- `async saveEdge(edge: Edge)` - エッジの保存
- `async saveGraphMetadata(graph: DebugGraph)` - メタデータの保存
- `async loadGraph()` - グラフ全体の読み込み
- `async clearStorage()` - ストレージのクリア（未実装）

### 3. Logger (/src/utils/logger.ts)
**役割**: アプリケーション全体のロギング管理

**クラス**: `Logger`
- `constructor(level: LogLevel)` - ログレベルの設定
- `error(message: string, ...args)` - エラーログ
- `warn(message: string, ...args)` - 警告ログ
- `info(message: string, ...args)` - 情報ログ
- `debug(message: string, ...args)` - デバッグログ
- `success(message: string, ...args)` - 成功ログ

**エクスポート**: `logger` インスタンス（シングルトン）

## 型定義

### graph.ts - グラフ構造の型定義
- `NodeType` - ノードタイプ（problem, hypothesis, experiment, observation, learning, solution）
- `EdgeType` - エッジタイプ（decomposes, hypothesizes, tests, produces, learns, contradicts, supports, solves）
- `Node` - 基本ノードインターフェース
- `Edge` - エッジインターフェース
- `DebugGraph` - グラフ全体の構造
- `ProblemNode`, `HypothesisNode`, `ExperimentNode`, `ObservationNode`, `LearningNode`, `SolutionNode` - 各ノードタイプの詳細型
- 型ガード関数群（`isProblemNode`, `isHypothesisNode`, etc.）

### graphActions.ts - アクション関連の型定義
- `ActionType` - アクションタイプ列挙型（CREATE, CONNECT, QUERY）
- `CreateAction` - ノード作成アクション
- `ConnectAction` - エッジ作成アクション
- `QueryAction` - 検索アクション
- `QueryType` - クエリタイプ（similar-problems, recent-activity）
- `GraphAction` - 全アクションのユニオン型
- `CreateResponse`, `ConnectResponse`, `QueryResponse` - レスポンス型
- `SimilarProblemsResult`, `RecentActivityResult` - クエリ結果型
- `getAutoEdgeType(parentType, childType)` - 自動エッジタイプ判定関数

## ユーティリティ関数

### storage.ts - ファイルシステム操作
- `ensureDirectory(dirPath)` - ディレクトリ作成
- `readJsonFile<T>(filePath)` - JSONファイル読み込み
- `writeJsonFile<T>(filePath, data)` - JSONファイル書き込み
- `listJsonFiles(dirPath)` - JSONファイル一覧取得
- `appendJsonLine<T>(filePath, data)` - JSONL行追加
- `readJsonLines<T>(filePath)` - JSONL全行読み込み
- `readJsonLinesStream<T>(filePath)` - JSONLストリーム読み込み
- `fileExists(filePath)` - ファイル存在確認

### format.ts - レスポンスフォーマット
- `createJsonResponse(data, isError)` - MCP準拠のJSONレスポンス作成

## 定数 (constants.ts)
- `DATA_DIR_NAME = ".debug-thinking-mcp"` - データディレクトリ名
- `METADATA_FILE = "metadata.json"` - メタデータファイル名
- `TOOL_NAME = "debug_thinking"` - MCPツール名
- `SERVER_NAME = "debug-thinking-mcp-server"` - サーバー名
- `SERVER_VERSION = "1.0.0"` - サーバーバージョン

## エントリーポイント (index.ts)
- MCPサーバーのセットアップ
- `debug_thinking`ツールの定義と登録
- リクエストハンドラーの設定
- アクションのGraphServiceへのルーティング
- 正常なシャットダウン処理（SIGINT, SIGTERM）

## 主要な機能の流れ

1. **ノード作成時**: 
   - `create`アクション → `GraphService.create()` → ノード作成 → 親子関係の自動エッジ生成 → インデックス更新 → 永続化

2. **エッジ作成時**:
   - `connect`アクション → `GraphService.connect()` → 矛盾チェック → エッジ作成 → インデックス更新 → 永続化

3. **検索時**:
   - `query`アクション → `GraphService.query()` → インデックス活用 → 類似度計算 → 結果ソート → レスポンス生成

4. **データ永続化**:
   - ノード/エッジ → JSONL形式で追記 → メタデータはJSON形式で上書き保存

5. **起動時**:
   - `GraphService.initialize()` → `GraphStorage.loadGraph()` → インデックス構築 → サーバー起動