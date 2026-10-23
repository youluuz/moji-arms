# 文字武装 GLYPH STRIKE v6.4 — 安定版候補

## 遊ぶ方法

### 全員がブラウザで遊ぶ公開版（おすすめ）

このフォルダをGitHubのリポジトリに公開し、`render.yaml`をRenderに連携すると、**誰でもアクセスできるHTTPSのゲームURL**が生成されます。公開に **Python、WindowsのEXE、Cloudflareの一時URL** は不要です。

1. GitHubに新しいリポジトリを作成（例 `moji-arms-online`）。
2. **このフォルダの中身**（`main.go`, `tunnel.go`, `go.mod`, `main_test.go`, `public/`, `Dockerfile`, `render.yaml`）を、GitHubリポジトリの **ルート** に配置してコミットする。ZIPファイル1つだけのアップロードではWebアプリは起動しません。
3. https://dashboard.render.com/ を開き、**New → Blueprint** を選び、GitHubのリポジトリを接続する。
4. `render.yaml` を認識させて **Deploy Blueprint** を実行。無料枠の利用条件や料金確認画面が表示された場合は、内容を確認する。
5. デプロイが `Live` になったら、Renderが表示する `https://...onrender.com/` がみんなで遊べるゲームURLです。
6. ゲームで名前を入力しロビーへ → **「ルームを作成して開く」** → 友達に招待URLを送信。相手は別Wi-FiでもWebブラウザで参加できます。

**注意：このZIP自体はオンラインで公開されたサイトではありません。** GitHub/Renderへのアップロードとデプロイを完了するまで、固定の公開URLは存在しません。

### Windowsで一時公開する場合

`文字武装_別WiFi対戦_Windows.exe` をダブルクリックすると、一時的なCloudflare Quick TunnelのURLを発行する方法も利用できます。外部サービスとの接続および初回ツール取得が必要で、通信が遮断される環境では発行できません。公開URLが変わるため、**広く配布するゲームのURLにはRender版をおすすめします**。

### 同じWi-Fiのみ

`文字武装_起動_Windows.exe` をダブルクリック。Windows 10/11 x64向け。Python不要。起動した黒い画面を閉じるとサーバーが停止します。

