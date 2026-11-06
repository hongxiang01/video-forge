import json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.connect_over_cdp('http://[::1]:9333')
    pages = [pg for c in b.contexts for pg in c.pages]
    print([pg.url for pg in pages])
    pg = next((x for x in pages if 'doubao-chat' in x.url or 'doubao.com' in x.url), None)
    pg.wait_for_load_state('domcontentloaded')
    print(json.dumps(pg.evaluate("""() => ({
      url: location.href,
      text: document.body.innerText.slice(0, 600),
      editors: [...document.querySelectorAll('textarea,[contenteditable=true]')].map(e => e.tagName + ':' + (e.getAttribute('placeholder') || e.dataset.placeholder || '')),
      buttons: [...document.querySelectorAll('button,[role=button]')].map(b => (b.innerText || b.getAttribute('aria-label') || '').trim()).filter(Boolean).slice(0, 40),
    })"""), ensure_ascii=False, indent=1))
    pg.screenshot(path='/Users/xiaodao/mv-xue/film/.app.png')
    b.close()
