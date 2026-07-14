// Unit 29A regression: provider data enrichment. Verifies that (1) reply/quote
// TEXT is carried into EngagedAccountRaw (bounded + surrogate-safe), (2) tweet
// MEDIA is normalized from extendedEntities, (3) the mock provider mirrors the
// enrichment deterministically, (4) collectEngagedAccounts counts repeat
// engagers (appearances) without changing dedupe/cap behavior, and (5) the
// schema changes are additive (old-shaped payloads still validate).
//
// Run after `pnpm build`:  node scripts/checks/data-enrichment.regression.cjs
// (or `pnpm check:data-enrichment`). Injected fetch — no network, no keys.

const tw = require("../../packages/twitter/dist/index.js");
const { collectEngagedAccounts } = require("../../packages/analysis/dist/index.js");
const {
  TweetSchema,
  EngagedAccountRawSchema,
} = require("../../packages/shared/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };
const jsonResp = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { "content-type": "application/json" } });
const fetchReturning = (obj) => async () => jsonResp(obj);

const user = (i) => ({ id: `u${i}`, userName: `user${i}`, name: `User ${i}`, description: `bio ${i}`, followers: 100 + i, following: 5, statusesCount: 200, isBlueVerified: false, createdAt: "2020-01-01T00:00:00Z", profilePicture: "https://x/p.jpg" });
const tweet = (i, extra = {}) => ({ id: `t${i}`, text: `tweet ${i}`, retweetCount: i, replyCount: i, likeCount: i, quoteCount: 0, viewCount: 10 * i, createdAt: "2020-01-01T00:00:00Z", lang: "en", isReply: false, quoted_tweet: null, author: user(i), ...extra });

(async () => {
  // --- 1. schema backward compat (old-shaped payloads, no new fields) ------
  {
    const oldTweet = { id: "t1", text: "hello" };
    const oldEngaged = { user: { id: "u1", handle: "h" }, tweetId: "t1", source: "REPLY" };
    ck("old-shaped Tweet still validates", TweetSchema.safeParse(oldTweet).success);
    ck("old-shaped EngagedAccountRaw still validates", EngagedAccountRawSchema.safeParse(oldEngaged).success);
  }

  // --- 2. live provider: media normalization ------------------------------
  {
    const media = [
      { type: "photo", media_url_https: "https://pbs/img.jpg" },
      { type: "video", media_url_https: "https://pbs/thumb.jpg", video_info: { variants: [] } },
      { type: "sticker", media_url_https: "https://pbs/junk.jpg" }, // unknown type -> skipped
      "garbage", // non-object -> skipped
    ];
    const p = tw.createTwitterApiProvider({ apiKey: "k", fetchImpl: fetchReturning({ status: "success", data: { tweets: [tweet(1, { extendedEntities: { media } }), tweet(2)] }, has_next_page: false, next_cursor: "" }) });
    const posts = await p.getUserTweets("acme", 10);
    const m = posts[0].media;
    ck("photo mapped to media[].url", m && m.length === 2 && m[0].type === "photo" && m[0].url === "https://pbs/img.jpg");
    ck("video mapped to media[].previewUrl (thumbnail)", m && m[1].type === "video" && m[1].previewUrl === "https://pbs/thumb.jpg" && m[1].url === undefined);
    ck("unknown/garbage media items skipped", m.length === 2);
    ck("tweet without entities has no media field", posts[1].media === undefined);
    ck("enriched tweets still schema-valid", TweetSchema.array().safeParse(posts).success);
  }

  // --- 3. live provider: reply/quote text carried, bounded, surrogate-safe -
  {
    const long = "a".repeat(497) + "xy" + "\u{1F680}" + "tail"; // rocket emoji straddles the 500-char cut
    const p = tw.createTwitterApiProvider({ apiKey: "k", fetchImpl: fetchReturning({ status: "success", data: { tweets: [tweet(5, { text: "great thread, the funding data checks out" }), tweet(6, { text: long })] }, has_next_page: false, next_cursor: "" }) });
    const eng = await p.getTweetReplies("t1", 10);
    ck("reply text carried into EngagedAccountRaw", eng[0].text === "great thread, the funding data checks out");
    ck("long reply text truncated to 500", typeof eng[1].text === "string" && eng[1].text.length <= 500);
    ck("no lone surrogate after boundary truncation", !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(eng[1].text));
    ck("enriched engaged accounts schema-valid", EngagedAccountRawSchema.array().safeParse(eng).success);
  }
  {
    const p = tw.createTwitterApiProvider({ apiKey: "k", fetchImpl: fetchReturning({ status: "success", data: { tweets: [tweet(7, { text: "quoting this — real yield indeed" })] }, has_next_page: false, next_cursor: "" }) });
    const eng = await p.getTweetQuotes("t1", 10);
    ck("quote text carried into EngagedAccountRaw", eng[0].text === "quoting this — real yield indeed" && eng[0].source === "QUOTE");
  }
  {
    const p = tw.createTwitterApiProvider({ apiKey: "k", fetchImpl: fetchReturning({ status: "success", data: { users: [user(1)] }, has_next_page: false, next_cursor: "" }) });
    const eng = await p.getTweetRetweeters("t1", 10);
    ck("retweeters carry no text", eng.length === 1 && eng[0].text === undefined);
  }

  // --- 4. mock provider mirrors the enrichment ----------------------------
  {
    const mock = tw.createMockTwitterProvider();
    const replies = await mock.getTweetReplies("mock:tweet:kol:0", 16);
    const quotes = await mock.getTweetQuotes("mock:tweet:kol:0", 5);
    const rts = await mock.getTweetRetweeters("mock:tweet:kol:0", 5);
    ck("mock replies all carry text", replies.length === 16 && replies.every((e) => typeof e.text === "string" && e.text.length > 0));
    ck("mock quotes carry text", quotes.every((e) => typeof e.text === "string"));
    ck("mock retweeters carry no text", rts.every((e) => e.text === undefined));
    const junk = replies.filter((e) => /🚀🚀🚀|GIVEAWAY|wen airdrop/i.test(e.text));
    ck("mock reply texts span junk + substantive signals", junk.length >= 2 && replies.some((e) => /contracts|integrated|LPing/i.test(e.text)));
    const posts = await mock.getUserTweets("kol", 12);
    ck("mock posts include photo + video media fixtures", posts.some((t) => t.media?.some((m) => m.type === "photo")) && posts.some((t) => t.media?.some((m) => m.type === "video")));
    ck("mock enriched output schema-valid", EngagedAccountRawSchema.array().safeParse(replies).success && TweetSchema.array().safeParse(posts).success);
    const again = await mock.getTweetReplies("mock:tweet:kol:0", 16);
    ck("mock enrichment deterministic", JSON.stringify(again) === JSON.stringify(replies));
  }

  // --- 5. collectEngagedAccounts: appearances + unchanged dedupe/cap -------
  {
    const acct = (id, tweetId, source, text) => ({ user: { id, handle: `h${id}` }, tweetId, source, ...(text ? { text } : {}) });
    // A engages post1 (reply) and post2 (quote); B replies post1 twice (same
    // tweet -> still 1 appearance); C retweets post2.
    const groups = [
      [acct("A", "p1", "REPLY", "gm"), acct("B", "p1", "REPLY", "nice")],
      [acct("B", "p1", "REPLY", "nice again")],
      [acct("A", "p2", "QUOTE", "quoting"), acct("C", "p2", "RETWEET")],
    ];
    const out = collectEngagedAccounts(groups, 100);
    const byId = Object.fromEntries(out.map((a) => [a.user.id, a]));
    ck("appearances counts distinct posts (A=2)", byId.A.appearances === 2);
    ck("same-post duplicates don't inflate (B=1)", byId.B.appearances === 1);
    ck("single engagement gets appearances=1 (C)", byId.C.appearances === 1);
    ck("first occurrence wins source/text (A kept REPLY + its text)", byId.A.source === "REPLY" && byId.A.text === "gm");
    ck("dedupe unchanged (3 unique)", out.length === 3);
    // Cap: only ADDING stops; counting continues past the cap.
    const capped = collectEngagedAccounts(groups, 1);
    ck("cap respected (1 kept)", capped.length === 1 && capped[0].user.id === "A");
    ck("appearance counting continues past cap (A=2)", capped[0].appearances === 2);
    ck("capped output schema-valid", EngagedAccountRawSchema.array().safeParse(capped).success);
  }

  console.log(`\nDATA ENRICHMENT REGRESSION (29A): ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
