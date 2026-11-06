import { renderFrame, drawSlate, cam, characterLayers } from './main.js';
import { drawFox, TEX, HEADS } from './puppet.js';
const load = (f) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = f; });
for (const who of ['kid', 'adult']) { for (let k = 0; k < 6; k++) HEADS[who].push(await load(`design/${who}_c${k}.png`)); HEADS[who].push(await load(`design/${who}_c0b.png`)); TEX[who] = await load(`design/tex_${who}.png`); }
window.renderAt = (t) => renderFrame(t, (t, api) => {
  cam.x = 0; cam.y = -300; cam.s = 1;
  drawSlate(api.board);
  const ph = t * 2 * Math.PI * 1.1, st = 60, fwd = (p) => Math.sin(p) * st;
  const one = (who, P) => { const G = characterLayers(api, [P.x - 500, -1000, P.x + 500, 80]); drawFox(G, who, { boil: api.boil, ...P }); G.done(); };
  one('kid', { x: -480, face: 1, feet: { n: [fwd(ph) + 18, 0], f: [fwd(ph + Math.PI) - 22, 0] }, footLift: { n: Math.max(0, Math.cos(ph)) * 24, f: Math.max(0, Math.cos(ph + Math.PI)) * 24 }, swingN: -Math.sin(ph) * 0.5, swingF: Math.sin(ph) * 0.5, bob: -Math.abs(Math.sin(ph)) * 5, tailPh: t * 5, expr: 0 });
  one('kid', { x: 60, face: -1, hands: { n: [60, -420], f: [-95, -430] }, elbowN: -1, elbowF: 1, expr: 1, tailPh: t * 6, tailAmp: 0.5 });
  one('adult', { x: 620, face: -1, headTilt: 0.08, expr: 0, tailPh: t * 1.5, tailAmp: 0.12 });
  one('adult', { x: -60, y: 0, face: 1, scale: 0.0001 });
});
window.READY = true;
