# Agent Handoff

This file is the handoff note for future agents working on this repo.

## Project

- Repo: `4ETF-buy-point`
- Type: static frontend + Cloudflare Worker proxy
- Production site: `https://fricachai.github.io/4ETF-buy-point/`
- Worker base URL: `https://stock-k-chat-proxy.fricachai.workers.dev`

## Main Goal

This project is a Taiwan market watchlist + chart dashboard.

Current focus:
- default watchlist management
- realtime quotes for watchlist items
- daily candlestick chart rendering
- buy-point reminders
- GitHub Pages deployment

## Core Files

- [app.js](D:\USB_Data\個人研究\實用分析分類\ChatGPT_個人累積\ChatGPT_Codex_專案資料夾\4檔ETF跌幅監控\app.js)
  Main application logic.
  Contains:
  - default watchlist
  - buy reminder rules
  - realtime quote merge logic
  - chart rendering
  - pointer / drag / hover interactions
  - watchlist persistence

- [index.html](D:\USB_Data\個人研究\實用分析分類\ChatGPT_個人累積\ChatGPT_Codex_專案資料夾\4檔ETF跌幅監控\index.html)
  Static page shell and `APP_CONFIG`.

- [styles.css](D:\USB_Data\個人研究\實用分析分類\ChatGPT_個人累積\ChatGPT_Codex_專案資料夾\4檔ETF跌幅監控\styles.css)
  Dashboard layout and watchlist UI styling.

- [cloudflare-worker.js](D:\USB_Data\個人研究\實用分析分類\ChatGPT_個人累積\ChatGPT_Codex_專案資料夾\4檔ETF跌幅監控\cloudflare-worker.js)
  Worker proxy for:
  - `/api/twse-stock-day`
  - `/api/twse-quote`
  - `/api/taiex-chart`

- [wrangler.toml](D:\USB_Data\個人研究\實用分析分類\ChatGPT_個人累積\ChatGPT_Codex_專案資料夾\4檔ETF跌幅監控\wrangler.toml)
  Worker deployment config.

- [data](D:\USB_Data\個人研究\實用分析分類\ChatGPT_個人累積\ChatGPT_Codex_專案資料夾\4檔ETF跌幅監控\data)
  Cached JSON fallback market data.

## Current Default Watchlist

The active default list is controlled in `app.js`.

At the time of this handoff it should include:
- `0050`
- `0056`
- `00878`
- `006208`
- `2330`
- `TPE: IX0001`

Important:
- existing users may still see old lists due to `localStorage`
- watchlist migration logic is in `migratePersistedWatchlist()`
- current migration key is `stock-observe-panel-watchlist-v3`

## Buy Reminder Rules

Defined in `BUY_REMINDER_RULES` in `app.js`.

Important current rule:
- `2330` uses the same KD-based rule as `TPE: IX0001`

That means:
- `mode: "kd-k"`
- `rangeMin: 20`
- `rangeMax: 30`
- `oversoldMax: 20`

## Realtime Quote Architecture

Frontend:
- refresh interval defined by `REALTIME_REFRESH_MS`
- current value was recently discussed as `20000` ms unless changed later

Flow:
- frontend calls Worker `/api/twse-quote`
- Worker proxies to TWSE MIS realtime endpoint
- realtime quote is merged into the latest daily candle
- chart uses daily candles plus merged realtime latest bar
- watchlist uses realtime quote display

Important functions in `app.js`:
- `fetchRealtimeQuotes()`
- `refreshRealtimeQuotes()`
- `normalizeRealtimeQuote()`
- `mergeRealtimeQuoteIntoCandles()`
- `getDisplayCandles()`

## Chart Performance Notes

This project had cursor lag on the left chart area.

Recent fixes:
- pointer-driven redraw was throttled with `requestAnimationFrame`
- hover redraw was changed to chart-only redraw instead of full UI redraw

Relevant functions:
- `renderChartOnly()`
- `scheduleChartRender()`

If lag is still reported, next likely optimization targets are:
- cache computed indicators per symbol/timeframe
- avoid recomputing SMA/MACD/KD/CCI on every hover redraw
- reduce signal-tag layout work during hover

## Watchlist UI Notes

Recent watchlist changes:
- tighter row height
- centered product column
- left-aligned name column
- centered price column
- reduced column gap

If a user reports “looks unchanged”, check:
- GitHub Pages deployment status
- browser hard refresh (`Ctrl+F5`)
- local cache / old session

## Signal Toggle Button

There is a chart button at the bottom-right intersection of:
- price axis
- time axis

Purpose:
- toggle buy/signal tags on chart

Implementation:
- drawn directly on canvas, not HTML DOM
- state stored in `state.showSignalTags`

If user says “button not visible”, likely causes:
- old deployed `app.js`
- browser cache

## Deployment

### GitHub Pages

Frontend deploys from GitHub Actions on push to `main`.

Relevant workflow:
- `.github/workflows/deploy-pages.yml`

### Cloudflare Worker

Worker deploys from GitHub Actions on push to `main`.

Relevant workflow:
- `.github/workflows/deploy-worker.yml`

Required GitHub secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Known Repo Quirks

1. Some older markdown notes have mojibake / encoding damage.
   Prefer this handoff file and current source code over those notes.

2. `README.md` is not fully reliable for detailed implementation state.
   Check `app.js` and recent git history first.

3. There are untracked local note files in this repo from prior work.
   Do not assume they are part of production.

4. Watchlist behavior depends on `localStorage`.
   A production fix may appear “not working” if migration did not rerun.

## Recent Relevant Commits

Recent changes around this handoff included:
- realtime chart redraw throttling
- watchlist layout tightening
- force migration to include `2330`
- `2330` default rule matching weighted index KD rule

Use `git log --oneline -10` before making assumptions.

## Recommended First Checks For A New Agent

1. Open `app.js`
2. Verify current `BUY_REMINDER_RULES`
3. Verify current `ACTIVE_DEFAULT_STOCKS`
4. Verify current `WATCHLIST_MIGRATION_KEY`
5. Check latest deploy status with:
   - `gh run list --limit 5`
6. If user reports UI mismatch, confirm deployed `app.js` actually contains the change

## Safe Working Pattern

For changes that affect production behavior:
- edit source
- run `node --check app.js` if JS changed
- push to `main`
- verify GitHub Pages / Worker deployment
- remind user to hard refresh if the issue is frontend-visible
