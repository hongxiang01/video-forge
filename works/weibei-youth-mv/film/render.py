"""并行逐帧渲染：python render.py 输出目录 起秒 止秒 fps [进程数]；或 python render.py 输出目录 --times 1.0,2.5,...（出静帧）
每个进程一个无头浏览器，各渲一段连续帧。文件名 f{全局帧号:05d}.png（--times 时 t{秒}.png）。"""
import base64, functools, http.server, os, sys, threading, multiprocessing as mp
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
EXE = os.path.expanduser('~/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell')
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
def serve():
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start(); return srv
def work(args):
    out, jobs, wid = args
    from playwright.sync_api import sync_playwright
    srv = serve()
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EXE, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = b.new_page(viewport={'width': 1920, 'height': 1080})
        pg.on('pageerror', lambda e: print(f'[w{wid}] pageerror:', e, flush=True))
        pg.on('console', lambda m: print(f'[w{wid}]', m.text, flush=True) if m.type == 'error' else None)
        pg.goto(f'http://127.0.0.1:{srv.server_port}/film/index.html'); pg.wait_for_function('window.READY === true', timeout=300000)
        for i, (name, t) in enumerate(jobs):
            if os.path.exists(f'{out}/{name}'): continue
            d = pg.evaluate('(t) => { window.renderAt(t); return document.querySelector("canvas").toDataURL("image/png"); }', t)
            open(f'{out}/{name}', 'wb').write(base64.b64decode(d.split(',', 1)[1]))
            if i % 60 == 0: print(f'[w{wid}] {i}/{len(jobs)} t={t:.2f}', flush=True)
        b.close()
    srv.shutdown()
if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    if sys.argv[2] == '--times':
        jobs = [(f't{float(x):08.3f}.png', float(x)) for x in sys.argv[3].split(',')]; n = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    else:
        t0, t1, fps = float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]); n = int(sys.argv[5]) if len(sys.argv) > 5 else 1
        f0 = round(t0 * fps); f1 = round(t1 * fps)
        jobs = [(f'f{f:05d}.png', f / fps) for f in range(f0, f1)]
    chunks = [jobs[i * len(jobs) // n:(i + 1) * len(jobs) // n] for i in range(n)]
    with mp.Pool(n) as pool: pool.map(work, [(out, c, i) for i, c in enumerate(chunks)])
