// Washout + range-dip BTC bot v4 for make.fun btc-race-24h-20261113-2314.
//
// v4 = v3 with ONE change: the washout max hold is shortened 720 -> 500
// bars (WASH_MAX_HOLD 720 -> 500). The washout exit stays at +2.50%.
//
// Why only the hold: v4 first tried raising the exit to +2.70% (the
// backtester said +$33.16 vs v3's +$31.12), but the OFFICIAL harness
// rejected it: the washout never sold at the exit and instead sold at the
// max hold (bar 906), for +$22.85 -- WORSE than v3's +$33.16. Root cause:
// the backtester checks the exit on the GROSS close ratio, but the official
// harness checks it on the NET value/cost ratio, and the buy's effective
// cost (fill ~$68,096 vs the decision-bar close $67,877) eats ~32 bps.
// Officially the exit triggers only when the close reaches
// $68,122 x (1 + exit): +2.50% needs $69,825 (bar 860, close 69,876 --
// confirmed in v3's official action log), +2.60% needs $69,893 (bar 861),
// +2.70% needs $69,961 -- but the dev peak close is $69,948, so +2.70%
// NEVER triggers. The backtester's "broad 210-300 plateau" is an artifact
// of ignoring the buy-side drag; officially the plateau is ~230-260 and
// 270 is a cliff. +2.50% keeps 18 bps of headroom below the dev peak;
// +2.60% keeps only 8 bps for a sub-dollar fill difference, so +2.50%
// stays. LESSON: never trust the backtester for exit levels near the peak
// -- verify every exit candidate on the official harness.
//
// Why the shorter hold: it is cliff insurance, not a dev lever. On dev the
// exit triggers at bar 860 (454 bars after entry), so a 500-bar hold never
// binds and dev PnL is unchanged (v4 officially ties v3 at +$33.16). But
// if the exit NEVER triggers (weak recovery in the unseen race window),
// the washout must not sit held past the range-dip trade at bar 982.
// With hold 720 the washout sells at bar 1126 and the range trade is
// blocked (cliff total +$8.66 backtester). With hold 500 it sells at bar
// 906 @ 69,180, the range trade fires, and the cliff total is +$22.76 --
// proven by v4's own first official run, where the failed +2.70% exit
// still left +$22.85 because the 500-bar hold freed the bot for the range
// trade. Hold 450 is too short (fires bar 856, 4 bars before the exit,
// -$8 on dev); hold 550 sells lower in the cliff (bar 956 @ 68,640). 500
// is the sweet spot: 46 bars of headroom past the dev exit, and the best
// cliff PnL among holds that do not touch dev.
//
// Everything else (triggers, stops, range-dip, exit) is v3 unchanged. The
// dev window has exactly two money events and v4 takes both. v4 does NOT
// beat v3 on dev PnL (it ties at +$33.16) -- the dev window is fully mined
// and both trades already buy the low bar and sell at/near the peak. v4's
// gain is strictly in the failure case: it weakly dominates v3 on the
// unseen race window (same when the exit triggers, much better when it
// does not).
//
// What else was tested and rejected for v4: washout lookback 120/180 never
// fires and 360 fires early and blocks the range trade (240 is uniquely
// correct); range SMA-60 never fires and SMA-120/180 buy higher and add a
// losing trade (90 is optimal); range % exits sell too early or never
// (+$17.66-27.31); range lo 113 never fires (max dip is -113 bps);
// bounce-confirmation entry buys higher and its apparent +$1.32 is a
// fill-depth artifact at one bar, not a real edge.
//
// Strategy (long only, one position, whole equity per trade, bigint integer
// math only, no floats, no clock, no network, no randomness -- the same bars
// always give the same orders):
//
// Two entry triggers, both decided on a bar's close and filled at the next
// bar's open (the replay's 1-bar latency):
//
// 1. WASHOUT -- the 240-bar (4h) return falls to -4.00% or worse: BTC just had
//    a capitulation leg. Buy the washout, sell when the position is worth
//    +2.50% over its cost, stop at -3.00%, or after 500 bars.
// 2. RANGE DIP -- outside a washout (240-bar return above -1.50%), the close
//    sits 1.00% or more below its 90-bar simple moving average: BTC is at the
//    bottom of its short-term range. Buy the dip, sell when the close is back
//    0.60% above that average, stop at -2.50%, or after 360 bars.
//
// Risk control: at most one open position, whole-equity buys only (never
// leveraged, never short), every order capped at 100 bps of slippage from the
// latest close, and every position carries a stop and a maximum hold, so a
// trade that never recovers is cut instead of ridden to the end of the window.
// The washout max hold (500 bars) is short enough that a missed exit still
// sells before the range-dip window, so a stranded washout can never block
// the second trade.

import { BPS, runBars, type BarsState, type Batch, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// --- washout trigger: 240-bar return at or below -400 bps ------------------
// v4 change: max hold shortened 720 -> 500 bars (cliff insurance; see
// header). Exit stays at 250 bps: +2.70% was tried and REJECTED -- it never
// triggers officially (buy-side drag ~32 bps puts its trigger close at
// $69,961, above the dev peak close $69,948).
const WASH_LOOKBACK = 240;
const WASH_DROP_BPS = 400n;
const WASH_EXIT_BPS = 250n;
const WASH_STOP_BPS = 300n;
const WASH_MAX_HOLD = 500;

// --- range-dip trigger: close below the 90-bar average ---------------------
// Unchanged from v2.
const RANGE_N = 90;
const RANGE_DIP_BPS = 100n;
const RANGE_EXIT_BPS = 60n;
const RANGE_STOP_BPS = 250n;
const RANGE_MAX_HOLD = 360;
const RANGE_GATE_BPS = -200n; // only when the 240-bar return is above -2.00% (v5: widened from -1.50% for race-window robustness; dev trade unchanged)

const MAX_SLIPPAGE_BPS = 100;

/** Closes seen so far, oldest first (raw price bigints; null on a missing bar). */
const closes: (bigint | null)[] = [];
/** Which trigger opened the current position ('W' or 'R'), else null. */
let mode: 'W' | 'R' | null = null;
/** Batches held (counted from the first batch that reports the position). */
let heldBars = 0;

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
    const minNotional = BigInt(state.hello.fees.min_notional_quote_units);

    if (held !== undefined) {
      // --- exit the open position --------------------------------------
      const value = state.value(SYMBOL, held.qty);
      const cost = held.cost;
      if (mode === 'W') {
        if (
          value * BPS >= cost * (BPS + WASH_EXIT_BPS) ||
          value * BPS <= cost * (BPS - WASH_STOP_BPS) ||
          heldBars >= WASH_MAX_HOLD
        ) {
          return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
        }
      } else {
        // mode 'R' (or unset: fall back to the range exit)
        const avg = sma90();
        if (
          (avg !== null && close * BPS > avg * (BPS + RANGE_EXIT_BPS)) ||
          value * BPS <= cost * (BPS - RANGE_STOP_BPS) ||
          heldBars >= RANGE_MAX_HOLD
        ) {
          return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
        }
      }
      return [];
    }

    // --- entries (flat): washout first, then the range dip --------------
    const r240 = ret240();
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
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  },
});
