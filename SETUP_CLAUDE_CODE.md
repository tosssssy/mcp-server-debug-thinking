# Claude Code での debug-thinking-mcp の使い方

## セットアップ手順

### 1. インストール

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/debug-thinking-mcp.git
cd debug-thinking-mcp

# 依存関係をインストール
npm install

# ビルド
npm run build

# グローバルにリンク
npm link
```

### 2. Claude Desktop の設定

Claude Desktop の設定ファイルに以下を追加：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "debug-thinking": {
      "command": "mcp-server-debug-thinking",
      "env": {
        "DISABLE_DEBUG_LOGGING": "false"
      }
    }
  }
}
```

### 3. Claude Desktop を再起動

設定を反映させるために Claude Desktop を完全に終了して再起動してください。

### 4. 動作確認

Claude Code で以下のように使えるか確認：

```
「debug_thinking ツールを使って、このエラーのデバッグを手伝って」
```

## トラブルシューティング

### ツールが見つからない場合

1. `npm link` が成功したか確認：
   ```bash
   which mcp-server-debug-thinking
   ```

2. Claude Desktop の設定ファイルが正しい場所にあるか確認

3. Claude Desktop を完全に終了して再起動（タスクバー/メニューバーから終了）

4. ログを確認：
   ```bash
   # macOS
   tail -f ~/Library/Logs/Claude/claude.log
   ```

### 代替の設定方法

`npm link` の代わりに絶対パスを使用：

```json
{
  "mcpServers": {
    "debug-thinking": {
      "command": "/path/to/debug-thinking-mcp/dist/index.js",
      "env": {
        "DISABLE_DEBUG_LOGGING": "false"
      }
    }
  }
}
```

または npx を使用：

```json
{
  "mcpServers": {
    "debug-thinking": {
      "command": "npx",
      "args": ["mcp-server-debug-thinking"],
      "env": {
        "DISABLE_DEBUG_LOGGING": "false"
      }
    }
  }
}
```