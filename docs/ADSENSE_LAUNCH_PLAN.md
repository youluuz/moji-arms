# 『文字武装』広告収益化の実装・審査チェックリスト (2026-10-28)

## 現在のステータス
- 一般向け公開ベータのゲームコードは公開済み。
- Google AdSense の広告コードは **未導入**。審査前に架空の publisher ID を埋め込まない。
- 公開中のプライバシーポリシーは広告配信前のもの。広告を導入する直前に記載を更新する。

## リリースまでの順番
1. 独自ドメインを取得（例は任意。既存の `onrender.com` サブドメインは通常の AdSense 審査向けドメインとして使わない）。
2. Render の Web Service にカスタムドメインを設定し、https で /、/about.html、/privacy.html を確認する。
3. /about.html に、玩法・ルール・武装・開発情報など独自の説明を分かりやすく掲載する。申請審査のためにダミー記事は作らない。
4. Google AdSense (<https://adsense.google.com/start/>) で自身のアカウントを開設し、**取得した独自ドメイン**を登録して審査する。サイト承認前には広告を表示しない。
5. 承認後、/about.html のゲーム操作に接触しない部分に、Google から発行された正しい広告スクリプトと広告ユニットを組み込む。実際の戦闘画面と multiplayer の iframe 内には広告を置かない。
6. Google の publisher ID を使用して /ads.txt を設置。正しい ID が発行されるまでダミー ID を公開しない。
7. /privacy.html に広告配信事業者・Cookie・第三者への情報送信・広告設定からのオプトアウトを説明する。EU/EEA・英国・スイスで広告を配信する場合は、対象の同意管理要件を満たす。
8. 自分で広告をクリックしたり、ゲーム内コインを通常の広告クリックに報酬として紐づけたりしない。広告クリックを促す文言も付けない。
9. 実際のPC/スマホで UI と広告を確認。画面幅による広告と操作ボタンの重なり、累計レイアウトシフトを検査する。

## 避ける広告配置
- ゲームキャンバス内・ジョイスティックや攻撃/必殺技ボタンの近く
- ロビーの「プレイ開始」「ルーム作成」等と区別できない広告
- 強制的にクリックしなければ先に進めない広告ページ
- 多数の自動リロードや広告表示回数を稼ぐ設計

## 運用
- Render Free は15分無通信だと休止し、復帰に時間がかかる。一般公開・継続的な広告収益を目指すなら有料インスタンス移行を検討。
- AdSense 収益は閲覧数・広告配信・地域等に左右されるため初日からの収益は保証されない。
- 監視対象：WebSocketの接続拒否率、HTTP 5xx、メモリ消費、Renderの利用量、AdSenseのポリシーセンター。

## 公式参照
- <https://support.google.com/adsense/answer/2784438?hl=ja>
- <https://support.google.com/adsense/answer/7584263?hl=ja>
- <https://support.google.com/adsense/answer/2768340?hl=ja>
- <https://support.google.com/adsense/answer/1348695?hl=ja>
- <https://support.google.com/adsense/answer/12171612?hl=ja>
- <https://support.google.com/adsense/answer/13554116?hl=ja>
- <https://render.com/docs/free>
