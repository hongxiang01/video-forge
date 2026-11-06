// 骨骼贴图人偶测试：t=0 静止姿势 vs 原设定图；t=1 走路四个相位；t=2 蹲、抬手、弯腰、坐
import { renderFrame, drawSlate, cam, characterLayers } from './main.js';
import { drawFox, TEX, HEADS, BODY, useRig } from './puppet.js';
import { RIG } from './rig.js';
const load = (f) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = f; });
for (const who of ['kid', 'adult']) { for (let k = 0; k < 6; k++) HEADS[who].push(await load(`design/${who}_c${k}.png`)); HEADS[who].push(await load(`design/${who}_c0b.png`)); TEX[who] = await load(`design/tex_${who}.png`); }
await useRig('kid'); await useRig('adult');
const ART = { kid: await load('design/body/kid_c.png'), adult: await load('design/body/adult_c.png') };
const one = (api, who, P) => { const G = characterLayers(api, [P.x - 700, -1400, P.x + 700, 120]); drawFox(G, who, { boil: api.boil, tailPh: 0, tailAmp: 0, ...P }); G.done(); };
const art = (api, who, x) => { const R = RIG[who], c = api.board; c.save(); api.applyCam(c); c.globalAlpha = 0.9; c.translate(x, 0); c.scale(R.k, R.k); c.drawImage(ART[who], -R.ox, -R.ground); c.restore(); };
window.renderAt = (t) => renderFrame(t, (t, api) => {
  drawSlate(api.board);
  if (t < 0.5) {
    cam.x = 900; cam.y = -480; cam.s = 0.95;
    art(api, 'kid', 0); one(api, 'kid', { x: 420, face: 1 });
    art(api, 'adult', 1100); one(api, 'adult', { x: 1650, face: 1 });
  } else if (t < 1.5) {
    cam.x = 1100; cam.y = -480; cam.s = 0.62;
    for (let i = 0; i < 4; i++) {
      const ph = i / 4 * 2 * Math.PI, st = 70, fwd = (p) => Math.sin(p) * st;
      for (const [who, x0] of [['kid', -300], ['adult', 1300]]) {
        const B = BODY[who];
        one(api, who, { x: x0 + i * (who === 'kid' ? 380 : 450), face: 1, feet: { n: [fwd(ph) + B.hipW * 0.45, 0], f: [fwd(ph + Math.PI) - B.hipW * 0.5, 0] }, footLift: { n: Math.max(0, Math.cos(ph)) * 26, f: Math.max(0, Math.cos(ph + Math.PI)) * 26 }, swingN: -Math.sin(ph) * 0.5, swingF: Math.sin(ph) * 0.5, bob: -Math.abs(Math.sin(ph)) * 6 });
      }
    }
  } else {
    cam.x = 1300; cam.y = -480; cam.s = 0.6;
    const B = BODY.adult, K = BODY.kid;
    one(api, 'kid', { x: -350, face: 1, crouch: 0.75, expr: 4 });
    one(api, 'kid', { x: 50, face: 1, hands: { n: [150, -K.sh - 40], f: [-145, -K.sh - 30] }, elbowN: 1, elbowF: -1, expr: 1 });
    one(api, 'kid', { x: 450, face: 1, crouch: 2.2, lean: 0.25, hands: { n: [110, -60], f: [70, -70] }, expr: 2 });
    one(api, 'adult', { x: 1000, face: 1, hands: { n: [150, -B.sh - 120] }, expr: 0 });
    one(api, 'adult', { x: 1450, face: 1, crouch: 1.6, lean: 0.55, hands: { n: [200, -60] }, feet: { n: [60, 0], f: [-40, 0] }, expr: 2 });
    one(api, 'adult', { x: 1950, face: -1, crouch: 2.6, hands: { n: [120, -250], f: [90, -240] }, feet: { n: [130, 0], f: [100, 0] }, expr: 0 });
    one(api, 'adult', { x: 2500, face: 1, lean: 0.12, hands: { n: [60, -B.sh + 70], f: [70, -B.sh + 60] }, expr: 2 });
  }
});
window.READY = true;
