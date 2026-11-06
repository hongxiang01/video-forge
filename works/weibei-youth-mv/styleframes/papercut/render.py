"""逐帧渲染：python render.py 输出目录 [起秒 止秒 fps]；只给一个秒数 = 出单张静帧"""
import base64, functools, http.server, os, sys, threading
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
args = [float(a) for a in sys.argv[2:]]
times = [args[0]] if len(args) == 1 else [args[0] + i / args[2] for i in range(int(round((args[1] - args[0]) * args[2])))]
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=HERE))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.path.expanduser('~/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'), args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    pg.on('console', lambda m: print('console:', m.text) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: print('pageerror:', e))
    pg.goto(f'http://127.0.0.1:{srv.server_port}/index.html' + os.environ.get('Q', '')); pg.wait_for_function('window.READY === true', timeout=120000)
    for i, t in enumerate(times):
        d = pg.evaluate('(t) => { window.renderAt(t); return document.querySelector("canvas").toDataURL("image/png"); }', t)
        open(f'{out}/f{i:04d}.png', 'wb').write(base64.b64decode(d.split(',', 1)[1]))
        if i % 15 == 0: print('frame', i, f'{t:.2f}s', flush=True)
    b.close()
srv.shutdown()
