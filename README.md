# BTC Race Bot v15 — Washout Scalp + Higher-Low Rebuy + Range Scalp/Rebuy (Robustness Combination)

**Competition:** make.fun `btc-race-24h-20261113-2314` (entry deadline 2026-11-14 12:14 WIB; race 12:29 WIB 14 Nov – 12:29 WIB 15 Nov). Paper $1,000, cbBTC 1-minute bars, fee 4 bps + slippage 2 bps + impact. Long only, max one position, whole-equity trades.

**v15 = v13 + three changes** (combo A — the robustness combination):

1. **Washout rebuy TP 150 → 155 bps.** On clean the B leg's net value jumps past both levels in one bar (same sell bar 859), so clean is identical; on noise draws the higher TP exits one bar later at a higher value (+$2.31 on +3 bps seed 1, +$3.06 on +8 bps seed 5; −$0.29 on +8 bps seed 1). The B leg's net peak is +181.9 bps, so there is headroom above +150.
2. **Range rebuy dip 50 → 60 bps.** The clean pullback is 73 bps, so 60 fires at the same rebuy bar 1025 as 50 on clean; on noise draws the deeper dip buys lower (+$3.12 on +8 bps seed 5). Dip 70 never fires (the low condition is only met at the very bottom, after the turn condition has passed).
3. **Washout rebuy turn-up 3 → 2 bars.** Faster confirmation buys one bar earlier in some noise draws (+$1.92 on +3 bps seed 1, +$1.85 on +8 bps seed 5; −$1.16 on +3 bps seed 2). Turn 4 is worse (−$0.86 clean, buys B at 552 instead of 549).

Each change alone ties v13 on clean and beats v13 on the 13-scenario average; together they stack. The three changes touch three different legs (B TP, Q dip, B turn), so they do not fight each other.

## Backtester (faithful net-value sim) — clean dev window

- **PnL +$41.28, 8 trades** (v13: +$41.28, 8 trades — identical trades; v14: +$40.88; v12: +$39.96, 6 trades; v6: +$33.93)
- Trades (decision bars): buy 406 → sell 467 (washout scalp), buy 548 → sell 859 (washout rebuy), buy 986 → sell 1004 (range scalp, +80 bps), buy 1025 → sell 1108 (range rebuy, SMA exit)
- Robustness: **13/13 scenarios beat v6. Average +$38.62** (v13 +$37.75, v14 +$37.95, v12 +$37.33). **Worst margin over v6 +$4.21** (v13 +$1.65, v14 +$2.84, v12 +$2.83). vs v13 on the 13 scenarios: wins 7, loses 1 (−$0.51 on +8 bps seed 1), ties 5.
- Holdout (noise seeds 6–8, never used in selection): **6/6 beat v6, beats or ties v13 on all 6 (never loses)**, average +$36.58 vs v13's +$36.17. Combined 19 scenarios: average +$37.98 vs v13's +$37.25.

## Strategy (all bigint integer math, deterministic, stdlib + vendored shim only)

| Leg | Trigger | Exit |
|---|---|---|
| Washout scalp (W) | 240-bar return ≤ −4.00% | TP +1.50% / stop −3.00% / hold 500 / fallback 70 bars (arms rebuy) |
| Washout rebuy (B, max 1×) | low ≥1.00% below bounce peak close, r240 > −2.00%, close > close 2 bars ago, ≤300 bars after scalp exit | TP +1.55% / stop −3.00% / hold 500 |
| Range dip (R) | r240 > −2.00% and close ≥1.12% below SMA-90 | TP +0.80% (arms range rebuy) / SMA+0.60% / stop −2.50% / hold 360 |
| Range rebuy (Q, max 1×) | low ≥0.60% below range peak close, r240 > −2.00%, close > close 3 bars ago, ≤60 bars after range scalp exit | SMA+0.60% / stop −2.50% / hold 360 |

## Verification

- **Official harness:** grade-local `--driver process`, L1 regrade reproduced byte for byte — net PnL +$41.651268, 8 trades, win rate 1.0, max drawdown 0.54%, fees $3.28 (at 2× fees +$38.34). **Identical score to v13** (same trades, same fills — all three changes are no-ops on the clean window). Grade artifacts: `../v15-grade/`.
- **Backtester:** `../work/explore_v15b.py` (joint sweep + single-parameter screens), `explore_v15c.py` (hybrids + full13), `explore_v15d.py` (combinations), `explore_v15e.py` (combo E + holdout seeds 6–8) — full tables in `V15-CHALLENGER.md`.

## Files

- `main.ts` — the only entrypoint. **There is NO main.py in this repo** (v5 was REJECTED by the server because the remote repo still carried v1's Python main.py alongside main.ts; main.py was deleted from the remote for v6, commit 4a2344c7 — VERIFY it is still absent before pushing v15).
- `vendor/` — byte-identical kit shim (`makefun-bars.ts`).
- `LICENSE` — MIT.

## What was tested and rejected this round

- **Joint sweep range_tp 75/80 × tp_rebuy 145/150/155 × dip2 45/50/55:** nothing above +$41.28 on clean. tp_rebuy 145 is worse (+$39.25 at rtp 80, +$38.85 at rtp 75). tp_rebuy 155 ties 150 on clean — kept for its noise wins.
- **Slope-gated range TP** (TP drops to 75 when the 3-bar close rise < X bps): X=45/50 gives +$41.49 on clean (sells the range scalp at 997 instead of 1004) — but it is **FRAGILE: loses −$10.03 to v13 on holdout seed +3 bps s6**. Rejected. v14's +75 TP has the same fragility on that seed.
- **SMA-proximity hybrid** (TP drops to 75 when close is within P bps of the SMA+60 exit): P=50 fixes +3 bps s2 (+$2.60) but loses +3 bps s3 (−$1.79) and +8 bps s3 (−$0.92) — a wash on average (+$37.74 vs v13's +$37.75). P=30 is worse (loses 3 scenarios). Rejected alone; combined with combo A (combo B) it is worse than combo A alone (worst margin +$3.15 vs +$4.21).
- **Time-stepped TP** (TP drops to 75 after H bars held): same profile as prox 50 — a wash. Rejected.
- **RANGE_N 75/80/100/105:** 75/80 kill the range trade (+$29.92); 100/105 buy earlier but never scalp (+$37.70). 90 confirmed optimal.
- **Range gate −150:** kills the range trade (r240 at bar 986 is −165 bps). **Range gate −250: catastrophic −$16.00** — buys a falling-knife range leg at bar 246 and blocks the washout trade. The −200 gate is a hard structural boundary.
- **tp_scalp 140/145:** identical on clean (net value jumps past all levels in one bar). **dip2 70:** never fires (6 trades). **turn 4:** −$0.86 clean. **Q2 / washout second bite / partial exits:** re-confirmed dead (v13/v14 diagnostics hold; post-1108 range-trigger scan = 0 bars).

## Honest verdict

v15 **does NOT beat v13 on the graded dev window** — it ties it exactly (+$41.651268 official, byte-identical action log). The dev window is mined out: this round re-tested every remaining angle and none beats v13 on clean by more than $0.21, and that $0.21 (slope gate) is a fill-model artifact that loses $10 on unseen noise.

What v15 **does** do is dominate v13 on robustness with zero clean cost: 13-suite average +$38.62 (vs +$37.75), worst margin +$4.21 (vs +$1.65), and it beats or ties v13 on all 6 holdout seeds. For the **race window (unseen)**, v15 is strictly the better bot. For the **dev board rank**, v15 and v13 are identical (+$41.65, dev #2). The slot-3 choice between v13 and v15 is therefore a race-window bet, not a dev-score bet — and on every unseen-noise measure, v15 wins. **Do NOT submit — the slot-3 decision is the main agent's, in the last-hour window (~11:14–12:14 WIB).**
