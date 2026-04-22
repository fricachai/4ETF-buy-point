# Chart Panel Reuse Guide

這份文件整理目前 `4ETF-buy-point` 專案裡，可以直接搬到另一個專案重用的介面與互動設定。

適用範圍：

- 左側 `K 線圖 / CCI / KD / MACD / 成交量` 圖表配置
- 圖內 hover / 十字線 / 時間軸 / 價格軸樣式
- 上方摘要列 `收盤價 | 漲跌 | 買點規則 | 累計跌幅`
- 登入預設狀態與登入閘門
- 最上方作者卡 `程式設計：fricachai | 資訊提供：jimmy (2026/04/20)`

---

## 1. 檔案對應

重用時主要看這 4 個檔案：

- `index.html`
- `styles.css`
- `app.js`
- `LOGIN_GATE_REUSE.md`

其中：

- `LOGIN_GATE_REUSE.md` 只處理登入閘門
- 這份 `CHART_PANEL_REUSE.md` 處理圖表版型與互動設定

---

## 2. HTML 要帶走的區塊

另一個專案至少要保留這些節點：

### 2.1 Header 區

需要保留：

- `#chartTitle`
- `#closeInfo`
- 作者卡 `.author-card`
- `#logoutButton`
- `#timeframeSelect`

作者卡目前文案是：

```html
<span class="author-copy">程式設計：fricachai | 資訊提供：jimmy (2026/04/20)</span>
```

### 2.2 圖表區

需要保留：

- `canvas` 主圖表畫布
- 左圖右側觀察清單容器
- 匯入 CSV 的按鈕與表單

如果另一個專案已經有自己的外框，可以只保留現有 `canvas` 與控制元件，不必整份 HTML 全搬。

---

## 3. CSS 要帶走的樣式重點

### 3.1 上方摘要列

`styles.css` 的 `.close-info` 目前設定：

- 字色偏亮
- 字級 `16px`
- 字重 `600`

這一行是目前上方摘要列的視覺基準。

### 3.2 作者卡

作者卡的玻璃感、邊框、浮動光點都在 `styles.css`。

如果要完整重用：

- 帶走 `.author-card`
- 帶走 `.author-copy`
- 帶走 `.author-spark`
- 帶走 `.author-orbit-ball`

### 3.3 登入閘門

登入閘門樣式不要從這份文件抄，直接依 `LOGIN_GATE_REUSE.md` 套用即可。

---

## 4. app.js 要重用的設定

### 4.1 圖表面板順序

目前副圖順序固定為：

1. `CCI`
2. `KD`
3. `MACD`
4. `成交量`

對應區塊是 `renderChart(stock)` 內這幾個 area：

- `priceArea`
- `xAxisArea`
- `priceScaleArea`
- `cciArea`
- `kdjArea`
- `macdArea`
- `volumeArea`

如果另一個專案要完全一樣的排列，直接複用這些 area 定義與繪製順序。

### 4.2 K 線圖上方標題列

目前已移除圖內這一排：

- 股票名稱
- 週期
- 交易所
- 代號
- 漲跌值

這些資訊改由頁面最上方處理，所以主圖垂直空間比較大。

如果另一個專案也要相同效果：

- 不要在 `renderChart()` 內重畫圖內主標題
- 保留上方 `#closeInfo`

### 4.3 上方摘要列格式

目前由 `renderAll()` 組成：

```text
收盤價：86.00 | 1.45 (1.71%) | 買點：10個交易日收盤價跌幅 -5% ~ -7% ( -7% 時加碼 報酬率最高) | 累計跌幅 0.00%
```

重點格式：

- `收盤價：`
- 漲跌值直接接在後面
- 買點規則不重複加第二個 `買點：`
- 末段文字用 `累計跌幅`

### 4.4 時間軸規則

目前時間軸固定標示規則：

- 每月第一個有交易的日期
- 每月最接近 `14 / 15 / 16` 的交易日日期
- 會自動避讓，避免日期重疊
- 最右邊不額外補最後一天日期

hover 時：

- 滑鼠所在日期會顯示在時間軸上
- 顏色為藍底白字 tag

### 4.5 價格軸與副圖右側數值規則

目前右側顯示方式：

- K 線圖右側固定價格數字置中顯示在右側價格區
- 滑鼠在 K 線圖內時，hover 價格 tag 也置中落在同一條價格區
- `CCI / KD / MACD / 成交量` 的右側數值 tag 也共用同一種置中模式

### 4.6 十字線規則

目前十字線：

- 垂直線使用虛線
- 水平線使用虛線
- 垂直線會穿過主圖與所有副圖
- 日期 hover tag 顯示在下方時間軸
- 價格 hover tag 顯示在右側

### 4.7 KD 強調線

目前 `KD` 區：

- `20 / 80` 虛線比中線更亮、更粗
- `50` 中線保留較弱

### 4.8 SMA 圖例

K 線圖左上角：

- `SMA5`
- `SMA20`
- `SMA60`

文字已調亮，和均線本身顏色一致但更容易閱讀。

---

## 5. 登入預設狀態

登入相關邏輯請直接套用 `LOGIN_GATE_REUSE.md`。

目前這個專案的登入設定在 `app.js`：

- `AUTH_CONFIG.usernames = ["frica", "jimmy"]`
- `AUTH_CONFIG.password = "stock2026"`
- `AUTH_STORAGE_KEY = "stock-observe-panel-auth"`

如果另一個專案也要同一組登入預設：

- 直接複用 `AUTH_CONFIG`
- 直接複用 `checkSavedAuth()`
- 直接複用 `unlockAppShell()` / `lockAppShell()`

---

## 6. 建議的搬移方式

### 方案 A：整包搬移

適合另一個專案本身也是單頁原生 HTML / CSS / JS。

做法：

1. 複製 `index.html` 內的 header、作者卡、畫布區、登入閘門
2. 複製 `styles.css` 的相關 selector
3. 複製 `app.js` 內：
   - `renderChart()`
   - `renderAll()`
   - axis / hover / tag 相關 helper
   - login gate 相關函式

### 方案 B：只搬設定

適合另一個專案已有自己的資料流與畫布邏輯。

做法：

1. 保留現有資料載入流程
2. 只搬：
   - area 版位數值
   - 時間軸標示規則
   - 右側數值置中規則
   - 上方摘要列字串格式
   - 作者卡文字與樣式

---

## 7. 最小重用清單

如果你只想快速在另一個專案複製出目前這個外觀，至少要帶走：

- `index.html`
  - `.author-card`
  - `#closeInfo`
  - `#logoutButton`
  - `#timeframeSelect`
- `styles.css`
  - `.close-info`
  - 作者卡相關樣式
  - 登入閘門樣式
- `app.js`
  - `renderChart()`
  - `renderAll()`
  - `drawAxisValueTag()`
  - `drawXAxisHoverTag()`
  - `updateHoverCrosshair()`
  - `getHoverZone()`
  - 登入閘門函式群

---

## 8. 如果要做成真正可插拔模組

如果下一步要讓另一個專案「直接引用」而不是手動複製，我建議再拆成：

- `chart-theme.js`
  只放圖表 area、顏色、字串格式、時間軸規則
- `login-gate.js`
  只放登入邏輯
- `chart-theme.css`
  只放圖表與作者卡樣式

這樣另一個專案只要：

1. 引入 `chart-theme.css`
2. 引入 `chart-theme.js`
3. 引入 `login-gate.js`
4. 提供自己的資料來源

就能直接套用。

如果你要，我下一步可以直接幫你把這些再拆成真正可重用的 `js/css` 模組。
