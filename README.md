# MCP サーバー デバッグ思考

[![npm version](https://img.shields.io/npm/v/mcp-server-debug-thinking.svg)](https://www.npmjs.com/package/mcp-server-debug-thinking)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/mcp-server-debug-thinking.svg)](https://nodejs.org)

問題解決ツリーと仮説-実験-学習サイクルを使用した体系的なデバッグのための、グラフベースのModel Context Protocol (MCP) サーバーです。

## 🚀 特徴

- **🌳 問題解決ツリー**: 複雑な問題を階層的に分解
- **🔬 H-E-Lサイクル**: 仮説 → 実験 → 学習の方法論
- **🧠 知識グラフ**: 時間をかけて再利用可能なデバッグ知識を構築
- **🔍 パターン認識**: 成功したデバッグパターンを自動的に識別
- **💡 学習の抽出**: すべてのセッションから洞察を取得して再利用
- **📊 グラフ分析**: 類似の問題、成功パターン、解決策をクエリ
- **💾 永続的ストレージ**: すべてのデバッグ知識が保存され、検索可能

## 📦 インストール

### npm経由（推奨）

```bash
npm install -g mcp-server-debug-thinking
```

### ソースから

```bash
git clone https://github.com/yourusername/mcp-server-debug-thinking.git
cd mcp-server-debug-thinking
npm install
npm run build
```

## 🔧 設定

### Claude Desktop統合

Claude Desktopの設定に追加します：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "debug-thinking": {
      "command": "npx",
      "args": ["mcp-server-debug-thinking"]
    }
  }
}
```

## 📖 核となる概念

このツールはデバッグを**知識グラフ**としてモデル化します：

### ノード

- **Problem（問題）**: 解決すべき課題
- **Hypothesis（仮説）**: 原因についての理論
- **Experiment（実験）**: 仮説を検証するテスト
- **Observation（観察）**: 実験からの結果
- **Learning（学習）**: 得られた洞察
- **Solution（解決策）**: 検証済みの修正

### エッジ（関係性）

- `decomposes`: 問題 → サブ問題
- `hypothesizes`: 問題 → 仮説
- `tests`: 仮説 → 実験
- `produces`: 実験 → 観察
- `learns`: 観察 → 学習
- `contradicts`/`supports`: 証拠 ↔ 仮説
- `solves`: 解決策 → 問題

## 🎯 3つのシンプルなアクション

### 1. CREATE - グラフにノードを追加

```typescript
{
  action: "create",
  nodeType: "problem" | "hypothesis" | "experiment" | "observation" | "learning" | "solution",
  content: "ノードの説明",
  parentId?: "親ノードのID",  // 適切な関係を自動作成
  metadata?: {
    confidence?: 75,
    tags?: ["react", "performance"]
  }
}
```

### 2. CONNECT - 関係を作成

```typescript
{
  action: "connect",
  from: "ソースノードID",
  to: "ターゲットノードID",
  type: "supports" | "contradicts" | "learns" | ...,
  strength?: 0.8,
  metadata?: {
    reasoning: "テスト結果に基づいて..."
  }
}
```

### 3. QUERY - 検索と分析

```typescript
{
  action: "query",
  queryType: "similar-problems" | "successful-patterns" | "learning-path" | ...,
  parameters: {
    pattern?: "検索テキスト",
    nodeId?: "参照ノード",
    confidence?: 70,
    limit?: 10
  }
}
```

## 💡 使用例

### 基本的なデバッグワークフロー

```typescript
// 1. 問題を定義
await use_tool("debug_thinking", {
  action: "create",
  nodeType: "problem",
  content: "TypeErrorでアプリが起動時にクラッシュする"
});

// 2. 仮説を作成（'hypothesizes'エッジを自動作成）
await use_tool("debug_thinking", {
  action: "create",
  nodeType: "hypothesis",
  content: "ユーザーデータにnullチェックが不足している",
  parentId: "problem-id",
  metadata: { confidence: 80 }
});

// 3. 実験を設計（'tests'エッジを自動作成）
await use_tool("debug_thinking", {
  action: "create",
  nodeType: "experiment",
  content: "user.nameアクセスにオプショナルチェーンを追加",
  parentId: "hypothesis-id"
});

// 4. 観察を記録（'produces'エッジを自動作成）
await use_tool("debug_thinking", {
  action: "create",
  nodeType: "observation",
  content: "エラーが解決し、アプリが正常に起動する",
  parentId: "experiment-id"
});

// 5. 学習を抽出
await use_tool("debug_thinking", {
  action: "create",
  nodeType: "learning",
  content: "外部データは使用前に必ず検証する"
});

// 6. 観察と学習を接続
await use_tool("debug_thinking", {
  action: "connect",
  from: "observation-id",
  to: "learning-id",
  type: "learns"
});
```

### 高度なクエリ

```typescript
// 類似の問題を検索
await use_tool("debug_thinking", {
  action: "query",
  queryType: "similar-problems",
  parameters: {
    pattern: "TypeError null参照",
    limit: 5
  }
});

// 成功パターンを検索
await use_tool("debug_thinking", {
  action: "query",
  queryType: "successful-patterns",
  parameters: {
    tags: ["react", "state-management"]
  }
});

// 学習パスをトレース
await use_tool("debug_thinking", {
  action: "query",
  queryType: "learning-path",
  parameters: {
    nodeId: "problem-id"
  }
});

// サブグラフを視覚化
await use_tool("debug_thinking", {
  action: "query",
  queryType: "graph-visualization",
  parameters: {
    nodeId: "root-problem-id",
    depth: 3
  }
});
```

### 複雑な問題の分解

```typescript
// ルート問題
const rootProblem = await use_tool("debug_thinking", {
  action: "create",
  nodeType: "problem",
  content: "アプリケーションのパフォーマンスが時間とともに低下する"
});

// サブ問題に分解
await use_tool("debug_thinking", {
  action: "create",
  nodeType: "problem",
  content: "メモリ使用量が継続的に増加する",
  parentId: rootProblem.nodeId
});

await use_tool("debug_thinking", {
  action: "create",
  nodeType: "problem",
  content: "APIレスポンス時間が増大している",
  parentId: rootProblem.nodeId
});

// 分解と調査を継続...
```

## 📁 データストレージ

すべてのグラフデータは `~/.debug-thinking-mcp/` に永続化されます：

```bash
~/.debug-thinking-mcp/
├── nodes.jsonl          # JSONL形式のすべてのノード
├── edges.jsonl          # すべての関係
└── graph-metadata.json  # グラフの統計情報
```

## 🔍 クエリタイプ

- **similar-problems**: 指定パターンに類似する問題を検索
- **successful-patterns**: 解決に至ったパターンを識別
- **failed-hypotheses**: 否定された理論から学習
- **learning-path**: 問題から解決までのパスをトレース
- **solution-candidates**: 問題の潜在的な解決策を検索
- **graph-visualization**: グラフをMermaid/DOT形式でエクスポート
- **node-details**: ノードの包括的な情報を取得
- **related-nodes**: すべての接続されたノードを検索

## 🛠️ 開発

```bash
# 依存関係をインストール
npm install

# 開発モードで実行
npm run dev

# プロダクション用にビルド
npm run build

# リンターを実行
npm run lint

# コードをフォーマット
npm run format
```

## 🤝 貢献

貢献を歓迎します！詳細については[貢献ガイド](CONTRIBUTING.md)をご覧ください。

## 📄 ライセンス

このプロジェクトはMITライセンスの下でライセンスされています - 詳細は[LICENSE](LICENSE)ファイルをご覧ください。

## 🙏 謝辞

- [Model Context Protocol](https://modelcontextprotocol.io)上に構築
- 問題解決ツリーと科学的デバッグ手法に着想を得て
- すべての貢献者とユーザーに感謝

---

MCPコミュニティによって ❤️ を込めて作られました