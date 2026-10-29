// A model of how rssHandler in src/index.ts processes a single feed.
//
// The implementation works in this order:
//   1. Read the last seen position from KV
//   2. Fetch the feed and pick the unread items (do nothing if there are none)
//   3. Save the new last seen position to KV (put)
//   4. Split the unread items into messages and send them to the queue in order (send)
// It checks two properties of this implementation:
// - noLoss: every item marked as read has been sent (no lost items)
// - noDup:  no item is sent twice (no duplicates)
//
// Abstractions:
// - Items are published in order from the head of Items (append only)
// - The "link of the last seen item" stored in KV is an index into Items
// - One run (one call of rssHandler) is a single action
// - Failures before the put (e.g. fetching the feed) change no state, so they are not modeled
module rsswk {
  // Items that can be published to the feed, in publication order
  pure val Items = ["a", "b", "c"]

  // The set of elements in a list
  pure def elems(l: List[str]): Set[str] = l.foldl(Set(), (s, x) => s.union(Set(x)))

  // Number of items published to the feed
  var published: int
  // Last seen position stored in KV (how many items of Items have been read)
  var lastSeen: int
  // Items sent to the queue, in sending order
  var sent: List[str]

  // Unread items
  val unread: List[str] = Items.slice(lastSeen, published)

  action init = all {
    published' = 1,
    lastSeen' = 0,
    sent' = [],
  }

  // A new item is published
  action publish = all {
    published < Items.length(),
    published' = published + 1,
    lastSeen' = lastSeen,
    sent' = sent,
  }

  // A run completes successfully
  action runOk = all {
    unread.length() > 0,
    published' = published,
    lastSeen' = published,
    sent' = sent.concat(unread),
  }

  // A run fails while sending, after the put.
  // Only the first n unread items are sent (none when n = 0).
  // The implementation sends whole messages, so only some of these n can actually occur.
  action runFailAfterPut = all {
    unread.length() > 0,
    nondet n = 0.to(unread.length() - 1).oneOf()
    all {
      published' = published,
      lastSeen' = published,
      sent' = sent.concat(unread.slice(0, n)),
    }
  }

  // A run finds no unread items and does nothing
  action runNoNewItems = all {
    unread.length() == 0,
    published' = published,
    lastSeen' = lastSeen,
    sent' = sent,
  }

  action step = any { publish, runOk, runFailAfterPut, runNoNewItems }

  // Every item marked as read has been sent (no lost items)
  val noLoss = elems(Items.slice(0, lastSeen)).subseteq(elems(sent))

  // No item is sent twice (no duplicates)
  val noDup = sent.length() == elems(sent).size()

  // Without failures, no item is lost
  run happyPathTest =
    init
      .then(runOk)
      .then(publish)
      .then(publish)
      .then(runOk)
      .expect(noLoss and noDup and sent == Items)

  // If a run fails right after the put, the item is never sent afterwards
  run lossAfterPutTest =
    init
      .then(runFailAfterPut)
      .expect(not(noLoss) and noDup)
      .then(publish)
      .then(runOk)
      .expect(not(noLoss) and noDup and sent == ["b"])
}
