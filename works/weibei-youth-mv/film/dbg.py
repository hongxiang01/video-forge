import functools, http.server, os, threading, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.abspath('.')) + '/weibei-youth-mv'
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.expanduser('~/video-forge/works/weibei-youth-mv')))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.path.expanduser('~/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'), args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1920, 'height': 1080}); pg.goto(f'http://127.0.0.1:{srv.server_port}/film/index.html'); pg.wait_for_function('window.READY === true', timeout=300000)
    print(pg.evaluate(sys.argv[1]))
    b.close()
srv.shutdown()
