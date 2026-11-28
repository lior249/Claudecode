'use strict';

// Widgets iPhone (Scriptable) : les chiffres (élève, coach), la page d'installation, et le script exécuté dans un faux Scriptable.
const test = require('node:test');
const assert = require('node:assert');
const { monter, cookieSession, ADMIN } = require('./aide');
const { scriptWidget } = require('../src/widgets');

const E1 = '700000000000000091';

// Un faux Scriptable : juste ce que le script utilise ; on note les textes affichés.
async function executer(script, donnees, { famille = 'small', param = '' } = {}) {
  const textes = [];
  const pile = () => ({ addText: (t) => { textes.push(t); return {}; }, addStack: () => pile(), addSpacer() {}, addImage: () => ({}), addDate: () => ({ applyRelativeStyle() {}, applyTimerStyle() {} }),
    layoutVertically() {}, centerAlignContent() {}, setPadding() {} });
  class ListWidget { constructor() { Object.assign(this, pile()); } setPadding() {} presentMedium() {} }
  class DrawContext { addPath() {} setFillColor() {} fillPath() {} setStrokeColor() {} setLineWidth() {} strokePath() {} getImage() { return {}; } }
  class Path { move() {} addLine() {} closeSubpath() {} }
  class DateFormatter { string() { return 'sam. 28 nov. · 15:00'; } }
  const Color = function () {}; Color.white = () => ({});
  const Font = { heavySystemFont: () => ({}), mediumSystemFont: () => ({}) };
  const Request = function () { this.loadJSON = async () => donnees; };
  const Script = { setWidget() {}, complete() {} };
  const f = new Function('args', 'config', 'Request', 'ListWidget', 'Color', 'Font', 'DrawContext', 'Size', 'Point', 'Path', 'DateFormatter', 'Script',
    `return (async () => { ${script} })();`);
  await f({ widgetParameter: param }, { widgetFamily: famille, runsInWidget: true }, Request, ListWidget, Color, Font, DrawContext, function () {}, function () {}, Path, DateFormatter, Script);
  return textes.join(' | ');
}

test('widgets : les chiffres de l\'élève (revenus, courbe, voisins au classement, flamme) et du coach ; page d\'installation ; script', async () => {
  const m = await monter({ bob: { parcours: new Proxy({}, { get: () => async () => true }) } });
  try {
    m.parcours.assurer(E1, { pseudo: 'awa_27' }); m.parcours.changerEtape(E1, 4);
    m.parcours.assurer('700000000000000092', { pseudo: 'bilal' }); m.parcours.changerEtape('700000000000000092', 4);
    const page = await (await m.get('/widgets', { cookie: cookieSession(E1, 'awa_27') })).text();
    assert.match(page, /Scriptable[\s\S]*Copier mon script[\s\S]*URL_DONNEES[\s\S]*duo/);
    const url = /const URL_DONNEES = &quot;([^&]+)&quot;/.exec(page)[1].replace(/^https?:\/\/[^/]+/, '');
    const d = await (await m.get(url)).json();
    assert.strictEqual(d.coach, false);
    assert.strictEqual(d.revenus.serie.length, 29);
    assert.strictEqual(d.classement.voisins.filter((v) => v.moi).length, 1);
    assert.strictEqual((await m.get('/api/widget?t=faux')).status, 401);
    const pc = await (await m.get('/widgets', { cookie: cookieSession(ADMIN, 'coach') })).text();
    const uc = /const URL_DONNEES = &quot;([^&]+)&quot;/.exec(pc)[1].replace(/^https?:\/\/[^/]+/, '');
    const dc = await (await m.get(uc)).json();
    assert.strictEqual(dc.coach, true); assert.ok('traiter' in dc);
    // Le script, dans tous ses modes, sans erreur.
    const s = scriptWidget('https://overmaxx.online/api/widget?t=x');
    assert.match(await executer(s, d), /OVERMAXX®[\s\S]*Revenus[\s\S]*\$0/);
    assert.match(await executer(s, d, { famille: 'medium' }), /Revenus[\s\S]*Classement[\s\S]*Toi/);
    for (const param of ['classement', 'flamme', 'objectif', 'coaching']) await executer(s, d, { param });
    const sc = scriptWidget('https://overmaxx.online/api/widget?t=x', { coach: true });
    assert.match(await executer(sc, dc), /À traiter/);
    assert.match(await executer(sc, dc, { famille: 'medium' }), /Ma journée/);
    for (const param of ['coaching', 'challenge']) await executer(sc, dc, { param });
    assert.match(await executer(s, { erreur: 'Lien invalide' }), /Lien invalide/);
  } finally { await m.fermer(); }
});
