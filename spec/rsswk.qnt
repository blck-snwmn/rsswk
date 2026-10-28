// src/index.ts の rssHandler が、1つのフィードを処理する流れのモデル。
//
// 実装は「KV に既読位置を保存（put）→ キューに送信（send）」の順で動く。
// その間で失敗したときに何が起きるかを、順序を入れ替えた案と比べて検査する。
//
// 抽象化:
// - フィードの記事は Items の先頭から順に公開されていく（追記のみ）
// - KV に保存する「最後に見た記事の link」は、何件目まで見たかの整数で表す
// - 実行1回分（rssHandler の1回の呼び出し）を1つの action として扱う
module rsswk {
  // フィードに公開されうる記事（公開順）
  pure val Items = ["a", "b", "c"]

  // リストに含まれる要素の集合
  pure def elems(l: List[str]): Set[str] = l.foldl(Set(), (s, x) => s.union(Set(x)))

  // フィードに公開済みの件数
  var published: int
  // KV に保存した既読位置（Items の何件目まで見たか）
  var lastSeen: int
  // キューに送信した記事（送信順、重複を含む）
  var sent: List[str]
  // 一度でも途中で失敗したか
  var failed: bool

  // 未読の記事
  val unread: List[str] = Items.slice(lastSeen, published)

  action init = all {
    published' = 1,
    lastSeen' = 0,
    sent' = [],
    failed' = false,
  }

  // 新しい記事が公開される
  action publish = all {
    published < Items.length(),
    published' = published + 1,
    lastSeen' = lastSeen,
    sent' = sent,
    failed' = failed,
  }

  // 実行が最後まで成功する（順序によらず結果は同じ）
  action runOk = all {
    published' = published,
    lastSeen' = published,
    sent' = sent.concat(unread),
    failed' = failed,
  }

  // 現在の実装: put の後、send で失敗する
  action putFirstFail = all {
    published' = published,
    lastSeen' = published,
    sent' = sent,
    failed' = true,
  }

  // 順序を入れ替えた案: send の後、put で失敗する
  action sendFirstFail = all {
    published' = published,
    lastSeen' = lastSeen,
    sent' = sent.concat(unread),
    failed' = true,
  }

  // 現在の実装（put → send）
  action stepPutFirst = any { publish, runOk, putFirstFail }

  // 順序を入れ替えた案（send → put）
  action stepSendFirst = any { publish, runOk, sendFirstFail }

  action step = stepPutFirst

  // 既読にした記事は、すべて送信されている（取りこぼしがない）
  val noLoss = elems(Items.slice(0, lastSeen)).subseteq(elems(sent))

  // 同じ記事を2回送信していない（重複がない）
  val noDup = sent.length() == elems(sent).size()

  // 重複が起きるのは、途中で失敗した後だけ
  val noDupUnlessFailed = failed or noDup

  // put → send では、put の直後に失敗すると記事を取りこぼす
  run putFirstLosesItemTest =
    init
      .then(putFirstFail)
      .expect(not(noLoss))
      .then(runOk)
      .expect(not(noLoss))

  // send → put では、send の直後に失敗すると次の実行で再送する
  run sendFirstDuplicatesTest =
    init
      .then(sendFirstFail)
      .expect(noLoss and noDup)
      .then(runOk)
      .expect(noLoss and not(noDup))

  // 失敗がなければ、どちらの順序でも取りこぼしも重複も起きない
  run happyPathTest =
    init
      .then(runOk)
      .then(publish)
      .then(publish)
      .then(runOk)
      .expect(noLoss and noDup and sent == Items)
}
