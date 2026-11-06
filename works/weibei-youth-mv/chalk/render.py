"""粉笔版渲染：python render.py 输出目录 起秒 止秒 fps [进程数] [页面]；或 --times 1,2 [进程数] [页面]；或 --ranges a-b,c-d fps [进程数] [页面]"""
import base64, functools, http.server, os, sys, threading, multiprocessing as mp
ROOT = os.path.dirname(os.path.abspath(__file__))
EXE = os.path.expanduser('~/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell')
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
def work(args):
    out, jobs, wid, page = args
    from playwright.sync_api import sync_playwright
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EXE, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = b.new_page(viewport={'width': 1920, 'height': 1080})
        pg.on('pageerror', lambda e: print(f'[w{wid}] pageerror:', e, flush=True))
        pg.on('console', lambda m: print(f'[w{wid}]', m.text, flush=True) if m.type in ('error',) else None)
        pg.goto(f'http://127.0.0.1:{srv.server_port}/{page}'); pg.wait_for_function('window.READY === true', timeout=600000)
        for i, (name, t) in enumerate(jobs):
            if os.path.exists(f'{out}/{name}'): continue
            d = pg.evaluate('(t) => { window.renderAt(t); return document.querySelector("canvas").toDataURL("image/png"); }', t)
            open(f'{out}/{name}', 'wb').write(base64.b64decode(d.split(',', 1)[1]))
            if i % 60 == 0: print(f'[w{wid}] {i}/{len(jobs)} t={t:.2f}', flush=True)
        b.close()
    srv.shutdown()
if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    if sys.argv[2] == '--ranges':   # 只重渲几段：--ranges 11.37-22.81,25.1-25.3 fps [进程数] [页面]（帧名同整片，直接覆盖）
        fps = float(sys.argv[4]); n = int(sys.argv[5]) if len(sys.argv) > 5 else 1; page = sys.argv[6] if len(sys.argv) > 6 else 'index.html'
        fr = sorted({f for r in sys.argv[3].split(',') for f in range(round(float(r.split('-')[0]) * fps), round(float(r.split('-')[1]) * fps))})
        jobs = [(f'f{f:05d}.png', f / fps) for f in fr]
    elif sys.argv[2] == '--times':
        jobs = [(f't{float(x):08.3f}.png', float(x)) for x in sys.argv[3].split(',')]; n = int(sys.argv[4]) if len(sys.argv) > 4 else 1; page = sys.argv[5] if len(sys.argv) > 5 else 'index.html'
    else:
        t0, t1, fps = float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]); n = int(sys.argv[5]) if len(sys.argv) > 5 else 1; page = sys.argv[6] if len(sys.argv) > 6 else 'index.html'
        jobs = [(f'f{f:05d}.png', f / fps) for f in range(round(t0 * fps), round(t1 * fps))]
    chunks = [jobs[i * len(jobs) // n:(i + 1) * len(jobs) // n] for i in range(n)]
    with mp.Pool(n) as pool: pool.map(work, [(out, c, i, page) for i, c in enumerate(chunks)])
