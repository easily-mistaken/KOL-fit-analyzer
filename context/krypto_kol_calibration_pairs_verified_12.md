**Crypto KOL Fit Analyzer**

**Verified 12-Pair Calibration Set**

**Purpose:** Use these human-labeled pairs to tune scoring behavior, verdict anchors, and analysis explanations. These are calibration labels, not final objective truth. Live engaged-audience data should still be used before campaign decisions.

**Verification note:** This is a newly generated file with a new filename. It explicitly contains all 12 pairs, including the six that were previously questioned: Jupiter x Meow, EigenLayer x Sreeram, Phantom x Anatoly, Ledger x ZachXBT, MetaMask x Bankless, and Ethena x The DeFi Investor.

# 1\. What this set is designed to teach the algorithm

- Separate relationship/authority fit from engaged-audience fit. Founder/core-team pairs should not collapse to WEAK only because public replies are noisy.
- Separate adjacent ecosystem authority from direct org authority. Famous crypto people should not become STRONG for every related product.
- Separate broad crypto reach from targeted product fit. News/media attention can be useful for awareness but weak for conversion.
- Map target audience buckets by product category. Infrastructure, wallets, security, DeFi, and media should not all reward the same buckets.
- Make campaign goal change the verdict. Builder adoption, retail awareness, wallet education, and direct conversion are different outcomes.

# 2\. Executive calibration table

| **#** | **Pair**                       | **Expected verdict** | **Calibration role**                                                           | **Primary scoring lesson**                                                                                                                                     |
| ----- | ------------------------------ | -------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | @Uniswap x @haydenzadams       | STRONG               | Direct founder/core-authority fit                                              | Add a founder/core-team authority modifier or verdict floor, unless severe brand-safety risk is present.                                                       |
| 2     | @chainlink x @SergeyNazarov    | STRONG               | Direct founder + infrastructure authority fit                                  | Infrastructure projects should not be punished just because the audience is less trader/meme-heavy.                                                            |
| 3     | @base x @jessepollak           | STRONG / GOOD        | Creator/operator ecosystem fit                                                 | Campaign goal must materially change verdict. Same pair can be STRONG for builders and GOOD for broad awareness.                                               |
| 4     | @Uniswap x @VitalikButerin     | GOOD                 | Adjacent ecosystem authority, not org-specific authority                       | Distinguish adjacent authority from direct authority. Fame plus crypto relevance should not automatically mean STRONG.                                         |
| 5     | @Aave x @haydenzadams          | OKAY / GOOD          | Same broad DeFi vertical, different product intent                             | Avoid the lazy rule: crypto + crypto = high fit. Separate DeFi sub-intents.                                                                                    |
| 6     | @Uniswap x @WatcherGuru        | WEAK / OKAY          | Broad crypto media reach versus targeted product fit                           | Do not mistake reach for fit. Separate attention from high-intent product audience.                                                                            |
| 7     | @JupiterExchange x @weremeow   | STRONG               | Direct founder/ecosystem authority fit for a Solana trading product            | Add an ecosystem-founder override beyond generic audience match. Solana-native authority matters when the org is Solana-native.                                |
| 8     | @eigenlayer x @sreeramkannan   | STRONG               | Direct founder + technical/research authority fit for restaking infrastructure | For deep infrastructure, quality developers/protocol operators can outweigh broad retail attention.                                                            |
| 9     | @phantom x @aeyakovenko        | GOOD                 | Adjacent ecosystem authority for a Solana-origin wallet                        | Adjacent chain-founder authority should boost the verdict but not replace product-specific audience evidence.                                                  |
| 10    | @Ledger x @zachxbt             | GOOD                 | Security/trust authority fit for a hardware wallet                             | Security authority can be highly valuable even without product-category founder status. But the analysis must distinguish trust education from paid promotion. |
| 11    | @MetaMask x @BanklessHQ        | GOOD / OKAY          | Broad Ethereum/DeFi media fit for a self-custody wallet                        | Media fit should be useful but not automatically elite. The scorer should identify whether the audience is actually wallet-active.                             |
| 12    | @ethena_labs x @TheDeFinvestor | GOOD                 | Specialized DeFi analyst fit for a synthetic-dollar/yield product              | Specialized analyst accounts can be GOOD without being founder/core-team accounts. Live audience quality should decide whether it can upgrade.                 |

# 3\. Detailed pair notes

## 1\. @Uniswap x @haydenzadams - STRONG

**Calibration role:** Direct founder/core-authority fit

**Why this label makes sense:** Hayden Adams publicly identifies as the inventor of the Uniswap protocol and founder of Uniswap. This is the canonical example where founder authority must be a separate signal from noisy public engagement.

**Expected scoring behavior:** authority_fit very high; content_fit very high; campaign_goal_fit high. Noisy replies can reduce confidence or add a warning, but should not alone collapse the verdict to WEAK.

**Algorithm lesson:** Add a founder/core-team authority modifier or verdict floor, unless severe brand-safety risk is present.

## 2\. @chainlink x @SergeyNazarov - STRONG

**Calibration role:** Direct founder + infrastructure authority fit

**Why this label makes sense:** Sergey Nazarov is publicly described as a Chainlink co-founder and CEO of Chainlink Labs. This pair calibrates serious oracle/infrastructure relevance, where developers, protocols, founders, and institutions matter more than retail hype.

**Expected scoring behavior:** authority_fit very high; technical_authority_fit very high; reward developer, founder, infra, research, protocol, and institutional buckets.

**Algorithm lesson:** Infrastructure projects should not be punished just because the audience is less trader/meme-heavy.

## 3\. @base x @jessepollak - STRONG / GOOD

**Calibration role:** Creator/operator ecosystem fit

**Why this label makes sense:** Jesse Pollak is publicly described as the creator of Base and Head of Protocols at Coinbase. This is very strong for Base ecosystem, builder, and consumer-onchain campaigns.

**Expected scoring behavior:** authority_fit very high; STRONG for builder/community/ecosystem campaigns; GOOD for broad retail awareness if audience is less product-specific.

**Algorithm lesson:** Campaign goal must materially change verdict. Same pair can be STRONG for builders and GOOD for broad awareness.

## 4\. @Uniswap x @VitalikButerin - GOOD

**Calibration role:** Adjacent ecosystem authority, not org-specific authority

**Why this label makes sense:** Vitalik Buterin is deeply relevant to Ethereum and crypto, and Uniswap is Ethereum/DeFi-native. But he is not Uniswap core team, so this is adjacent authority rather than direct authority.

**Expected scoring behavior:** authority_fit high but adjacent; content_fit high; high for credibility/awareness, lower for direct Uniswap user acquisition.

**Algorithm lesson:** Distinguish adjacent authority from direct authority. Fame plus crypto relevance should not automatically mean STRONG.

## 5\. @Aave x @haydenzadams - OKAY / GOOD

**Calibration role:** Same broad DeFi vertical, different product intent

**Why this label makes sense:** Aave and Uniswap both live in DeFi, but lending/borrowing/money-market users are not identical to DEX/AMM traders or LPs. Useful for broad DeFi awareness, not automatically direct Aave acquisition.

**Expected scoring behavior:** authority_fit medium/adjacent; content_fit medium-high; GOOD for broad DeFi awareness, OKAY for Aave-specific borrower/lender adoption unless live audience data proves strong overlap.

**Algorithm lesson:** Avoid the lazy rule: crypto + crypto = high fit. Separate DeFi sub-intents.

## 6\. @Uniswap x @WatcherGuru - WEAK / OKAY

**Calibration role:** Broad crypto media reach versus targeted product fit

**Why this label makes sense:** WatcherGuru is broad crypto/finance media. It may provide visibility, but broad news attention is not the same as Uniswap-native users, LPs, governance participants, builders, or high-intent traders.

**Expected scoring behavior:** authority_fit low; content_fit medium; audience_match mixed. OKAY for broad awareness, WEAK for targeted adoption/conversion unless engaged audience proves strong DeFi user quality.

**Algorithm lesson:** Do not mistake reach for fit. Separate attention from high-intent product audience.

## 7\. @JupiterExchange x @weremeow - STRONG

**Calibration role:** Direct founder/ecosystem authority fit for a Solana trading product

**Why this label makes sense:** Meow is publicly tied to Jupiter as founder/ecosystem voice. For Jupiter Exchange, this is a direct authority anchor around routing, swaps, liquidity, community, product launches, and Solana-native trading.

**Expected scoring behavior:** authority_fit very high; content_fit very high; reward Solana traders, Jupiter users, DeFi users, routing/swap users, LPs, and ecosystem builders.

**Algorithm lesson:** Add an ecosystem-founder override beyond generic audience match. Solana-native authority matters when the org is Solana-native.

## 8\. @eigenlayer x @sreeramkannan - STRONG

**Calibration role:** Direct founder + technical/research authority fit for restaking infrastructure

**Why this label makes sense:** Sreeram Kannan is publicly described as Founder of EigenLayer and CEO of Eigen Labs. This is a strong anchor for restaking, AVS, Ethereum security, protocol-builder, validator, and infra audiences.

**Expected scoring behavior:** authority_fit very high; technical_authority_fit very high; reward developers, researchers, validators, protocol teams, Ethereum infra, staking/restaking, and AVS builders.

**Algorithm lesson:** For deep infrastructure, quality developers/protocol operators can outweigh broad retail attention.

## 9\. @phantom x @aeyakovenko - GOOD

**Calibration role:** Adjacent ecosystem authority for a Solana-origin wallet

**Why this label makes sense:** Phantom has strong Solana origins and positioning, while Anatoly Yakovenko is Solana co-founder. He is not Phantom core team, so this is strong adjacent ecosystem fit, not direct authority.

**Expected scoring behavior:** authority_fit high but adjacent; campaign_goal_fit high for Solana user acquisition, ecosystem credibility, and wallet adoption; lower for Phantom-specific product education unless live data proves wallet-user overlap.

**Algorithm lesson:** Adjacent chain-founder authority should boost the verdict but not replace product-specific audience evidence.

## 10\. @Ledger x @zachxbt - GOOD

**Calibration role:** Security/trust authority fit for a hardware wallet

**Why this label makes sense:** Ledger is a hardware-wallet/security product, while ZachXBT is widely known for crypto investigations and scam/theft tracing. This is not direct Ledger authority, but it is a strong trust/security-audience fit.

**Expected scoring behavior:** authority_fit medium-high as independent security authority; brand_safety should be handled carefully because investigative accounts can bring hard questions; reward security-aware wallet users and self-custody audiences.

**Algorithm lesson:** Security authority can be highly valuable even without product-category founder status. But the analysis must distinguish trust education from paid promotion.

## 11\. @MetaMask x @BanklessHQ - GOOD / OKAY

**Calibration role:** Broad Ethereum/DeFi media fit for a self-custody wallet

**Why this label makes sense:** MetaMask is a major self-custody wallet and Bankless is broad Ethereum/DeFi media. This is good for education and awareness, but not necessarily direct wallet-conversion quality unless engaged accounts show wallet users or DeFi power users.

**Expected scoring behavior:** content_fit high; authority_fit low-medium; engaged_audience_match should decide GOOD versus OKAY; reward Ethereum users, DeFi users, wallet users, token traders, and builders.

**Algorithm lesson:** Media fit should be useful but not automatically elite. The scorer should identify whether the audience is actually wallet-active.

## 12\. @ethena_labs x @TheDeFinvestor - GOOD

**Calibration role:** Specialized DeFi analyst fit for a synthetic-dollar/yield product

**Why this label makes sense:** Ethena is a DeFi/synthetic-dollar protocol, while The DeFi Investor publicly positions around DeFi updates and crypto strategies. This is a strong topical fit for DeFi-native education and yield/stablecoin narratives.

**Expected scoring behavior:** content_fit high; campaign_goal_fit high for DeFi users, stablecoin/yield education, and protocol awareness; authority_fit medium because the KOL is not core team.

**Algorithm lesson:** Specialized analyst accounts can be GOOD without being founder/core-team accounts. Live audience quality should decide whether it can upgrade.

# 4\. Scoring-system rules to add or tune

- Add authority_fit / relationship_fit as a separate modifier, not just another diluted weighted metric.
- Founder, inventor, CEO, or core-team relationship: strong positive authority signal; noisy audience should lower confidence or create warnings, not automatically collapse verdict.
- Adjacent ecosystem authority: positive boost, but still require audience and campaign-goal evidence before STRONG.
- Media/news accounts: useful for awareness, but require engaged-audience proof before scoring as high conversion fit.
- For infrastructure products, reward developer, protocol, validator, researcher, security, and founder buckets more than retail-trader buckets.
- For wallets and security products, reward self-custody, wallet users, DeFi power users, and security-aware audiences.
- For DeFi yield/stablecoin products, reward DeFi analysts, stablecoin/yield users, onchain traders, and risk-aware investors.
- Verdict should depend on campaign goal: awareness, credibility, developer adoption, wallet education, user acquisition, or direct conversion.

# 5\. Verified presence checklist

- \[x\] @Uniswap x @haydenzadams
- \[x\] @chainlink x @SergeyNazarov
- \[x\] @base x @jessepollak
- \[x\] @Uniswap x @VitalikButerin
- \[x\] @Aave x @haydenzadams
- \[x\] @Uniswap x @WatcherGuru
- \[x\] @JupiterExchange x @weremeow
- \[x\] @eigenlayer x @sreeramkannan
- \[x\] @phantom x @aeyakovenko
- \[x\] @Ledger x @zachxbt
- \[x\] @MetaMask x @BanklessHQ
- \[x\] @ethena_labs x @TheDeFinvestor

# 6\. Public source notes used for relationship/product context

- Hayden Adams / Uniswap: Hayden Adams LinkedIn and X profile snippets describe him as inventor of the Uniswap protocol and founder of Uniswap.
- Sergey Nazarov / Chainlink: Chainlink and Sergey Nazarov public profiles describe him as co-founder of Chainlink and CEO of Chainlink Labs.
- Jesse Pollak / Base: Blockworks and ETHDenver speaker profiles describe Jesse Pollak as creator of Base and connected to Coinbase protocol/onchain efforts.
- Vitalik Buterin / Ethereum: public Ethereum/history references and profile sources describe Vitalik as Ethereum founder/co-founder/public face.
- Stani Kulechov / Aave: public profile sources describe Stani as Founder & CEO of Aave.
- WatcherGuru: public website/profile snippets describe WatcherGuru as broad crypto/finance media/news.
- Jupiter / Meow: public Jupiter/Solana community references identify Meow as founder/ecosystem voice for Jupiter.
- Sreeram Kannan / EigenLayer: Blockworks and public profiles describe Sreeram as Founder of EigenLayer and CEO of Eigen Labs.
- Anatoly Yakovenko / Solana: public profiles describe Anatoly as co-founder of Solana.
- Ledger: Ledger public website positions Ledger as a hardware wallet/security product.
- ZachXBT: public reporting describes ZachXBT as a crypto investigator tracing scams and thefts.
- MetaMask: MetaMask public website describes it as a self-custody crypto wallet and DeFi access layer.
- Bankless: Bankless public site describes itself as crypto, DeFi, and blockchain media.
- Ethena: Ethena docs describe Ethena as a synthetic-dollar protocol issuing USDe/sUSDe.
- The DeFi Investor: public X snippets describe the account as sharing DeFi updates and crypto strategies.