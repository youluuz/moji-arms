#!/usr/bin/env python3
"""Post one Japanese-character quiz daily to the single Buffer-connected X account.

No paid AI API is used. Buffer API key is read only from GitHub Actions Secrets.
For safety, an ambiguous X account, a missing key, or an API failure stops posting.
"""
import argparse
import hashlib
import json
import os
from datetime import date, datetime, timedelta
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

API = "https://api.buffer.com"
TZ = ZoneInfo("Asia/Tokyo")
FIRST_DAY = date(2026, 10, 29)
FIRST_NUMBER = 2
# Use the game information page until the live Render URL is verified.
GAME_URL = "https://youluuz.github.io/moji-arms/"
# char | reading (as clued) | quiz hint | answer explanation
DATA = """
暁|あかつき|夜明けごろを表す、少し古風な言葉。|夜が明けるころのこと。
朧|おぼろ|月や景色がぼんやりとかすむ様子。|ぼんやりとかすんではっきりしない様子。
凪|なぎ|風や波が静まった海で使う言葉。|風がやみ、波が穏やかな状態。
雫|しずく|葉先からぽたりと落ちる水のひと粒。|液体が小さな粒になったもの。
梟|ふくろう|夜に活動することが多い鳥。|フクロウのこと。
鯱|しゃち|海の大型哺乳類で、白黒の体が特徴。|シャチのこと。
鰐|わに|大きな口と鋭い歯を持つ爬虫類。|ワニのこと。
鯨|くじら|海に暮らす巨大な哺乳類。|クジラのこと。
鰻|うなぎ|細長い体で、かば焼きも人気。|ウナギのこと。
鰹|かつお|たたき料理が有名な魚。|カツオのこと。
鯖|さば|味噌煮でおなじみの青魚。|サバのこと。
鯵|あじ|開き干しでも人気の魚。|アジのこと。
鮪|まぐろ|寿司の赤身で人気の魚。|マグロのこと。
鯛|たい|お祝いの席にも登場する魚。|タイのこと。
鱈|たら|冬の鍋によく入る白身魚。|タラのこと。
鮭|さけ|川へ遡上する魚としても有名。|サケのこと。
鱒|ます|サケの仲間の魚。|マスのこと。
鰤|ぶり|大きさで名前が変わる出世魚。|ブリのこと。
蛸|たこ|腕が8本ある海の生き物。|タコのこと。
烏|からす|黒い羽を持ち、賢いことで知られる鳥。|カラスのこと。
雀|すずめ|街中でも見かける小さな鳥。|スズメのこと。
鷹|たか|鋭い爪で獲物を捕らえる猛禽類。|タカのこと。
鶴|つる|長い首と脚を持つ、縁起のよい鳥。|ツルのこと。
燕|つばめ|春に軒先へ巣を作る鳥。|ツバメのこと。
蛙|かえる|雨の日の鳴き声でおなじみ。|カエルのこと。
蛇|へび|細長い体で地面をはう動物。|ヘビのこと。
蝉|せみ|夏の大きな鳴き声の主。|セミのこと。
蟻|あり|行列を作る小さな昆虫。|アリのこと。
蜂|はち|花の蜜を集める種類もいる昆虫。|ハチのこと。
蛍|ほたる|夜に光を放つ小さな昆虫。|ホタルのこと。
蝶|ちょう|美しい羽でひらひら飛ぶ昆虫。|チョウのこと。
蟹|かに|左右に大きなはさみを持つ甲殻類。|カニのこと。
亀|かめ|甲羅を背負った長寿の象徴。|カメのこと。
鮎|あゆ|清流にすみ、塩焼きで人気の魚。|アユのこと。
鯉|こい|池の錦鯉でも知られる魚。|コイのこと。
鯰|なまず|大きな口ひげを持つ川魚。|ナマズのこと。
鰯|いわし|群れで泳ぐ小型の青魚。|イワシのこと。
鰆|さわら|漢字に「春」が入る魚。|サワラのこと。
鰈|かれい|海底で暮らす平たい魚。|カレイのこと。
鮃|ひらめ|平たく、目が片側に寄った魚。|ヒラメのこと。
鼠|ねずみ|チーズ好きのイメージがある小動物。|ネズミのこと。
狐|きつね|赤茶色の毛とふさふさの尾。|キツネのこと。
狸|たぬき|昔話にも登場する丸顔の動物。|タヌキのこと。
鹿|しか|雄に立派な角が生える動物。|シカのこと。
狼|おおかみ|群れで暮らすイヌ科の動物。|オオカミのこと。
豹|ひょう|斑点模様を持つネコ科の猛獣。|ヒョウのこと。
猿|さる|木登りが得意な霊長類。|サルのこと。
兎|うさぎ|長い耳と跳ねる姿が特徴。|ウサギのこと。
虎|とら|しま模様で知られる大型のネコ科動物。|トラのこと。
熊|くま|大きな体と厚い毛皮を持つ動物。|クマのこと。
葱|ねぎ|薬味や鍋に使う細長い野菜。|ネギのこと。
柿|かき|秋に実る橙色の果物。|カキのこと。
栗|くり|とげのあるいがに包まれた秋の味覚。|クリのこと。
桃|もも|淡い色の甘い果物。|モモのこと。
梨|なし|水分たっぷりの秋の果物。|ナシのこと。
梅|うめ|早春に花が咲き、酸っぱい実もなる。|ウメのこと。
桜|さくら|春に淡いピンクの花が咲く木。|サクラのこと。
椿|つばき|冬から春に大きな花をつける木。|ツバキのこと。
柳|やなぎ|枝が細長く垂れ下がる木。|ヤナギのこと。
楓|かえで|手のひらのような葉が紅葉する木。|カエデのこと。
樫|かし|どんぐりを実らせる常緑樹の一種。|カシのこと。
杉|すぎ|日本の山林でよく見られる針葉樹。|スギのこと。
檜|ひのき|香りのよい木材で知られる木。|ヒノキのこと。
榊|さかき|神事にも使われる常緑の植物。|サカキのこと。
蓮|はす|池に大きな花を咲かせる水生植物。|ハスのこと。
藤|ふじ|房状の紫の花を垂らす植物。|フジのこと。
菊|きく|秋を代表する花のひとつ。|キクのこと。
菫|すみれ|小さな紫の花を咲かせる草花。|スミレのこと。
藍|あい|伝統的な青色の染料になる植物。|アイのこと。
茜|あかね|赤色の染料になる植物。|アカネのこと。
苺|いちご|赤い実とつぶつぶが特徴の果物。|イチゴのこと。
葵|あおい|植物名や家紋でも使われる文字。|アオイのこと。
萩|はぎ|秋の七草のひとつ。|ハギのこと。
霙|みぞれ|雨と雪が混ざって降るもの。|みぞれのこと。
雹|ひょう|空から降る氷の粒。|ひょうのこと。
霜|しも|冷たい朝に草や地面につく氷の結晶。|霜のこと。
靄|もや|遠くの景色がかすむ気象現象。|もやのこと。
霞|かすみ|遠景をぼんやりさせるもの。|かすみのこと。
霧|きり|細かな水滴が空気中に浮く現象。|霧のこと。
嵐|あらし|強い風や雨を伴う荒れた天気。|嵐のこと。
雷|かみなり|空が光り大きな音が響く現象。|雷のこと。
虹|にじ|雨上がりに見える七色の弧。|虹のこと。
潮|しお|海水の満ち引きにも関係する言葉。|潮のこと。
渚|なぎさ|波が寄せる水辺。|なぎさのこと。
滝|たき|崖から落ちる大量の水。|滝のこと。
淵|ふち|川の流れが深くなっているところ。|水底が深い場所。
峠|とうげ|山道で最も高いあたり。|峠のこと。
岬|みさき|海に突き出した陸地。|岬のこと。
峰|みね|山の高くとがった部分。|峰のこと。
崖|がけ|急な斜面や切り立った地形。|崖のこと。
窪|くぼ|周囲よりへこんで低い場所。|くぼみのこと。
洞|ほら|山や岩の中の空洞。|洞穴などの「ほら」。
沼|ぬま|泥の多い浅い水域。|沼のこと。
湖|みずうみ|陸地に囲まれた大きな水域。|湖のこと。
沢|さわ|山中の小さな水の流れ。|沢のこと。
浦|うら|海が陸に入りこんだ入り江。|浦のこと。
宵|よい|日が暮れて間もないころ。|宵のこと。
暦|こよみ|日付や季節を知るためのもの。|こよみのこと。
帳|とばり|寝室などを仕切る垂れ幕。|とばりのこと。
簪|かんざし|髪を結うときに使う飾り。|かんざしのこと。
櫛|くし|髪をとかすための道具。|櫛のこと。
袴|はかま|和装で腰から下にはく衣服。|袴のこと。
兜|かぶと|武士が頭にかぶった防具。|兜のこと。
鎧|よろい|戦で身を守る防具。|鎧のこと。
剣|つるぎ|両刃の刀を指す古い言葉。|つるぎのこと。
槍|やり|長い柄の先に刃がつく武器。|槍のこと。
盾|たて|攻撃を防ぐための防具。|盾のこと。
弓|ゆみ|矢を射るための道具。|弓のこと。
矢|や|弓で飛ばすもの。|矢のこと。
鏃|やじり|矢の先端につけるとがった部分。|やじりのこと。
箒|ほうき|床を掃くための道具。|ほうきのこと。
匙|さじ|スープなどをすくう食器。|さじのこと。
鍋|なべ|煮物や鍋料理に使う調理器具。|鍋のこと。
釜|かま|米を炊くことにも使う容器。|釜のこと。
桶|おけ|水などを入れる円筒形の容器。|桶のこと。
椀|わん|ご飯や汁物を入れる器。|お椀のこと。
扇|おうぎ|開いたり閉じたりするあおぎ道具。|扇のこと。
扉|とびら|建物や部屋の入り口を閉じるもの。|扉のこと。
鍵|かぎ|錠を開けるための道具。|鍵のこと。
紐|ひも|物を結んだり縛ったりする細いもの。|ひものこと。
綱|つな|太くて丈夫な縄。|綱のこと。
縄|なわ|繊維をより合わせて作る長いもの。|縄のこと。
糸|いと|細く長い繊維。|糸のこと。
針|はり|縫い物に使う細い金属の道具。|針のこと。
鋸|のこぎり|木を切る、ぎざぎざの刃の道具。|のこぎりのこと。
鑿|のみ|木材を削ったり穴を彫ったりする道具。|のみのこと。
槌|つち|物を打つための道具。|つちのこと。
鉈|なた|枝や薪を切る刃物。|なたのこと。
杭|くい|地面に打ち込む棒状のもの。|杭のこと。
櫂|かい|舟をこぐための道具。|櫂のこと。
夢|ゆめ|眠っている間に見るもの。|夢のこと。
幻|まぼろし|実際にはないのに見えるもの。|幻のこと。
影|かげ|光を遮ることでできる暗い部分。|影のこと。
魂|たましい|生命や精神の本質を指す言葉。|魂のこと。
絆|きずな|人と人との強い結びつき。|絆のこと。
誉|ほまれ|ほめたたえられる名誉。|誉れのこと。
雅|みやび|上品で優雅な趣。|雅のこと。
粋|いき|洗練されたおしゃれな趣。|粋のこと。
匠|たくみ|高い技術を持った職人。|匠のこと。
〆|しめ|封を閉じたことを表す印。|「しめ」と読む略字・記号。
〒|ゆうびんきごう|住所で郵便番号の前に書く印。|郵便記号のこと。
㊙|まるひ|秘密の情報につける印。|「丸秘（まるひ）」の記号。
∞|むげん|数学で終わりがないことを示す記号。|無限を示す記号。
♭|フラット|音を半音下げる音楽記号。|フラット記号。
♯|シャープ|音を半音上げる音楽記号。|シャープ記号。
‰|パーミル|1000分の1を表す単位記号。|パーミルのこと。
§|セクション|文章や法令の区分を表す記号。|セクション記号。
¶|パラグラフ|段落を表す編集上の記号。|段落記号。
℃|どしー|摂氏温度を表す単位記号。|摂氏度を表す記号。
㍑|リットル|液体の体積を表す単位の組文字。|リットルの組文字。
㎏|キログラム|重さ・質量の単位を表す組文字。|キログラムの組文字。
㎞|キロメートル|距離を表す単位の組文字。|キロメートルの組文字。
π|パイ|円周率を表すギリシャ文字。|ギリシャ文字のパイ。
Ω|オメガ|電気抵抗の単位としても見かける文字。|ギリシャ文字のオメガ。
Σ|シグマ|数学で総和を表すときに使う文字。|ギリシャ文字のシグマ。
Δ|デルタ|数学で変化量を表すときにも使う文字。|ギリシャ文字のデルタ。
α|アルファ|ギリシャ文字の最初の文字。|ギリシャ文字のアルファ。
β|ベータ|ギリシャ文字の2番目の文字。|ギリシャ文字のベータ。
γ|ガンマ|ギリシャ文字の3番目の文字。|ギリシャ文字のガンマ。
θ|シータ|角度を表すときによく使う文字。|ギリシャ文字のシータ。
λ|ラムダ|波長などを表すときに使う文字。|ギリシャ文字のラムダ。
μ|ミュー|100万分の1の接頭語にも用いる文字。|ギリシャ文字のミュー。
φ|ファイ|数学で角度や比率の表記にも登場。|ギリシャ文字のファイ。
ψ|プサイ|心理学の記号としても使われるギリシャ文字。|ギリシャ文字のプサイ。
ゐ|い|歴史的仮名遣いで使われた「わ行」の文字。|歴史的仮名遣いの「ゐ」。「い」と読む。
ゑ|え|歴史的仮名遣いで使われた「わ行」の文字。|歴史的仮名遣いの「ゑ」。「え」と読む。
ヰ|イ|旧仮名遣いのカタカナの文字。|旧仮名遣いの「ヰ」。「イ」と読む。
ヱ|エ|旧仮名遣いのカタカナの文字。|旧仮名遣いの「ヱ」。「エ」と読む。
"""

def questions():
    rows = []
    seen = set()
    for line in DATA.splitlines():
        if not line.strip():
            continue
        parts = tuple(line.split("|"))
        if len(parts) != 4 or len(parts[0]) != 1:
            raise ValueError("Question bank requires exactly one Unicode character per row.")
        if parts[0] in seen:
            raise ValueError("Duplicate question character in bank.")
        seen.add(parts[0])
        rows.append(parts)
    # The same stable shuffle across releases (no random API needed).
    return sorted(rows, key=lambda row: hashlib.sha256(("moji-arms-quiz-v1:" + row[0]).encode()).digest())

def posts_for(day):
    index = (day - FIRST_DAY).days
    bank = questions()
    if index < 0 or index >= len(bank):
        raise RuntimeError("The quiz bank is exhausted or the launch day has not arrived. Expand it before running.")
    number = FIRST_NUMBER + index
    char, reading, hint, explanation = bank[index]
    question = (f"📖【今日の文字 #{number}】\n\n"
                f"本日の文字は「{char}」！\nこの文字は何と読む？🤔\n"
                f"💡ヒント：{hint}\n\n"
                f"⚔ 文字が武器になるゲーム『文字武装』\n{GAME_URL}\n"
                f"#文字武装 #今日の文字 #ブラウザゲーム")
    if len(question) > 240:
        raise RuntimeError("Quiz text too long for a safe X post.")
    answer = (f"✅【昨日の文字 #{number} 正解】\n\n"
              f"「{char}」→ {reading}\n"
              f"{explanation}\n"
              f"正解できた？🎯\n#文字武装 #今日の文字")
    return question, answer, number

def gql(query):
    token = os.environ.get("BUFFER_API_KEY")
    if not token:
        raise RuntimeError("BUFFER_API_KEY is missing. Set it in GitHub Actions repository secrets.")
    payload = json.dumps({"query": query}, ensure_ascii=False).encode()
    req = Request(API, data=payload,
                  headers={"Content-Type": "application/json",
                           "Authorization": "Bearer " + token}, method="POST")
    try:
        with urlopen(req, timeout=25) as response:
            body = json.load(response)
    except (HTTPError, URLError) as exc:
        raise RuntimeError(f"Buffer API network/HTTP error: {getattr(exc, 'code', 'network')}") from None
    if body.get("errors"):
        raise RuntimeError("Buffer GraphQL failed: " + "; ".join(e.get("message", "Unknown error") for e in body["errors"]))
    return body["data"]

def literal(s):
    return json.dumps(s, ensure_ascii=False)

def find_channel():
    orgs = gql("query { account { organizations { id name } } }")["account"]["organizations"]
    matches = []
    for org in orgs:
        q = "query { channels(input: {organizationId:" + literal(org["id"]) + "}) {id name service} }"
        for channel in gql(q)["channels"]:
            if channel["service"] == "twitter":
                matches.append((org["id"], channel["id"], channel["name"]))
    requested_id = os.environ.get("BUFFER_CHANNEL_ID", "").strip()
    if requested_id:
        matches = [item for item in matches if item[1] == requested_id]
    if len(matches) != 1:
        raise RuntimeError(f"Exactly one connected X channel must be selected (found {len(matches)})."
                           " Set repository variable BUFFER_CHANNEL_ID if necessary.")
    return matches[0]

def fetch_posts(org_id, channel_id):
    all_posts = []
    cursor = None
    for _ in range(30):  # More than enough for a year of daily posts.
        after = "after: " + literal(cursor) + "," if cursor else ""
        query = ("query { posts(first: 100, " + after +
                 "input: {organizationId:" + literal(org_id) +
                 ",filter:{channelIds:[" + literal(channel_id) +
                 "]}}) { edges {node{id text status}} pageInfo{hasNextPage endCursor}}}")
        data = gql(query)["posts"]
        all_posts.extend(edge["node"] for edge in data["edges"])
        if not data["pageInfo"]["hasNextPage"]:
            return all_posts
        cursor = data["pageInfo"]["endCursor"]
        if not cursor:
            raise RuntimeError("Buffer pagination returned no cursor.")
    raise RuntimeError("Too many posts to verify duplicate safety; refusing to publish.")

def publish(text):
    mutation = ("mutation { createPost(input: {text:" + literal(text) +
                ", channelId:" + literal(os.environ["TARGET_CHANNEL"]) +
                ", schedulingType:automatic, mode:shareNow}) {"
                " ... on PostActionSuccess {post{id status text}}"
                " ... on MutationError {message} } }")
    result = gql(mutation)["createPost"]
    if "post" not in result or not result["post"]:
        raise RuntimeError("Buffer rejected the post: " + result.get("message", "unknown error"))
    print("Buffer accepted post id:", result["post"]["id"], "status:", result["post"].get("status"))
    # Buffer accepted != posted to X; check Buffer's Sent tab after first run.

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--publish", action="store_true", help="Actually post to X through Buffer")
    args = parser.parse_args()
    now = datetime.now(TZ)
    today = now.date()
    if today < FIRST_DAY:
        if args.publish:
            raise RuntimeError("Automatic posts are not enabled before 2026-10-29 JST.")
        today = FIRST_DAY
    question, _, number = posts_for(today)
    previous_question = None
    previous_answer = None
    if today > FIRST_DAY:
        previous_question, previous_answer, previous_number = posts_for(today - timedelta(days=1))
    print(f"Quiz preview for {today.isoformat()} JST:\n{question}\n")
    if previous_answer:
        print("Previous-answer preview:\n" + previous_answer + "\n")
    if not args.publish:
        print(f"Dry run only; {len(questions())} unique characters in this bank. Nothing posted.")
        return
    org_id, channel_id, channel_name = find_channel()
    print("Target Buffer X channel:", channel_name)
    os.environ["TARGET_CHANNEL"] = channel_id
    existing = fetch_posts(org_id, channel_id)
    present = [p.get("text", "") for p in existing]
    # A different run may have created the same post already; never duplicate.
    if previous_answer:
        if previous_answer in present:
            print("Yesterday's answer is already recorded; skipping.")
        elif any(p.get("text") == previous_question and p.get("status") == "sent" for p in existing):
            publish(previous_answer)
        else:
            print("Yesterday's question was not confirmed sent; not publishing an ungrounded answer.")
    if question in present:
        print("Today's question is already recorded; skipping.")
    else:
        publish(question)
    print("Run completed. A successful Buffer response does not guarantee delivery to X.")

if __name__ == "__main__":
    main()
