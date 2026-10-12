# 暗黑放置（Claude Code mod）

一個在 Claude Code 裡跑的暗黑破壞神風格放置 RPG：你寫程式，你的英雄在旁邊打怪。
關掉 Claude Code 也會繼續累積進度（最多 8 小時）。

## 內容

- **三個職業**：野蠻人、女巫、死靈法師，各有 3 系技能樹與 3 支天賦分支
- **五幕 × 三難度**：普通、惡夢、地獄，每幕有自己的場景與首領
- **怪物群與菁英**：藍名菁英、金名頭目、隨機詞綴、元素抗性與免疫
- **裝備**：10 個欄位、底材分普通／擴充／菁英、31 件暗金、6 套套裝、護身符、未鑑定物品
- **寶石、符文、符文之語、赫拉迪克方塊**
- **任務、天賦樹（滿級 99 後）、大秘境（打通地獄後）**
- 像素畫面、光影、血球與法力球

## 安裝

需要 **Claude Code 2.1.29x 以上**，以及支援全彩的終端機（例如 Windows Terminal、iTerm2、Ghostty）。

### 方式一：從 marketplace 安裝

在 Claude Code 裡輸入：

```
/plugin marketplace add kao273183/claude-idle-rpg
/plugin install idle-rpg@claude-idle-rpg
```

安裝後重新啟動 Claude Code。

### 方式二：直接載入資料夾

```
git clone https://github.com/kao273183/claude-idle-rpg.git
claude --plugin-dir claude-idle-rpg/plugins/idle-rpg
```

想每次都自動載入，在 `~/.claude/settings.json` 加上（路徑換成你的）：

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "/絕對路徑/claude-idle-rpg/plugins/idle-rpg"
  }
}
```

## 開始玩

輸入 `/rpg` 打開面板，選一個職業。按 `Esc` 關閉面板，戰鬥會在背景繼續，底部狀態列會顯示戰況。

| 按鍵 | 頁面 |
|---|---|
| `w` | 戰鬥 |
| `c` | 角色（屬性、藥水） |
| `t` | 技能與天賦 |
| `i` | 物品（裝備、背包、護身符） |
| `g` | 寶石與符文（鑲嵌工作台） |
| `u` | 赫拉迪克方塊 |
| `h` | 城鎮（商人、鐵匠、賭博、倉庫、傳送點） |
| `j` | 任務 |
| `y` | 大秘境 |
| `o` | 掉落機率 |

面板寬度建議 90 欄以上，怪物群和僕從才不會擠在一起。

## 寫程式幫英雄變強

你和 Claude 工作的時候，英雄也會跟著變強：

| 你做的事 | 英雄得到的 |
|---|---|
| Claude 每執行一次工具 | ⚡ 專注 +30 秒（最多 5 分鐘）：傷害、經驗、金幣 +25% |
| 測試通過（`npm test`、`pytest`、`vitest`……） | ✚ 祝福：生命法力全滿，魔法尋寶 +100%，持續 10 分鐘 |
| `git commit` | ▣ 寶箱：金幣與一件稀有以上的裝備（每 10 分鐘最多一箱） |

狀態列會顯示剩餘時間，角色頁（`c`）看得到詳細狀態。

## 更新

遊戲執行時每小時會檢查一次 GitHub 上的版本，有新版會跳出提示，狀態列也會顯示。

- **建議打開自動更新**：輸入 `/plugin`，到 marketplace 管理頁選 `claude-idle-rpg`，開啟自動更新。之後每次啟動 Claude Code 都會自動抓新版。
- **手動更新**：輸入 `/plugin marketplace update claude-idle-rpg`，再到 `/plugin` 更新 idle-rpg，然後重開 Claude Code。
- **用 git clone 安裝的**：在資料夾裡 `git pull`，再重開 Claude Code。

新版要**重開 Claude Code** 才會載入，存檔不會受影響。

## 存檔

存檔存在你自己電腦的 Claude Code 外掛資料裡，每個人各自一份，更新也不會清掉。

## 開發

```
claude plugin validate plugins/idle-rpg
claude plugin test plugins/idle-rpg
```
