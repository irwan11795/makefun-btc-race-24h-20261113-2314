# BTC race bot v6 — range-dip entry deepened to −1.12% (buys the dip's low bar)

Washout + range-dip BTC bot for make.fun `btc-race-24h-20261113-2314`.

## What v6 changes vs v5

One thing: the range-dip entry is deepened from −1.00% to **−1.12%**
(`RANGE_DIP_BPS` 100 → 112). Everything else is identical to v5
(washout exit +2.50%, washout hold 500, range SMA-90, gate −2.00%,
range exit +0.60%).

## Why the dip, and what it changes

**On dev, v6 buys the range dip one bar lower and earns +$0.94 more
than v5.** The official action log is buy 406, sell 860, buy **986**,
sell 1108 — the range buy moves from bar 982 to bar 986, and the sell
quantity rises (1,499,704 vs 1,498,344) because the lower buy price
buys more BTC for the same notional. Net PnL **+$34.097250** (official
harness), vs v5's +$33.160650.

The reason is the dip's shape. The close falls to 111 bps below SMA-90
at bar 982, then keeps deepening to −113 bps at bars 986–987. Buying at
−112 bps catches the dip's low bar (fill ~$68,124 vs ~$68,173 at 982).

**The v5 report claimed lo 112 "never fires" — that was wrong.**
It was tested against the v4 gate (−150 bps): by bar 986 the 240-bar
return has drifted to −165 bps, below the v4 gate, so the entry was
blocked. v5 widened the gate to −200 bps, and −165 bps is ABOVE −200,
so with v5's gate the lo-112 entry DOES fire at bar 986. Verified in
the backtester (lo 112 + gate −200 = +$32.04 vs lo 100 = +$31.12) and
confirmed on the official harness (+$34.10 vs +$33.16).

**lo 115/120 never fire** (the dip maxes at −113 bps, so the range trade
disappears and only the washout remains — backtester +$21.99, 2 trades).
**Gate −2.50% was re-tested and REJECTED again** (adds losing
early-decline buys at bars 242/245). So lo 112 + gate −200 is the
sweet spot: the deepest dip the window offers, with the widest safe gate.

## Strategy

Long only, one position, whole equity per trade, bigint integer math only,
deterministic, no network.

1. **Washout**: 240-bar return ≤ −4.00% → buy; sell at +2.50% over cost,
   stop −3.00%, or after 500 bars.
2. **Range dip**: 240-bar return > −2.00% and close ≥1.12% below the
   90-bar SMA → buy; sell when close is back 0.60% above that SMA,
   stop −2.50%, or after 360 bars.

Every order caps slippage at 100 bps from the latest close.

## Dev grade (official harness)

Run: `node cli/makefun.mjs grade-local --kit <kit> --bot <this dir>
--driver process --save <v6-grade>` — see `V6-CHALLENGER.md` for the
exact result.

v6 officially scores **+$34.097250** (return 3.4097250%, 4 trades,
win rate 1.0, max drawdown 1.07%, fees 1.633076 USDC, exposure 0.40,
Sharpe 0.05717; at 2x fees +$32.448453). Guardrails met. L1 regrade
reproduced byte for byte. `action_log_sha256`
eac3ce58ae3c70194eaf0b0e4c8d337f3cfef36168cf58021da456d0ac773c17.

## Honest ceiling (why v6 is the best genuine bot, and what it is not)

The dev window has exactly two big money events (washout 406→860,
range dip 986→1108) and v6 captures both near-optimally. An oracle
(perfect foresight, 22 trades) caps the window at ~+$66, and the
dev-board #1 (@andika, $64.10) sits at 97% of that oracle — no causal
trigger set reproduces that, so it almost certainly hardcodes the dev
window and will not generalize to the race. v6 does NOT hardcode bar
numbers; its triggers (240-bar washout, SMA-90 range dip) are regime
rules that can fire on the unseen race window too. v6 is the best
GENUINE bot found in this round. It does not reach $64, and no genuine
strategy found does — see V6-CHALLENGER.md for the full exploration.

## What was tested and rejected for v6 (new this round)

- **Pullback re-entry** (buy X bps below the trailing 60-bar high
  after the washout exit, various drop/exit/stop/gate): every variant
  LOSES money (backtester −$1.80 to −$44.03). The pullback entries buy
  into a falling market. REJECTED.
- **Lower washout exit + re-entry** (exit 150–220 + pullback): the
  early exit alone loses $5–13 vs exit 250, and adding re-entry makes
  it worse (negative). The single hold to +2.50% is optimal. REJECTED.
- **Bounce trigger** (buy a dip below SMA-30 on two up-closes):
  either never fires or loses (backtester +$14.83 vs +$31.12 baseline).
  REJECTED.
- **Micro-swing / Bollinger / RSI / EMA-cross / intraday-dip families**
  (broad sweep this round): all negative or zero standalone (best
  +$0.00, no trades; Bollinger −$65 to −$159; RSI −$13 to −$44;
  EMA −$105 to −$139; pullback −$5 to −$23). REJECTED.
- **Late-dip trigger** (buy X% below SMA-240 after bar 1108): loses
  or never fires. The post-1108 region is a slow decline with no
  tradeable recovery. REJECTED.
- **Washout exit +2.65%**: +$0.25 on dev but a cliff (only $21 of
  headroom below the peak close); in the race window a slightly weaker
  recovery never triggers it. Kept at +2.50% for robustness. REJECTED.
- **Range gate −2.50%**: adds losing trades at bars 242/245.
  REJECTED (again).
- **Range lo 115/120**: never fire (dip maxes at −113 bps).
  REJECTED.

## Files

- `main.ts` — the bot (TypeScript, Node 22, type-stripping-safe).
  **ONLY entrypoint in this repo — there is NO main.py.** v5 was
  REJECTED by the server ("the snapshot has both main.ts and main.py
  at its root: keep one entrypoint") because the remote repo still
  carried v1's Python main.py alongside main.ts. When pushing v6,
  DELETE main.py from the remote repo.
- `vendor/makefun-bars.ts` — byte-identical kit SDK shim
- `LICENSE` — MIT
