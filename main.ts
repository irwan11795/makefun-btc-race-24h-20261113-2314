// Washout scalp + higher-low rebuy + range scalp/rebuy BTC bot v15 for
// make.fun btc-race-24h-20261113-2314.
//
// v15 = v13 + THREE changes (combo A -- the robustness combination):
//   (1) washout rebuy TP 150 -> 155 bps. On clean the B leg's net value
//       jumps past both levels in one bar (same sell bar 859), so clean
//       is identical; on noise draws the higher TP exits one bar later
//       at a higher value (+$2.31 on +3bps seed 1, +$3.06 on +8bps
//       seed 5; -$0.29 on +8bps seed 1). The B leg's net peak is +181.9
//       bps, so there is headroom above +150.
//   (2) range rebuy dip 50 -> 60 bps. The clean pullback is 73 bps, so
//       60 fires at the same rebuy bar 1025 as 50 on clean; on noise
//       draws the deeper dip buys lower (+$3.12 on +8bps seed 5). Dip 70
//       never fires (the low condition is only met at the very bottom,
//       after the turn condition has passed).
//   (3) washout rebuy turn-up 3 -> 2 bars. Faster confirmation buys one
//       bar earlier in some noise draws (+$1.92 on +3bps seed 1, +$1.85
//       on +8bps seed 5; -$1.16 on +3bps seed 2). Turn 4 is worse
//       (-$0.86 clean, buys B at 552 instead of 549).
// Each change alone ties v13 on clean and beats v13 on the 13-scenario
// average; together they stack (combo A: average +$38.62, worst margin
// +$4.21 -- see below). The three changes touch three different legs
// (B TP, Q dip, B turn), so they do not fight each other.
//
// What v15 is NOT: it does NOT beat v13 on the graded dev window -- the
// dev window is mined out (v14 proved it, and this round re-proved it:
// the joint range_tp x tp_rebuy x dip2 sweep, RANGE_N 75/80/100/105,
// range gate -150/-250, tp_scalp 140/145, washout turn 2/4, dip2 60/65/
// 70, and the SMA-proximity / slope-gated / time-stepped range-TP
// hybrids all tie or lose on clean). The slope-gated TP looked like a
// clean win (+$41.49 backtester, sells the range scalp at 997 instead
// of 1004) but it is FRAGILE: it loses -$10.03 to v13 on holdout seed
// +3bps s6. v14's +75 TP has the same fragility on that seed. v15's
// three changes are the opposite: they never lose on the holdout
// (seeds 6-8, 6/6 beat v6, beat or tie v13 on all 6).
//
// Backtester (faithful net-value sim): clean +$41.28, 8 trades, 13/13
// scenarios beat v6 (identical trades to v13 on clean: all three
// changes are no-ops on the clean window).
//
// VERIFIED on the official harness (grade-local --driver process, L1
// regrade reproduced byte for byte): net PnL +$41.651268, 8 trades,
// win rate 1.0, max drawdown 0.54%, fees $3.28 (at 2x fees +$38.34).
// IDENTICAL score to v13 -- same trades, same fills (see above: all
// three changes are no-ops on clean). Trades (decision bars): buy 406
// -> sell 467 (scalp +$13.91), buy 548 -> sell 859 (rebuy +$16.20),
// buy 986 -> sell 1004 (range scalp +$6.38), buy 1025 -> sell 1108
// (range rebuy +$5.16). That is +$1.75 above the dev #2 bar of $39.90
// -- v15 would sit at dev #2 (behind andika $64.10), exactly like v13.
// Backtester +$41.28 (ratio 1.0090). Grade artifacts: ../v15-grade/
// (result_sha256
// 53935237a96c455534d7d3074cc5dcf160592d4c5eb26d4f446f45ae9fc5182c,
// action_log_sha256
// a26197b778f7bea53d33a0432502b699697718b279112560feb903222ff54d3e).
// NOTE: the action log is BYTE-IDENTICAL to v13's (same hash) -- the
// score is identical because all three changes are no-ops on clean.
// The result_sha256 differs from v13's only because the snapshot hash
// changed (header text), exactly as v13's own regrade showed.
// Robustness (backtester): 13/13 scenarios beat v6; average +$38.62
// vs v13's +$37.75 and v14's +$37.95; worst margin over v6 +$4.21
// (vs v13's +$1.65, v14's +$2.84). Holdout seeds 6-8: 6/6 beat v6,
// beats or ties v13 on all 6 (never loses), average +$36.58 vs v13's
// +$36.17. Combined 19 scenarios: average +$37.98 vs v13's +$37.25.
//
// Strategy (long only, one position, whole equity per trade, bigint integer
// math only, no floats, no clock, no network, no randomness):
//
// 1. WASHOUT (scalp) -- the 240-bar (4h) return falls to -4.00% or worse:
//    buy the washout, sell at +1.50% over cost (the first bounce peak),
//    stop at -3.00%, after 500 bars, or after 70 bars if the TP has not
//    hit (fallback -- arms the rebuy like a TP exit). The TP/fallback
//    exit arms the rebuy.
// 2. REBUY (higher low, max 1x) -- after the scalp exit, when the bar's
//    low is >=1.00% below the bounce peak close AND the 240-bar return is
//    above -2.00% AND the close is above the close 2 bars ago, within
//    300 bars of the scalp exit: buy the higher low, sell at +1.55% over
//    cost, stop at -3.00%, or after 500 bars.
// 3. RANGE DIP (scalp + rebuy) -- outside a washout (240-bar return above
//    -2.00%), the close sits 1.12% or more below its 90-bar simple moving
//    average: buy the dip, sell at +0.80% over cost (scalp) -- which arms
//    the range rebuy -- or when the close is back 0.60% above that
//    average, stop at -2.50%, or after 360 bars.
// 4. RANGE REBUY (higher low, max 1x) -- after the range scalp exit, when
//    the bar's low is >=0.60% below the range peak close AND the 240-bar
//    return is above -2.00% AND the close is above the close 3 bars ago,
//    within 60 bars of the scalp exit: buy the higher low, sell when the
//    close is back 0.60% above the 90-bar average, stop at -2.50%, or
//    after 360 bars.
//
// Risk control: at most one open position, whole-equity buys only (never
// leveraged, never short), every order capped at 100 bps of slippage from
// the latest close, and every position carries a stop and a maximum hold.
// The washout max hold (500 bars) is short enough that a missed exit still
// sells before the range-dip window, so a stranded washout can never block
// the second trade.
//
// ENTRYPOINT: this repository ships ONLY main.ts. There is NO main.py --
// v5 was REJECTED by the server ("the snapshot has both main.ts and main.py
// at its root: keep one entrypoint") because the remote repo still carried
// v1's Python main.py alongside main.ts. When pushing v13, VERIFY main.py
// is still absent from the remote repo (it was deleted for v6, commit
// 4a2344c7).

import { BPS, runBars, type BarsState, type Batch, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// --- washout trigger: 240-bar return at or below -400 bps ------------------
// v13 change (1): the scalp fallback is 70 bars (was 80 in v12). If the TP
// (+1.50% net) has not hit by then, the scalp is force-sold and the rebuy
// is armed anyway. On the clean window the scalp exits via TP at 61 bars,
// so the fallback never fires.
const WASH_LOOKBACK = 240;
const WASH_DROP_BPS = 400n;
const WASH_EXIT_BPS = 150n;
const WASH_STOP_BPS = 300n;
const WASH_MAX_HOLD = 500;
const SCALP_FALLBACK_BARS = 70;

// --- rebuy (higher low, max 1x per window) ---------------------------------
// After the scalp exit, re-enter when the bar's LOW is >=1.00% below the
// bounce peak close AND the 240-bar return is above -2.00% AND the close
// is above the close 3 bars ago, within 300 bars of the scalp exit.
// Exit TP +1.50%, stop -3.00%, hold 500.
const REBUY_DIP_BPS = 100n;
const REBUY_TURN_BARS = 2;
const REBUY_GATE_BPS = -200n;
const REBUY_WINDOW = 300;
const REBUY_EXIT_BPS = 155n;
const REBUY_STOP_BPS = 300n;
const REBUY_MAX_HOLD = 500;

// --- range-dip trigger: close below the 90-bar average ---------------------
// v13 change (2): the range leg scalps at +0.80% over cost and rebuys the
// pullback (mode 'Q'). The scalp exit arms the range rebuy ONLY when it is
// a pure TP exit (not when it coincides with the SMA exit -- that is the
// natural exit and arming there buys a post-1108 ledge).
const RANGE_N = 90;
const RANGE_DIP_BPS = 112n;
const RANGE_EXIT_BPS = 60n;
const RANGE_STOP_BPS = 250n;
const RANGE_MAX_HOLD = 360;
const RANGE_GATE_BPS = -200n;
const RANGE_TP_BPS = 80n;

// --- range rebuy (higher low, max 1x per window) ---------------------------
// After the range scalp exit, re-enter when the bar's LOW is >=0.50% below
// the range peak close AND the 240-bar return is above -2.00% AND the close
// is above the close 3 bars ago, within 60 bars of the scalp exit. Exit at
// SMA+0.60%, stop -2.50%, hold 360.
const RANGE_DIP2_BPS = 60n;
const RANGE_TURN_BARS = 3;
const RANGE_WINDOW = 60;

const MAX_SLIPPAGE_BPS = 100;

/** Closes seen so far, oldest first (raw price bigints; null on a missing bar). */
const closes: (bigint | null)[] = [];
/** Which trigger opened the current position ('W', 'B', 'R' or 'Q'), else null. */
let mode: 'W' | 'B' | 'R' | 'Q' | null = null;
/** Batches held (counted from the first batch that reports the position). */
let heldBars = 0;
/** Highest close since the washout buy (the bounce peak close). */
let peakClose: bigint | null = null;
/** Bar count (closes.length) at the scalp exit decision; null when no rebuy is armed. */
let scalpBarLength: number | null = null;
/** Whether the one washout rebuy has been used. */
let rebuyUsed = false;
/** Highest close since the range buy (the range peak close). */
let rangePeakClose: bigint | null = null;
/** Bar count (closes.length) at the range scalp exit decision; null when no range rebuy is armed. */
let rangeBarLength: number | null = null;
/** Whether the one range rebuy has been used. */
let rangeRebuyUsed = false;

/** The 90-bar simple moving average of closes, or null before 90 bars. */
function sma90(): bigint | null {
  if (closes.length < RANGE_N) return null;
  const window = closes.slice(-RANGE_N);
  let sum = 0n;
  for (const c of window) {
    if (c === null) return null;
    sum += c;
  }
  return sum / BigInt(RANGE_N);
}

/** The 240-bar return in bps, or null before 241 closes (integer math). */
function ret240(): bigint | null {
  if (closes.length < WASH_LOOKBACK + 1) return null;
  const now = closes[closes.length - 1]!;
  const then = closes[closes.length - 1 - WASH_LOOKBACK]!;
  if (now === null || then === null) return null;
  return ((now - then) * BPS) / then;
}

/** The close REBUY_TURN_BARS bars ago, or null before enough history. */
function closeTurnAgo(): bigint | null {
  if (closes.length <= REBUY_TURN_BARS) return null;
  return closes[closes.length - 1 - REBUY_TURN_BARS];
}

await runBars({
  onBatch(state: BarsState, batch: Batch): OrderInput[] {
    // Only decide on a batch that carries a fresh bar for our symbol.
    let bar = undefined;
    for (const b of batch.bars) {
      if (b.symbol === SYMBOL) bar = b;
    }
    if (bar === undefined) return [];
    closes.push(BigInt(bar.c));
    if (state.warmingUp) return [];

    const held = state.positions.get(SYMBOL);
    if (held === undefined) {
      mode = null;
      heldBars = 0;
    } else {
      heldBars += 1;
    }

    const close = BigInt(bar.c);
    const low = BigInt(bar.l);
    const minNotional = BigInt(state.hello.fees.min_notional_quote_units);

    if (held !== undefined) {
      // --- exit the open position --------------------------------------
      const value = state.value(SYMBOL, held.qty);
      const cost = held.cost;
      if (mode === 'W') {
        // Track the bounce peak close (the highest close since the buy).
        if (peakClose === null || close > peakClose) peakClose = close;
        const isTP = value * BPS >= cost * (BPS + WASH_EXIT_BPS);
        const isStop = value * BPS <= cost * (BPS - WASH_STOP_BPS);
        const isHold = heldBars >= WASH_MAX_HOLD;
        // v12/v13: fallback exit -- if the TP has not hit after 70 bars,
        // sell anyway and arm the rebuy like a TP exit (the bounce peak
        // did occur, so the pullback is still there to buy).
        const isFallback = heldBars >= SCALP_FALLBACK_BARS;
        if (isTP || isStop || isHold || isFallback) {
          // Only a TP or fallback exit arms the rebuy: a stop/hold exit
          // means the bounce failed, so there is no higher low to buy.
          if ((isTP || isFallback) && !rebuyUsed) {
            scalpBarLength = closes.length;
          }
          return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
        }
      } else if (mode === 'B') {
        if (
          value * BPS >= cost * (BPS + REBUY_EXIT_BPS) ||
          value * BPS <= cost * (BPS - REBUY_STOP_BPS) ||
          heldBars >= REBUY_MAX_HOLD
        ) {
          return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
        }
      } else if (mode === 'Q') {
        // Range rebuy: same exit as the range leg (SMA+0.60%), no second rebuy.
        const avg = sma90();
        if (
          (avg !== null && close * BPS > avg * (BPS + RANGE_EXIT_BPS)) ||
          value * BPS <= cost * (BPS - RANGE_STOP_BPS) ||
          heldBars >= RANGE_MAX_HOLD
        ) {
          return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
        }
      } else {
        // mode 'R' (or unset: fall back to the range exit)
        // Track the range peak close (the highest close since the buy).
        if (rangePeakClose === null || close > rangePeakClose) rangePeakClose = close;
        const avg = sma90();
        const isTP = value * BPS >= cost * (BPS + RANGE_TP_BPS);
        const isSMA = avg !== null && close * BPS > avg * (BPS + RANGE_EXIT_BPS);
        const isStop = value * BPS <= cost * (BPS - RANGE_STOP_BPS);
        const isHold = heldBars >= RANGE_MAX_HOLD;
        if (isTP || isSMA || isStop || isHold) {
          // Arm the range rebuy ONLY on a pure TP (scalp) exit. A TP that
          // coincides with the SMA exit is the natural exit -- arming there
          // buys a post-1108 ledge (the unfixed prototype went 10/13).
          if (isTP && !isSMA && !isStop && !isHold && !rangeRebuyUsed) {
            rangeBarLength = closes.length;
          }
          return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
        }
      }
      return [];
    }

    // --- entries (flat): rebuys first, then washout, then the range dip ----
    // The rebuys are their legs' continuations, so they take priority over
    // a fresh washout/range entry while armed.
    const r240 = ret240();
    const turnAgo = closeTurnAgo();
    if (
      scalpBarLength !== null &&
      !rebuyUsed &&
      closes.length - scalpBarLength <= REBUY_WINDOW &&
      peakClose !== null &&
      low * BPS <= peakClose * (BPS - REBUY_DIP_BPS) &&
      r240 !== null &&
      r240 > REBUY_GATE_BPS &&
      turnAgo !== null &&
      close > turnAgo
    ) {
      const room = state.weightRoom(SYMBOL);
      const spend = state.cash < room ? state.cash : room;
      if (spend < minNotional) return [];
      mode = 'B';
      heldBars = 0;
      rebuyUsed = true;
      scalpBarLength = null;
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }

    if (
      rangeBarLength !== null &&
      !rangeRebuyUsed &&
      closes.length - rangeBarLength <= RANGE_WINDOW &&
      rangePeakClose !== null &&
      low * BPS <= rangePeakClose * (BPS - RANGE_DIP2_BPS) &&
      r240 !== null &&
      r240 > RANGE_GATE_BPS &&
      turnAgo !== null &&
      close > turnAgo
    ) {
      const room = state.weightRoom(SYMBOL);
      const spend = state.cash < room ? state.cash : room;
      if (spend < minNotional) return [];
      mode = 'Q';
      heldBars = 0;
      rangeRebuyUsed = true;
      rangeBarLength = null;
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }

    let want: 'W' | 'R' | null = null;
    if (r240 !== null && r240 <= -WASH_DROP_BPS) {
      want = 'W';
    } else {
      const avg = sma90();
      if (
        r240 !== null &&
        r240 > RANGE_GATE_BPS &&
        avg !== null &&
        close * BPS < avg * (BPS - RANGE_DIP_BPS)
      ) {
        want = 'R';
      }
    }
    if (want === null) return [];

    const room = state.weightRoom(SYMBOL);
    const spend = state.cash < room ? state.cash : room;
    if (spend < minNotional) return [];
    mode = want;
    heldBars = 0;
    if (want === 'W') {
      peakClose = close;
      scalpBarLength = null;
    }
    if (want === 'R') {
      rangePeakClose = close;
      rangeBarLength = null;
    }
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  },
});
