# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリのコードを扱う際のガイダンスを提供します。

## ビルドと開発コマンド

- **ビルド**: `npm run build` - TypeScriptをコンパイルして実行可能ファイルを作成
- **開発**: `npm run dev` - TypeScriptコンパイラをウォッチモードで実行
- **クリーン**: `npm run clean` - distディレクトリを削除
- **リビルド**: `npm run rebuild` - クリーンとビルドを連続実行
- **リント**: `npm run lint` - TypeScriptファイルでESLintを実行
- **フォーマット**: `npm run format` - Prettierでコードをフォーマット

## アーキテクチャ概要

これは問題解決ツリーと仮説-実験-学習サイクルを使用した体系的なデバッグのための、グラフベースのMCP (Model Context Protocol) サーバーです。

### コアサービス

- **GraphService** (`src/services/GraphService.ts`): デバッグ知識グラフを管理するメインサービス
  - CREATE、CONNECT、QUERYアクションを処理
  - ノード（問題、仮説、実験、観察、学習、解決策）を管理
  - エッジ（ノード間の関係）を管理
  - パターン認識と検索機能を提供

- **GraphStorage** (`src/services/GraphStorage.ts`): グラフデータの永続化を処理
  - ノードとエッジをJSONL形式で保存
  - グラフメタデータを管理
  - 効率的な読み込みと保存を提供

### 型システム

- **グラフ型** (`src/types/graph.ts`):
  - `Node`: すべてのグラフノードの基本型
  - `Edge`: ノード間の関係
  - `DebugGraph`: 完全なグラフ構造
  - 特定のノード型: ProblemNode、HypothesisNode、ExperimentNodeなど

- **アクション型** (`src/types/graphActions.ts`):
  - `CreateAction`: ノード作成のパラメータ
  - `ConnectAction`: エッジ作成のパラメータ
  - `QueryAction`: グラフ検索のパラメータ
  - 各アクションのレスポンス型

### 公開されているMCPツール

サーバーは単一のツールを公開しています: **debug_thinking** （3つのアクション付き）

1. **CREATE**: 知識グラフにノードを追加
   - 親子関係に基づいて自動的にエッジを作成
   - すべてのノードタイプをサポート: problem、hypothesis、experiment、observation、learning、solution

2. **CONNECT**: ノード間に明示的な関係を作成
   - 関係タイプをサポート: decomposes、hypothesizes、tests、produces、learns、contradicts、supports、solves

3. **QUERY**: グラフを検索・分析
   - クエリタイプ: similar-problems、successful-patterns、learning-path、graph-visualizationなど

### 主要な設計パターン

- **グラフベースの知識表現**: すべてのデバッグ知識は有向グラフとして保存
- **自動エッジ作成**: 親子関係は適切なエッジを自動的に作成
- **パターン認識**: セッション間で成功したデバッグパターンを識別
- **TypeScriptファースト**: 包括的な型定義により型安全性を確保
- **ファイルシステム永続化**: グラフデータは`.debug-thinking-mcp/`ディレクトリに保存
- **モジュラーアーキテクチャ**: グラフ操作、ストレージ、MCPインターフェース間の明確な分離

### エントリーポイント

メインエントリーポイントは`src/index.ts`で、以下を行います：

- stdioトランスポートを使用してMCPサーバーをセットアップ
- アクションをGraphServiceメソッドにルーティング
- MCP準拠の形式でレスポンスを処理

## 開発メモ

- プロジェクトはES2022ターゲットのTypeScriptを使用
- ESLintとPrettierがコード品質のために設定済み
- Node.js 16+が必要
- ユニークIDの生成にUUID v4を使用
- グラフデータは効率のためJSONLファイルとして永続化
- プロジェクトはツール実装のためのMCP SDKパターンに従う