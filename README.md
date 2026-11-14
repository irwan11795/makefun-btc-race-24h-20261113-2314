# BTC race bot v5 — range-dip gate widened to −2.00% (race-window robustness)

Washout + range-dip BTC bot for make.fun `btc-race-24h-20261113-2314`.

## What v5 changes vs v4

One thing: the range-dip gate is widened from −1.50% to **−2.00%**
(`RANGE_GATE_BPS` −150 → −200). Everything else is identical to v4
(washout exit +2.50%, washout hold 500, range SMA-90, lo 1.00%, hi 0.60%).

## Why the gate, and what it does (and does not) change

**On dev, v5 is byte-identical to v4.** The official action log is the
same (buy 406, sell 860, buy 982, sell 1108, same quantities), the same
`action_log_sha256`, the same `result_sha256`, and the same net PnL
**+$33.160650**. The gate change does not touch any dev trade.

The reason is timing. On dev the range-dip signal fires at bars 982–983
with gate −1.50% (r240 is −142 bps at bar 982, just inside the gate).
With gate −2.00% the signal window widens to bars 982–988 and 990
(r240 drifts to −165 bps by bar 986), but the bot already bought at 982,
so the extra signal bars are while holding and change nothing.

**In the unseen race window the wider gate gives the range dip more
chances to fire.** If the race window's dip arrives while the 240-bar
return is between −2.00% and −1.50% (a slightly stronger downtrend than
dev's −1.42%), v4's gate blocks it and v5's lets it through. That is the
whole point: v5 is strictly less likely to sit out a dip for a gate
reason, at zero cost on dev. The extra trades it could catch are
unvalidated (they never occur on dev), so this is a mild robustness
improvement, not a proven edge — v5 does NOT beat v4, it ties v4 on dev
and widens the trigger a little for the race window.

**Gate −2.50% was tested and REJECTED.** It adds a new losing trade:
range-dip signal bars appear at 242 and 245 (early decline), the bot
buys into the falling market and loses money — backtester −$19.29 vs
+$31.12. So −2.00% is the widest safe gate; −2.50% crosses into
buying-the-decline territory.

## Strategy

Long only, one position, whole equity per trade, bigint integer math only,
deterministic, no network.

1. **Washout**: 240-bar return ≤ −4.00% → buy; sell at +2.50% over cost,
   stop −3.00%, or after 500 bars.
2. **Range dip**: 240-bar return > −2.00% and close ≥1.00% below the
   90-bar SMA → buy; sell when close is back 0.60% above that SMA,
   stop −2.50%, or after 360 bars.

Every order caps slippage at 100 bps from the latest close.

## Dev grade (official harness)

Run: `node cli/makefun.mjs grade-local --kit <kit> --bot <this dir>
--driver process --save <v5-grade> --json` — see `V5-CHALLENGER.md`
for the exact result.

v5 officially TIES v4 at **+$33.160650** (return 3.316%, 4 trades,
win rate 1.0, max drawdown 1.07%, fees 1.632701 USDC, exposure 0.4028,
Sharpe 0.05596; at 2x fees +$31.512913). Guardrails met. L1 regrade
reproduced. `action_log_sha256`
8f899b692103290b89388c1abfdc2dceb0f0d9a3e0fe24c629374c2be7905226 and
`result_sha256`
dd4e8431100584d68f41394a1c21929032f22f90b693e3328f6409fbee65e25e are
IDENTICAL to v4's. The dev window is fully mined: both trades already
buy the low bar and sell at/near the peak, and no third trade exists.

## What was tested and rejected for v5 (dev is mined out)

- **Washout exit +2.60%**: gives a LOWER fill, not higher. Exit +2.50%
  triggers at bar 860 (close 69,876 ≥ 69,825) and fills at bar 861 open
  $69,866. Exit +2.60% needs close ≥ $69,893, triggers at bar 861
  (close 69,910) and fills at bar 862 open $69,836 — $30 LOWER, because
  bar 862 opens down. REJECTED.
- **Washout exit +2.65%**: triggers at bar 865 (the peak close 69,948
  ≥ 69,927) and fills at bar 866 open $69,891 — only +$25 (+$0.25) over
  +2.50%, with just $21 of headroom below the peak close. One slightly
  lower peak in the race window and it never triggers. REJECTED as
  not worth the cliff risk for a quarter.
- **Range buy lo 112–120**: never fires. The dip reaches −113 bps at
  bars 986–987, but by then r240 has drifted to −165 bps and the gate
  (even at −2.00%) is closed — the bot misses the lower entry entirely
  and the range trade disappears (backtester +$21.99, 2 trades).
  lo 100–111 all fire at bar 982 and are identical.
- **Range gate −2.50%**: adds a losing trade at bars 242/245
  (backtester −$19.29). REJECTED.
- **Mid-dip third trigger** (SMA-30/60/90/120, various dip/exit/stop):
  either never fires (bot already holding) or fires a losing trade
  (+$10.16 down to −$7.46 backtester). REJECTED.
- **Whole strategy families as standalone** (all backtester, all
  negative or zero on dev): EMA 8/21 cross −$40 to −$144; RSI +
  Bollinger −$42 to −$80; dip-buying −$4 to −$64; Bollinger snap
  −$102 to −$159; slow trend −$27 to −$28; mean-reversion to SMA-600
  0 trades; breakout 0 trades; washout-bounce −$13.11. REJECTED.
- **Partial exits** (sell half at +1.80%, half at +2.50%): locks in
  less on dev (−$5 vs all-in at +2.50%) for a weak-recovery benefit
  the hold-500 already covers. REJECTED.
- **Tighter stops** (−2.00% washout): never bind on dev, but more
  likely to cut a real recovery short in the race window. REJECTED.
- **Early-washout / quiet-window fallback triggers**: unvalidated on
  dev (never fire there); any fallback trade is a guess with negative
  expected value on the evidence available. NOT added.

## Files

- `main.ts` — the bot (TypeScript, Node 22, type-stripping-safe)
- `vendor/makefun-bars.ts` — byte-identical kit SDK shim
- `LICENSE` — MIT
