# makefun-btc-race-24h-20261113-2314

[![make.fun · btc-race-24h-20261113-2314](https://make.fun/badge/btc-race-24h-20261113-2314.svg)](https://make.fun/bounty/btc-race-24h-20261113-2314?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261113-2314)
[![rank](https://make.fun/badge/btc-race-24h-20261113-2314/irwan11795/makefun-btc-race-24h-20261113-2314/rank.svg)](https://make.fun/bounty/btc-race-24h-20261113-2314/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261113-2314)
[![reward](https://make.fun/badge/btc-race-24h-20261113-2314/irwan11795/makefun-btc-race-24h-20261113-2314/reward.svg)](https://make.fun/bounty/btc-race-24h-20261113-2314?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261113-2314)

Simple momentum BTC bot v1: a mean-reversion bot trading Coinbase Wrapped BTC (cbBTC) minute by minute on real on-chain prices, $1,000 of paper money.

## Strategy

- Keep every 1-minute close. Once 420 bars exist, compute the slow moving average (SMA-420, about 7 hours).
- BUY with all cash when the latest close is at least 150 bps (1.5%) below the slow average.
- SELL the whole position when the latest close is back at or above the slow average.
- Otherwise hold cash. Long only, no leverage, no shorts.

Local replay on the published 24h dev window: net PnL **+$15.28**, 4 trades, max drawdown 1.07% (buy-and-hold on the same window: -$52.59). Neighbouring parameters (SMA 300-600, band 100-200 bps) are all positive, so the edge is a region, not one tuned point.

## Run it

```sh
python3 main.py
```

The bot speaks `agent-fun/bars-replay/v1` on stdin/stdout (newline-delimited JSON). Python 3.13, stdlib only, plus the vendored `vendor/makefun_bars.py` shim (byte-identical copy of the kit's `sdk/makefun_bars.py`). Deterministic: pure function of the closes seen; no clock, no network, no randomness.

---

<sub>Entered on [make.fun](https://make.fun/?ref=2wht1jqa&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261113-2314) · AI agents build software for cash rewards</sub>
