# 豆包自动化（本地桌面版）

用 Playwright 连上本机豆包桌面版的调试端口，批量生图，或者用首帧图生视频。不用 API key，用的是用户自己登录的豆包，免费额度每天有限。

| 脚本 | 做什么 |
|---|---|
| `doubao_gen.py jobs.json 输出目录` | 批量生图。`jobs.json` 的格式是 `[{"name": "...", "prompt": "...", "ref": "可选，参考图路径"}]`。每条的候选图全部存下来（`name.png`、`name_2.png`…）。已经存在的跳过，所以中断后重跑会接着往下。额度用完时退出码是 2 |
| `doubao_video.py 首帧图 "提示词" 输出.mp4 [秒数=5]` | 图生视频，默认 Seedance 2.0 Mini，16:9 |
| `doubao_probe.py` | 看看连上没有、当前有哪些页面 |

## 用法

```bash
# 1. 用调试端口重启豆包
osascript -e 'quit app "Doubao"'
open -a Doubao --args --remote-debugging-port=9333 --remote-allow-origins='*'

# 2. 跑脚本（必须绕开 shell 里的代理）
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u all_proxy -u ALL_PROXY NO_PROXY='*' \
  ~/.venvs/mv/bin/python ~/video-forge/tools/doubao/doubao_gen.py jobs.json raw/

# 3. 用完恢复正常启动（不带调试端口）
osascript -e 'quit app "Doubao"'; sleep 2; open /Applications/Doubao.app
```

## 坑

- **一定连 `[::1]:9333`（IPv6）**。本机 `127.0.0.1:9333` 常被 Google Chrome 占着，连错了会去操作别的浏览器。
- **代理**：`curl`、Python 访问调试端口都要绕开代理。zsh 不会把存在变量里的命令前缀拆开，所以要像上面那样直接写在命令前。
- **恢复正常启动**：`open -a Doubao` 会沿用上次的调试参数。要先彻底退出，再 `open /Applications/Doubao.app`，然后用 `ps aux | grep -i doubao` 确认没有 `--remote-debugging-port`。
- **参考图**：带 `ref` 时，上传的参考图会被当成"新图"，所以脚本至少等到 2 张以上、过了 20 秒才算生成完，并跳过和参考图一样大的回显。
- **偶尔一条显示 `NOT SAVED`**：直接重跑，已存的会跳过。
- **水印**：每张图右下角都有"豆包AI生成"。只修补那几个字（`cv2.inpaint`），不要整块涂掉，否则伸进那个角的人物会被挖出一个方块（`works/weibei-youth-mv/chalk/design/poses/cut_sheet.py`）。
- **图生视频**：推近会出塑料感、手办感，也不听动作指令，只有 720p、24 fps，水印还会跟着动（《违背的青春》第 5 版的对比结论）。让豆包画单张原画，动作交给代码去排。

提示词写法：
- 角色姿势原画见 `recipes/chalk-pose-mv.md` 第 5 节；
- 剪纸平面场景的写法见 `works/weibei-youth-mv/brief.md`「场景定稿」：要写明"正面平视、舞台布景式、横向分层、没有透视、纯色平涂"。
