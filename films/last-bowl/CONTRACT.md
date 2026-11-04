# 风格帧分工契约

目标：用真实绘制代码出 **3 张风格帧 + 1 张手部设定图**，交用户确认后才进入整片生产。

| 风格帧 | 片中时间 | 内容 |
|---|---|---|
| `a`（主构图 A，暖灯） | 2.0 s | 灯刚拉亮、还在摆；五只红沿碗摞在右台角，面盆正放，擀面杖斜放，面粉；窗外落雪 |
| `a2`（主构图 A'，灯灭） | 37.8 s | 同一构图换成灯灭色指定；路灯光斑铺满台面，正放的那只红沿碗在光斑里；灯绳在窗前摆；雪影滑过光斑 |
| `s5`（招牌镜头） | 13.8 s | 面片搭在擀面杖上举到吊灯前，逆光透亮，手指影透出，面粉颗粒在光里闪 |
| 手部设定图 | `?test=hands` | 老师傅的手：比例、关键手型、暖灯 / 灯灭 / 剪影三套色 |

## 必读

- `TREATMENT.md`：§4.1 主构图布局（坐标全在这里）、§4.2 手的设定、§4.3 色指定、§4.4 面的画法、§9 风险镜头与附 1–3（热气、雪）
- `风格卡.md`，以及画风规则 `~/mv-xue/lemo-opuscar/styles/cel-anime-80s/STYLE.md`（不变式，不许违反）
- 技法参考（只学画法，不搬故事和镜头）：`~/mv-xue/lemo-opuscar/styles/cel-anime-80s/demo/` 里的 `cel.js`、`bg.js`、`fx.js`、`hands.js`、`post.js`

## 共用文件（只读，不许改）

| 文件 | 内容 |
|---|---|
| `lib/cel.js` | `cel(g, pts, {f,s,so,h,ho,rim,l,lw})` 平涂 + 硬边阴影 / 高光 + 彩色描边；`path`、`poly`、`ribbon`、`flutter`、`airbrush`、`vgrad`、`mix`、`rgba`、`rng`、`hash`、`canvas(w,h)` |
| `lib/limb.js` | `limb(a, b, w1, w2)` 两端圆头的肢体外形 |
| `lib/post.js` | CRT / 磁带后期（合成负责人调参数，不改代码） |
| `pal.js` | `C(name, light)` → `{f,s,l,h}`，light = `warm` / `in`（灯灭光斑内）/ `out`（灯灭光斑外）；`SIL` 剪影套；`BG` 背景板关键色；`SNOW`；`TYPE` |
| `layout.js` | `w2s(x,y,z)` 世界 → 屏幕；`scale(x,y,z)` 该处 1 米多少 px；`WIN`、`TABLE`、`SHADE`、`CORD`、`HALO`、`OBJ`；`shutterH(t)`；`spot(h)` 光斑多边形与窗棂影 |
| `main.js`、`index.html` | 页面约定，不动 |

**画面里任何东西的位置都从 `layout.js` 算，不许手写屏幕坐标**（S5 是另一个机位，不在主构图里，按 §4 镜头表自行布局）。所有绘制必须确定：不用 `Math.random()` / `Date`，用 `rng(seed)` / `hash(i)`。

每张画都画两层：`g` 是颜色层，`e` 是发光层（只有自己发光的东西：灯罩内、灯泡、路灯、透光的面片、路灯下的雪）。cel 挡在发光体前面时，要在 `e` 上用黑色印一遍它的剪影（画风 §2、§9）。

## 分工与接口

| 负责人 | 只写这些文件 | 必须导出 |
|---|---|---|
| 背景画师 | `plates.js` | `async load()` → `{ plateA: {warm:{c,e}, darkIn:{c,e}, darkOut:{c,e}}, plateS5: {c,e} }`，都是 1920×1080 的 canvas；`test(g,e,t,A)` 并排展示各张板 |
| 手 | `hands.js` | `hand(g, e, o)`，`o = {x, y, s, rot, side:'R'|'L', pose, light, t}`，pose 至少有 `bead`（捏灯绳木珠）、`grip`（握擀面杖）、`lift`（S5 托杖举起，用剪影套）、`press`（压面窝）、`flat`（掌放平）；light 取 `warm` / `in` / `out` / `s5` / `s13`；`test(g,e,t,A)` 画手部设定图 |
| 道具特效 | `props.js`、`fx.js` | props：`shade(g,e,o)` 灯罩 + 灯泡 + 灯绳木珠（摆角 `o.swing`）、`bowl(g,e,o)`（正放 / 摞、红沿）、`basin`、`pin`、`apron`、`wipe`、`flourScatter`、`doughBacklit(g,e,o)`（S5 三块硬边色区 + 手指影 + 边缘缎带晃动）；fx：`snow(g,e,t,o)`（远 / 中 / 近三层，可裁进多边形）、`snowShadows(g,t,o)`（台面雪影）、`flourMotes(g,e,t,o)`（S5）、`steam(g,e,t,o)`；两个文件各有 `test(g,e,t,A)` |
| 合成 | `scenes.js`、`frames.js` 的 `POST` | `draw({t,g,e,ov,A,frame})`：按 `frame` 合成 `a`、`a2`、`s5` 三张风格帧，调 CRT 参数；只调用别人的导出函数，不改别人的文件 |

## 自测（每个负责人都要做）

```sh
cd ~/mv-xue/lemo-opuscar && env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
  node core/render/still.mjs ~/style-studio/films/last-bowl <秒> --q 'test=<模块名>' --out ~/style-studio/films/last-bowl/stills/<模块名>
```

渲染完用 Read 打开 jpg **亲眼看**，对照 TREATMENT 和画风规则改，至少看 2 轮。加 `--q 'test=hands&raw=1'` 可跳过 CRT 看原图。页面报错时工具会停下并打印错误。

## 写代码的方式

每次 Write / Edit 的新增内容控制在约 300 行以内，先写能跑的版本再逐步加细节；动笔前的构思要短，想好一块写一块。
