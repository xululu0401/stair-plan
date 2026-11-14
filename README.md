# 排楼梯

层高定了，把一部直跑楼梯的几种级数并排比较：每级多高、踏面多宽、步距 2R+T、楼下要让多长、楼板洞口开多大才不碰头；选一种出放线表；想多做一级时给出长度和洞口要放到多少（每条都回填重算确认）。

- 体验：https://xululu0401.github.io/stair-plan/
- 单文件页面 `index.html` + `core.js`（纯计算）+ `ui.js`（界面）。`node build.cjs` 由 `template.html` 产出 `index.html`。
- 测试：`node --test tests/core.test.cjs`
- 只算直跑、不带平台、踏步等高等宽的几何估算，不是规范审查；默认数据为虚构示例。
