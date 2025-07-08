# MCP Server Debug Thinkingへの貢献

まず最初に、MCP Server Debug Thinkingへの貢献を検討していただきありがとうございます！あなたのような方々がこのツールをみんなにとってより良いものにしています。

## 行動規範

このプロジェクトとそれに参加するすべての人は、私たちの[行動規範](CODE_OF_CONDUCT.md)に従います。参加することで、この規範を守ることが期待されます。

## どのように貢献できますか？

### バグの報告

バグレポートを作成する前に、既存のissueを確認してください。作成する必要がないことがわかるかもしれません。バグレポートを作成する際は、できるだけ多くの詳細を含めてください：

- **問題を特定するための明確で説明的なタイトル**を使用する
- **問題を再現する正確な手順**をできるだけ詳細に記述する
- **手順を示す具体的な例**を提供する
- **手順に従った後に観察された動作**を記述する
- **代わりに期待した動作とその理由**を説明する
- 可能であれば**スクリーンショットやアニメーションGIF**を含める
- **環境の詳細**（OS、Node.jsバージョン、Claude Desktopバージョン）を含める

### 機能改善の提案

機能改善の提案はGitHub issuesとして追跡されます。機能改善の提案を作成する際は、以下を含めてください：

- **提案を特定するための明確で説明的なタイトル**を使用する
- **提案された改善のステップバイステップの説明**を提供する
- **手順を示す具体的な例**を提供する
- **現在の動作**を記述し、**代わりに期待する動作**を説明する
- **なぜこの改善が有用なのか**を説明する

### 初めてのコード貢献

どこから貢献を始めればいいかわかりませんか？これらの`beginner`と`help-wanted`のissueから始めることができます：

- [初心者向けissue](https://github.com/yourusername/mcp-server-debug-thinking/labels/beginner) - 数行のコードで済むはずのissue
- [ヘルプ募集issue](https://github.com/yourusername/mcp-server-debug-thinking/labels/help%20wanted) - もう少し複雑なissue

### プルリクエスト

1. リポジトリをフォークし、`main`からブランチを作成する
2. テストすべきコードを追加した場合は、テストを追加する
3. APIを変更した場合は、ドキュメントを更新する
4. テストスイートが通ることを確認する
5. コードがリントを通ることを確認する
6. プルリクエストを発行する！

## 開発プロセス

### 開発環境のセットアップ

1. リポジトリをフォークしてクローン：
   ```bash
   git clone https://github.com/your-username/mcp-server-debug-thinking.git
   cd mcp-server-debug-thinking
   ```

2. 依存関係をインストール：
   ```bash
   npm install
   ```

3. 機能や修正のためのブランチを作成：
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. 開発モードを開始：
   ```bash
   npm run dev
   ```

### コードスタイル

- 型安全性のためTypeScriptを使用
- 既存のコードスタイルに従う
- 意味のある変数名と関数名を使用
- 複雑なロジックにはコメントを追加
- 可能な場合は自己文書化コードを書く

### コード検証

- PR提出前にすべてのコードがリントを通ることを確認
- Claude Desktopで変更をテスト

```bash
# リントを実行
npm run lint

# コードをフォーマット
npm run format

# プロジェクトをビルド
npm run build
```

### コミットメッセージ

- 現在形を使用（"Added feature"ではなく"Add feature"）
- 命令形を使用（"Moves cursor to..."ではなく"Move cursor to..."）
- 最初の行は72文字以下に制限
- 最初の行の後でissueとプルリクエストを自由に参照

例：
```
Add pattern recognition for async/await errors

- Implement detection for common Promise rejection patterns
- Add learning mechanism for async error handling
- Update documentation with async debugging examples

Fixes #123
```

### ドキュメント

- 機能を変更した場合はREADME.mdを更新
- [Keep a Changelog](https://keepachangelog.com/)形式に従ってCHANGELOG.mdを更新
- 新しい関数とクラスにJSDocコメントを追加
- ドキュメントに例を含める

## プロジェクト構造

```
mcp-server-debug-thinking/
├── src/                # ソースファイル
│   ├── index.ts       # メインサーバー実装
│   ├── types/         # TypeScript型定義
│   ├── services/      # コアサービス（GraphService、GraphStorage）
│   └── utils/         # ユーティリティ関数
├── dist/               # コンパイル済みJavaScriptファイル
├── .github/            # GitHub固有のファイル
│   ├── ISSUE_TEMPLATE/ # Issueテンプレート
│   └── workflows/      # GitHub Actions
├── package.json        # プロジェクトメタデータと依存関係
├── tsconfig.json       # TypeScript設定
└── README.md           # プロジェクトドキュメント
```

## リリースプロセス

1. `package.json`のバージョンを更新
2. `CHANGELOG.md`を更新
3. gitタグを作成：`git tag -a v1.0.0 -m "Release version 1.0.0"`
4. 変更をプッシュ：`git push origin main --tags`
5. GitHub Actionsが自動的にnpmに公開

## 貢献者の認識

貢献者は以下の方法で認識されます：

- README.mdのContributorsセクションに追加
- 重要な貢献についてはリリースノートで言及
- コミットメッセージとプルリクエストでクレジット付与

## 質問？

以下で気軽に質問してください：

- [GitHub Discussions](https://github.com/yourusername/mcp-server-debug-thinking/discussions)
- [GitHub Issues](https://github.com/yourusername/mcp-server-debug-thinking/issues)

みんなのためにデバッグをより良くする貢献をありがとうございます！ 🎉