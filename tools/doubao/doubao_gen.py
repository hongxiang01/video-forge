"""用本地豆包界面生成图片：python doubao_gen.py jobs.json 输出目录
先用调试端口启动豆包：osascript -e 'quit app "Doubao"'; open -a Doubao --args --remote-debugging-port=9333 --remote-allow-origins='*'
注意连 [::1]:9333（IPv6）。本机 127.0.0.1:9333 可能被别的 Chrome 占着，连错会操作到别的浏览器。
运行时要绕开代理：env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u all_proxy -u ALL_PROXY NO_PROXY='*' python doubao_gen.py …（详见 README.md）
jobs.json：[{"name": "...", "prompt": "...", "ref": "可选，参考图路径"}]，每条的全部候选图都存下（name.png, name_2.png…）。"""
import base64, json, os, sys, time
from playwright.sync_api import sync_playwright

jobs = json.load(open(sys.argv[1], encoding='utf-8'))
out = sys.argv[2]
os.makedirs(out, exist_ok=True)
JS_IMGS = """() => [...document.images].filter(i => i.naturalWidth >= 700 && i.naturalHeight >= 400).map(i => i.currentSrc || i.src)"""
JS_FETCH = """async (u) => { const r = await fetch(u); const b = await r.blob(); return await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); }); }"""


def click_text(pg, text):
    loc = pg.locator(f'button:has-text("{text}"), [role=button]:has-text("{text}")').first
    loc.click(timeout=6000)


with sync_playwright() as p:
    b = p.chromium.connect_over_cdp('http://[::1]:9333')
    pg = next(x for c in b.contexts for x in c.pages if 'doubao-chat' in x.url)
    pg.bring_to_front()
    for job in jobs:
        name, prompt = job['name'], job['prompt']
        if os.path.exists(f'{out}/{name}.png'):
            continue
        pg.keyboard.press('Meta+Shift+K')
        pg.wait_for_timeout(1500)
        try:
            click_text(pg, '图像生成')
            pg.wait_for_timeout(1200)
        except Exception as e:
            print('no image tool button', str(e)[:120], flush=True)
        if job.get('ref'):  # 参考图（保持角色一致）
            pg.locator('input[type=file]').first.set_input_files(job['ref'])
            pg.wait_for_timeout(4000)
        ed = pg.locator('[contenteditable=true]').last
        ed.click()
        ed.fill(prompt)
        pg.wait_for_timeout(500)
        before = set(pg.evaluate(JS_IMGS))
        ed.press('Enter')
        got, t0 = [], time.time()
        while time.time() - t0 < 170:
            pg.wait_for_timeout(3000)
            now = [u for u in pg.evaluate(JS_IMGS) if u not in before]
            # 带参考图时，上传的参考图也会算作"新图"：至少等到 2 张以上且过了 20 秒才算生成完
            enough = len(now) >= 2 and time.time() - t0 > 20 if job.get('ref') else bool(now)
            if enough and now == got:
                break
            if '额度已用完' in pg.evaluate("() => document.body.innerText.slice(-300)"):
                print('QUOTA: 今日图片生成免费额度已用完', flush=True); b.close(); sys.exit(2)
            got = now
        print(name, 'images', len(got), f'{time.time() - t0:.0f}s', flush=True)
        saved = 0
        for u in got[:8]:
            d = pg.evaluate(JS_FETCH, u)
            raw = base64.b64decode(d.split(',', 1)[1])
            if len(raw) < 20000 or (job.get('ref') and len(raw) == os.path.getsize(job['ref'])):
                continue  # 跳过缩略图和参考图回显
            saved += 1
            # 第一张存 name.png（跳过判断用），其余候选存 name_2.png…
            open(f'{out}/{name}.png' if saved == 1 else f'{out}/{name}_{saved}.png', 'wb').write(raw)
            print(' saved', name, saved, len(raw), flush=True)
        if not saved:
            print(' NOT SAVED', name, flush=True)
        if not got:
            pg.screenshot(path=f'{out}/.fail_{name}.png')
            print(pg.evaluate("() => document.body.innerText.slice(-400)"), flush=True)
    b.close()
