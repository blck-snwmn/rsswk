// src/index.ts の rssHandler が、1つのフィードを処理する流れのモデル。
//
// 実装は次の順で動く:
//   1. KV から既読位置を読む
//   2. フィードを取得して未読の記事を取り出す（なければ何もしない）
//   3. KV に既読位置を保存する（put）
//   4. 未読の記事をいくつかのメッセージに分けて、順にキューへ送信する（send）
// この実装について、次の2つを検査する。
// - noLoss: 既読にした記事は、すべて送信されている（取りこぼしがない）
// - noDup:  同じ記事を2回送信していない（重複がない）
//
// 抽象化:
// - フィードの記事は Items の先頭から順に公開されていく（追記のみ）
// - KV に保存する「最後に見た記事の link」は、何件目まで見たかの整数で表す
// - 実行1回分（rssHandler の1回の呼び出し）を1つの action として扱う
// - put より前の失敗（フィード取得の失敗など）は状態を変えないので扱わない
module rsswk {
  // フィードに公開されうる記事（公開順）
  pure val Items = ["a", "b", "c"]

  // リストに含まれる要素の集合
  pure def elems(l: List[str]): Set[str] = l.foldl(Set(), (s, x) => s.union(Set(x)))

  // フィードに公開済みの件数
  var published: int
  // KV に保存した既読位置（Items の何件目まで見たか）
  var lastSeen: int
  // キューに送信した記事（送信順）
  var sent: List[str]

  // 未読の記事
  val unread: List[str] = Items.slice(lastSeen, published)

  action init = all {
    published' = 1,
    lastSeen' = 0,
    sent' = [],
  }

  // 新しい記事が公開される
  action publish = all {
    published < Items.length(),
    published' = published + 1,
    lastSeen' = lastSeen,
    sent' = sent,
  }

  // 実行が最後まで成功する
  action runOk = all {
    unread.length() > 0,
    published' = published,
    lastSeen' = published,
    sent' = sent.concat(unread),
  }

  // put の後、送信の途中で失敗する。
  // 未読の記事のうち先頭 n 件だけが送信される（n = 0 なら1件も送れていない）。
  // 実装ではメッセージ単位で送るので、実際に起こりうる n はこの一部になる。
  action runFailAfterPut = all {
    unread.length() > 0,
    nondet n = 0.to(unread.length() - 1).oneOf()
    all {
      published' = published,
      lastSeen' = published,
      sent' = sent.concat(unread.slice(0, n)),
    }
  }

  // 未読の記事がないので、何もせずに終わる
  action runNoNewItems = all {
    unread.length() == 0,
    published' = published,
    lastSeen' = lastSeen,
    sent' = sent,
  }

  action step = any { publish, runOk, runFailAfterPut, runNoNewItems }

  // 既読にした記事は、すべて送信されている（取りこぼしがない）
  val noLoss = elems(Items.slice(0, lastSeen)).subseteq(elems(sent))

  // 同じ記事を2回送信していない（重複がない）
  val noDup = sent.length() == elems(sent).size()

  // 失敗がなければ取りこぼしは起きない
  run happyPathTest =
    init
      .then(runOk)
      .then(publish)
      .then(publish)
      .then(runOk)
      .expect(noLoss and noDup and sent == Items)

  // put の直後に失敗すると、その記事は以後送信されない
  run lossAfterPutTest =
    init
      .then(runFailAfterPut)
      .expect(not(noLoss) and noDup)
      .then(publish)
      .then(runOk)
      .expect(not(noLoss) and noDup and sent == ["b"])
}
