"""自查：在页面里按 10Hz 扫整片，量能脚本化的问题；输出 qc_report.json 和摘要。
- 脚穿地：踝高度 < 地面 + 踝高 - 1.5cm（插进地里）
- 够不着：反向求解目标比肢体长度还远 > 3cm（腿/胳膊被硬拉直、脚飘）
- 出画：可见人物的包围盒中心出了画面
- 切点：镜头起点离最近小节线 > 2 帧（30fps）"""
import functools, http.server, json, os, threading
from playwright.sync_api import sync_playwright
ROOT = os.path.expanduser('~/video-forge/works/weibei-youth-mv')
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start()
JS = '''(t) => { const D = window.DBG, T = D.THREE, cam = D.camera; window.renderAt(t);
  const out = { t, issues: [] }; const v = new T.Vector3();
  for (const [name, P] of [['kid', D.kid], ['adult', D.adult]]) {
    if (!P.root.visible) continue;
    for (const s of ['n', 'f']) { P.B['an_' + s].getWorldPosition(v); const g = (P.groundY || 0) + P.lim['leg_' + s].ankleH; if (v.y < g - 0.015) out.issues.push([name, 'foot_below_ground', s, +(g - v.y).toFixed(3)]); }
    for (const [limb, d] of Object.entries(P.reach || {})) if (d > 0.03) out.issues.push([name, 'cannot_reach', limb, +d.toFixed(3)]);
    const box = new T.Box3().setFromObject(P.root); const c = box.getCenter(new T.Vector3()).project(cam);
    if (Math.abs(c.x) > 1 || Math.abs(c.y) > 1.05) out.issues.push([name, 'offscreen', '', +c.x.toFixed(2)]);
  }
  return out; }'''
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.path.expanduser('~/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'), args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 640, 'height': 360}); pg.goto(f'http://127.0.0.1:{srv.server_port}/film/index.html'); pg.wait_for_function('window.READY === true', timeout=300000)
    shots = pg.evaluate('window.SHOT_TIMES')
    res = [pg.evaluate(JS, i / 10) for i in range(0, 1470)]
    b.close()
srv.shutdown()
song = json.load(open('song.json')); db = song['downbeats']
cut = [[s[0], round(min(abs(s[0] - d) for d in db) * 30, 1)] for s in shots if s[0] > 0]
bad_cuts = [c for c in cut if c[1] > 2]
# 按镜头汇总
summary = {}
for r in res:
    sh = next((i for i, s in enumerate(shots) if s[0] <= r['t'] < s[1]), -1)
    for who, kind, part, val in r['issues']:
        k = f'shot{sh:02d}@{shots[sh][0]:.1f}-{shots[sh][1]:.1f} {shots[sh][2]} {who} {kind} {part}'
        e = summary.setdefault(k, {'n': 0, 'max': 0, 'first': r['t']}); e['n'] += 1; e['max'] = max(e['max'], abs(val))
json.dump({'shots': shots, 'cuts_off_downbeat_frames': bad_cuts, 'issues': summary}, open('qc_report.json', 'w'), ensure_ascii=False, indent=1)
print('切点不在小节线（>2 帧）:', bad_cuts)
for k, e in sorted(summary.items()): print(f"{k}: {e['n']} 次（{e['n']/10:.1f}s）最大 {e['max']} 首次 {e['first']:.1f}s")
