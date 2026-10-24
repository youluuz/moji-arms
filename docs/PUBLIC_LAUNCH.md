# 文字武装｜無料ブラウザ公開の手順（公開ベータ）
更新：2026-10-24　対象：GitHub `youluuz/moji-arms` / `main`

## まず結論
- **ゲーム本体**：Render Free Web Service（Go + WebSocket、1台、DBなし）。`render.yaml` と `Dockerfile` を用意済み。CPU戦・オンライン戦はすべて同じURLから遊ぶ。
- **広告・紹介ページ**：GitHub Pages（public repository の Free 枠）。`docs/index.html` は公開用に準備済み。静的なのでRenderが休止中でも説明・シェアができる。
- **費用**：ホスティング初期費用0円を目標。Renderでは **Free** を選び、課金方法の登録・追加サービス・アップグレードを避ける。独自ドメイン購入、広告出稿、外部DBは不要。
- **確認済み**：GitHub ActionsのGo/JS/Chromium自動テスト。**未確認**：実際のRenderサービスがLiveであること、実スマホ・異なるWi-Fiでの通信、GitHub Pagesが有効であること。

## A. ゲーム本体を Render で公開（利用者のアカウント操作が必要）
1. [Render Dashboard](https://dashboard.render.com/) にログイン。
2. **New → Blueprint** を選択し、GitHubの `youluuz/moji-arms` を連携する。**新しいサービスを重複して作らないよう、すでに同名サービスがないか先に確認**。
3. `render.yaml` を読み込み、名前 `moji-arms-online`、**Web Service / Free / main** であること、既存のサービスを使う場合は「既存サービスを変更せず再デプロイ」できるか確認する。
4. 作成後、**Deploys → Live**、**Settings → Health Check `/healthz`**、サービスの **Public URL** を確認する。`https://moji-arms-online.onrender.com/` は設定名から期待されるURLであり、実際には **Renderが表示する正確なURL** を優先する。
5. 取得したURLで `/healthz` に `"ok":true` が返るか確認し、`/` でロビー、`/about.html` で説明ページが出るか確認する。
6. ブラウザのシークレットウィンドウと別Wi-Fiの端末でルーム作成→招待リンク→2人入室→開始→移動/攻撃/終了/再戦を試す。
7. `render.yaml` はテスト成功後のみデプロイ（`autoDeployTrigger: checksPass`）。`README` や `docs` だけの変更ではWeb Serviceを再ビルドしない。

**注意**：Render Freeは15分無通信で休止し、復帰に時間がかかる。月750インスタンス時間の制限あり。メモリ内ルームは再起動で消える。恒久的な稼働時間、保存、同時対戦性能を保証するものではない。アクセスが急増する前に小規模ベータで確認する。

### ゼロ円を守る設定
- **Freeプランのみ**。追加のPostgres/Key Value、ジョブ、独自ドメイン、広告は作らない。
- **Billing** で無料枠の使用量（稼働時間・帯域・ビルド分）を確認する。クレジットカード登録済みの場合は無料枠超過課金の設定に注意する。Renderのプラン外課金を避けるにはアカウントの支払設定・支出上限を確認。
- **常時監視で「寝かせない」ためのHTTP pingを設定しない**。不要な稼働時間やアクセスを増やすので無料枠運用に不向き。
- 送信されるHTMLは、対応ブラウザではサーバー起動時に生成したgzip圧縮データを使用し、公開アクセス時の帯域を節約する。

## B. 宣伝ページを GitHub Pages で無料公開（利用者の設定操作が必要）
1. [GitHubのPages設定](https://github.com/youluuz/moji-arms/settings/pages) を開く。
2. `Build and deployment` → `Source: Deploy from a branch` → `main` → `/docs` → `Save`。
3. 公開されるURLの候補は `https://youluuz.github.io/moji-arms/`。**実際のURLはGitHub Pagesの設定画面で確認**。
4. `docs/index.html` の「無料でプレイ」のリンク先は想定Render URLを設定済み。**Renderの実際の公開URLが異なる場合は必ず置き換える**。本体では `/about.html` も利用できる。
5. GitHub Pagesは無料の広告・説明ページであり、**オンラインルームはそこで直接稼働しない**。プレイボタンでRenderへ移動する設計。

## C. 公開前の最低限の動作確認（手動）
- [ ] Renderが**Live**、HTTPS、`/healthz` OK、`/` にロビー表示
- [ ] `/about.html` ・ `/privacy.html` ・アイコンが開く
- [ ] CPU戦（通常/カスタム）、武装5スロット、回復と必殺技、残り人数/キル数が動く
- [ ] オンライン2端末・別Wi-Fi接続、参加、戦闘、勝者表示、再戦が動く
- [ ] スマホ縦/横、移動スティック、タップ射撃、必殺技ボタンが他のスロットに重ならない
- [ ] Render URLとPagesのゲームリンクが一致し、プレイボタンが迷子にならない
- [ ] 問題なければSNSへ投稿。公開が不安定なら「公開ベータ」「接続しづらい場合あり」と明記

## D. 不具合が発覚した場合
`https://github.com/youluuz/moji-arms/actions` の検証結果、Render `Deploys / Logs`、画面のブラウザコンソールで確認。問題が出たときはSNSの正式発表を延期し、Renderの前の正常デプロイへ戻す。無料枠にはロールバック保持数の制限がある。

## 維持・次の一手
改善要望はGitHub Issuesへ、公開にあたっては [PROMOTION_KIT.md](./PROMOTION_KIT.md) の無料宣伝テンプレートを活用。
参考： [Render Free](https://render.com/docs/free) / [Render Blueprint YAML](https://render.com/docs/blueprint-spec) / [GitHub Pages 設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
