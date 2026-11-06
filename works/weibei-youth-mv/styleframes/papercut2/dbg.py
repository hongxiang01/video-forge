import functools, http.server, os, threading
from playwright.sync_api import sync_playwright
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory='.'))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.path.expanduser('~/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'), args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1920, 'height': 1080}); pg.goto(f'http://127.0.0.1:{srv.server_port}/index.html'); pg.wait_for_function('window.READY === true', timeout=120000)
    print(pg.evaluate('''() => { const {THREE, camera, kid, kidBlob} = window.DBG; window.renderAt(0.33);
      const out = {}; const box = new THREE.Box3().setFromObject(kid.root); out.box = [box.min.toArray(), box.max.toArray()];
      out.root = kid.root.position.toArray(); out.blob = [kidBlob.position.toArray(), kidBlob.scale.toArray(), kidBlob.material.opacity, kidBlob.visible];
      const pr = (v) => { const q = new THREE.Vector3(...v).project(camera); return [Math.round((q.x+1)/2*1920), Math.round((1-q.y)/2*1080)]; };
      out.ground_root = pr([kid.root.position.x, 0, kid.root.position.z]); out.ground_09 = pr([kid.root.position.x, 0, 0.9]); out.ground_065 = pr([kid.root.position.x, 0, 0.65]);
      return JSON.stringify(out); }'''))
    b.close()
srv.shutdown()
