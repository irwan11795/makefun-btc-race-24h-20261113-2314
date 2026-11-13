"""Simple momentum BTC bot v1 — mean-reversion vs a slow moving average.

Strategy (long only, one asset CBBTC, $1,000 paper):
- Keep the closes of every 1-minute bar.
- Once 420 bars of history exist, compute the slow moving average (SMA-420,
  about 7 hours) of the closes.
- BUY (all cash) when the latest close is at least 150 bps (1.5%) BELOW the
  slow average: the market has dipped well under its 7-hour mean.
- SELL (whole position) when the latest close is back AT or ABOVE the slow
  average: the dip has mean-reverted.
- Otherwise do nothing. No orders during warm-up, no orders without a bar.

Why this shape: the dev window falls ~5% over 24h with sharp intraday
bounces, so holding BTC loses money and trend-following gets whipsawed;
buying a 1.5% dip under the 7-hour mean and selling the reversion to the
mean caught the two real bounces (+$15.28 on the dev window in local replay,
4 trades, max drawdown 1.07%). Neighbouring parameters (SMA 300-600,
band 100-200 bps) are all positive on the same window, so the edge is a
region, not one tuned point.

Deterministic: pure function of the closes seen; no clock, no network, no
randomness, no files outside the repo. Stdlib only, plus the vendored
makefun_bars shim (byte-identical copy of the kit's sdk/makefun_bars.py).
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor"))
import makefun_bars

SYMBOL = "CBBTC"
SLOW = 420            # bars in the slow moving average (about 7 hours)
BAND_BPS = 150        # buy when close is this far (bps) below the slow average
MAX_SLIPPAGE_BPS = 10000  # wide open, like the kit baselines
MIN_NOTIONAL = 1000000    # 1 USDC in quote units, per the harness caps

closes = []


def on_batch(state, batch):
    # Record this bar's close, but only when the batch actually carries a bar
    # for CBBTC (a missing minute must not duplicate the previous close).
    if any(b.get("symbol") == SYMBOL for b in batch.get("bars", [])):
        c = state.close(SYMBOL)
        if c is not None:
            closes.append(c)
    if state.warming_up:
        return []
    if len(closes) < SLOW + 1:
        return []
    # Exact integer comparison (no float division): the slow average is
    # sum(closes[-SLOW:]) / SLOW, so
    #   buy  when last < slow_ma * (1 - BAND_BPS/10000)
    #        <=> last * 10000 * SLOW < slow_sum * (10000 - BAND_BPS)
    #   sell when last >= slow_ma
    #        <=> last * SLOW >= slow_sum
    # Integer math keeps the decision identical on every platform.
    slow_sum = sum(closes[-SLOW:])
    last = closes[-1]
    holding = state.positions.get(SYMBOL)
    if holding is None and last * 10000 * SLOW < slow_sum * (10000 - BAND_BPS):
        if state.cash >= MIN_NOTIONAL:
            return [{"side": "buy", "symbol": SYMBOL,
                     "notional_quote_units": state.cash,
                     "max_slippage_bps": MAX_SLIPPAGE_BPS}]
        return []
    if holding is not None and last * SLOW >= slow_sum:
        return [{"side": "sell", "symbol": SYMBOL, "qty": holding.qty,
                 "max_slippage_bps": MAX_SLIPPAGE_BPS}]
    return []


makefun_bars.run(on_batch)
