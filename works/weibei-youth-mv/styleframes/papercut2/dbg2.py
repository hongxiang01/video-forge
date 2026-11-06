import base64, functools, http.server, os, threading
from playwright.sync_api import sync_playwright
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory='.'))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.path.expanduser('~/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'), args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1920, 'height': 1080}); pg.goto(f'http://127.0.0.1:{srv.server_port}/index.html'); pg.wait_for_function('window.READY === true', timeout=120000)
    print(pg.evaluate('''() => { const {kidBlob} = window.DBG; const m = kidBlob.material;
      return JSON.stringify({transparent: m.transparent, depthTest: m.depthTest, side: m.side, hasMap: !!m.map, img: m.map.image.width, rot: kidBlob.rotation.toArray(), parent: !!kidBlob.parent, layers: kidBlob.layers.mask}); }'''))
    d = pg.evaluate('''() => { const {kidBlob, THREE} = window.DBG; window.renderAt(0.33); kidBlob.scale.set(3,3,1); kidBlob.material.opacity=1; kidBlob.material.color.set(0xff0000);
       window.DBG.camera.updateMatrixWorld(); const r = document.querySelector('canvas'); 
       return null; }''')
    d = pg.evaluate('''() => { const {kidBlob} = window.DBG; const R = window.renderAt; return null; }''')
    b.close()
srv.shutdown()
