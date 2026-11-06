"""用本地豆包「视频生成」做图生视频：python doubao_video.py 首帧图 "提示词" 输出.mp4 [秒数=5]
豆包要先用调试端口启动（见 doubao_gen.py 开头）；连 [::1]:9333。默认模型 Seedance 2.0 Mini、比例 16:9。"""
import base64, os, sys, time
from playwright.sync_api import sync_playwright

img, prompt, out = sys.argv[1], sys.argv[2], sys.argv[3]
secs = int(sys.argv[4]) if len(sys.argv) > 4 else 5
SHOT = os.path.splitext(out)[0]
JS_VIDS = "() => [...document.querySelectorAll('video')].map(v => v.currentSrc || v.src).filter(Boolean)"
JS_FETCH = """async (u) => { const r = await fetch(u); const b = await r.blob(); return await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); }); }"""

with sync_playwright() as p:
    b = p.chromium.connect_over_cdp('http://[::1]:9333')
    pg = next(x for c in b.contexts for x in c.pages if 'doubao-chat/chat' in x.url)
    pg.bring_to_front()
    pg.keyboard.press('Meta+Shift+K'); pg.wait_for_timeout(1500)
    # 新对话里可能已经带着「视频生成」技能（出现 Seedance 模型按钮），没有才去「更多技能」里点
    if not pg.get_by_text('Seedance').count():
        pg.locator('button:has-text("更多技能"), [role=button]:has-text("更多技能")').first.click(); pg.wait_for_timeout(1200)
        pg.locator(':text-is("视频生成")').first.click(); pg.wait_for_timeout(2000)
    # 比例 16:9、时长
    pg.locator('text=/· \\d+s/').first.click(); pg.wait_for_timeout(800)
    pg.get_by_text('16:9', exact=True).first.click(); pg.wait_for_timeout(400)
    sl = pg.locator('[role=slider]').first
    if sl.count():
        sl.focus()
        for _ in range(12): pg.keyboard.press('ArrowLeft')
        for _ in range(secs - 4): pg.keyboard.press('ArrowRight')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
    # 上传首帧
    pg.locator('input[type=file]').first.set_input_files(img)
    pg.wait_for_timeout(4000)
    pg.screenshot(path=SHOT + '.before.png')
    ed = pg.locator('[contenteditable=true]').last
    ed.click(); ed.fill(prompt); pg.wait_for_timeout(500)
    before = set(pg.evaluate(JS_VIDS))
    ed.press('Enter')
    t0 = time.time(); got = []; confirmed = False
    while time.time() - t0 < 900:
        pg.wait_for_timeout(10000)
        got = [u for u in pg.evaluate(JS_VIDS) if u not in before]
        if got: break
        # 豆包有时先回一段方案、等确认才开始生成
        if not confirmed and '确认后' in pg.evaluate("() => document.body.innerText.slice(-400)"):
            ed2 = pg.locator('[contenteditable=true]').last
            ed2.click(); ed2.fill('确认，清晰度用 1080p，开始生成'); pg.wait_for_timeout(400); ed2.press('Enter')
            confirmed = True; print('sent confirm', flush=True)
        print(f'waiting {time.time()-t0:.0f}s', pg.evaluate("() => document.body.innerText.slice(-160).replace(/\\n/g,' ')"), flush=True)
    pg.screenshot(path=SHOT + '.after.png')
    for i, u in enumerate(got):
        d = pg.evaluate(JS_FETCH, u)
        raw = base64.b64decode(d.split(',', 1)[1])
        path = out if i == 0 else f'{SHOT}_{i+1}.mp4'
        open(path, 'wb').write(raw); print('saved', path, len(raw), flush=True)
    if not got: print('NO VIDEO', flush=True)
    b.close()
