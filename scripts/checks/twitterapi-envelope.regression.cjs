// Regression check for the Unit 18 live-run finding: TwitterAPI.io wraps list
// results under `data` (e.g. { status:"success", data:{ tweets:[...] }, has_next_page }),
// not top-level. The provider previously read `body.tweets`/`body.users` → 0 items.
// `arrayField` now tolerates data-wrapped AND top-level arrays.
//
// Run after `pnpm build`:  node scripts/checks/twitterapi-envelope.regression.cjs
// (or `pnpm check:twitterapi-envelope`). Injected fetch — no network, no keys.

const tw = require("../../packages/twitter/dist/index.js");
const {
  TweetSchema, EngagedAccountRawSchema, TwitterUserSchema,
} = require("../../packages/shared/dist/index.js");

let pass = 0, fail = 0;
const ck = (n, c) => { console.log((c ? "OK   " : "FAIL ") + n); c ? pass++ : fail++; };
const jsonResp = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { "content-type": "application/json" } });

// Real-shape fixtures (fields as returned live).
const user = (i) => ({ id: `u${i}`, userName: `user${i}`, name: `User ${i}`, description: `bio ${i}`, followers: 100 + i, following: 5, statusesCount: 200, isBlueVerified: false, createdAt: "2020-01-01T00:00:00Z", profilePicture: "https://x/p.jpg" });
const tweet = (i, isReply = false) => ({ id: `t${i}`, text: `tweet ${i}`, retweetCount: i, replyCount: i, likeCount: i, quoteCount: 0, viewCount: 10 * i, createdAt: "2020-01-01T00:00:00Z", lang: "en", isReply, quoted_tweet: null, author: user(i) });

const fetchReturning = (obj) => async () => jsonResp(obj);

(async () => {
  // 1. data-wrapped last_tweets (the exact live shape)
  {
    const p = tw.createTwitterApiProvider({ apiKey: "k", fetchImpl: fetchReturning({ status: "success", code: 0, msg: "success", data: { pin_tweet: null, tweets: [tweet(1), tweet(2)] }, has_next_page: false, next_cursor: "" }) });
    const posts = await p.getUserTweets("acme", 10);
    ck(`getUserTweets extracts data.tweets (len ${posts.length})`, TweetSchema.array().safeParse(posts).success && posts.length === 2);
  }
  // 2. data-wrapped retweeters (data.users)
  {
    const p = tw.createTwitterApiProvider({ apiKey: "k", fetchImpl: fetchReturning({ status: "success", data: { users: [user(1), user(2), user(3)] }, has_next_page: false, next_cursor: "" }) });
    const eng = await p.getTweetRetweeters("t1", 10);
    ck(`getTweetRetweeters extracts data.users (len ${eng.length})`, EngagedAccountRawSchema.array().safeParse(eng).success && eng.length === 3 && eng[0].source === "RETWEET");
  }
  // 3. data-wrapped tweet replies (data.tweets → engaged authors)
  {
    const p = tw.createTwitterApiProvider({ apiKey: "k", fetchImpl: fetchReturning({ status: "success", data: { tweets: [tweet(5)] }, has_next_page: false, next_cursor: "" }) });
    const eng = await p.getTweetReplies("t1", 10);
    ck(`getTweetReplies extracts data.tweets[].author (len ${eng.length})`, eng.length === 1 && eng[0].source === "REPLY" && eng[0].user.handle === "user5");
  }
  // 4. data-wrapped followers (data.followers)
  {
    const p = tw.createTwitterApiProvider({ apiKey: "k", fetchImpl: fetchReturning({ status: "success", data: { followers: [user(1)] }, has_next_page: false, next_cursor: "" }) });
    const fol = await p.getFollowers("acme", 10);
    ck(`getFollowers extracts data.followers (len ${fol.length})`, TwitterUserSchema.array().safeParse(fol).success && fol.length === 1);
  }
  // 5. user/info still works (data is the user object)
  {
    const p = tw.createTwitterApiProvider({ apiKey: "k", fetchImpl: fetchReturning({ status: "success", data: user(9), msg: "success" }) });
    const prof = await p.getUserProfile("acme");
    ck("getUserProfile reads data as the user object", prof && prof.handle === "user9");
  }
  // 6. backward-compat: top-level arrays still work
  {
    const p = tw.createTwitterApiProvider({ apiKey: "k", fetchImpl: fetchReturning({ tweets: [tweet(1)], has_next_page: false, next_cursor: "" }) });
    const posts = await p.getUserTweets("acme", 10);
    ck("top-level tweets[] still works (backward compat)", posts.length === 1);
  }

  console.log(`\nTWITTERAPI ENVELOPE REGRESSION: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
