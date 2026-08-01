// UI Helpers

// ── ITEM TOOLTIP ──────────────────────────────────────────────────────────────
const GameTooltip = {
  _el: null,
  _getEl() {
    if (!this._el) {
      this._el = document.createElement('div');
      this._el.id = 'game-tooltip';
      this._el.style.cssText = [
        'position:fixed','z-index:9900','pointer-events:none',
        'background:#0a0a1c','border:1px solid #3535cc',
        'color:#ccc','font-family:monospace','font-size:11px',
        'padding:6px 10px','max-width:220px','display:none',
        'white-space:pre-wrap','line-height:1.5',
        'box-shadow:0 0 8px #3535cc55'
      ].join(';');
      document.body.appendChild(this._el);
    }
    return this._el;
  },
  show(e, item) {
    if (!item) return;
    const el = this._getEl();
    // Stats: direct item.comb/attr OR via item.effetto.comb/attr
    const eff = item.effetto || {};
    const statsItem = itemStatsText(item);
    const statsEff = itemStatsText({ comb: eff.comb, attr: eff.attr, elemDan: eff.elemDan, res: eff.res });
    const stats = statsItem || statsEff || '';
    const tipo = item.tipo || item.slot || '';
    const rar = (item.rar || 'normal').toUpperCase();
    const prezzo = item.prezzo ? `Valore: ${item.prezzo} ZEC` : '';
    const effHp = eff.hp ? `+${eff.hp} HP` : '';
    const effDur = eff.durata ? `Durata: ${eff.durata} turni` : '';
    const isLoot = (item.instanceId || '').startsWith('loot_');
    const lootTag = isLoot ? '[LOOT]' : '';
    const handsTag = weaponHandsTag(item);
    const lines = [
      `◆ ${item.nome}${handsTag}${lootTag ? '  ' + lootTag : ''}`,
      `${tipo}${tipo ? ' ' : ''}[${rar}]`,
      stats || '',
      effHp || '',
      effDur || '',
      prezzo || '',
    ].filter(Boolean).join('\n');
    el.textContent = lines;
    el.style.display = 'block';
    this._move(e);
  },
  _move(e) {
    const el = this._getEl();
    const x = Math.min(e.clientX + 14, window.innerWidth - 240);
    const y = Math.min(e.clientY + 14, window.innerHeight - 120);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  },
  hide() {
    const el = this._getEl();
    el.style.display = 'none';
  },
  init() {
    // Hide on any click, scroll, or key — covers re-renders that destroy mouseleave targets
    document.addEventListener('click',   () => this.hide(), true);
    document.addEventListener('scroll',  () => this.hide(), true);
    document.addEventListener('keydown', () => this.hide(), true);
    // Hide when mouse leaves the viewport
    document.addEventListener('mouseleave', () => this.hide());
  }
};

function showItemTooltip(e, iid) {
  if (typeof Game === 'undefined' || !Game.char || !iid) return;
  const inv = Game.char.inventory || [];
  const item = inv.find(i => i.instanceId === iid) || inv.find(i => i.nome === iid);
  if (item) GameTooltip.show(e, item);
}

function hideItemTooltip() { GameTooltip.hide(); }
// ─────────────────────────────────────────────────────────────────────────────

let _currentScreen = 'screen-title';

function _doShowScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.classList.remove('active-screen');
  });
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    el.classList.add('active-screen');
  }
  _currentScreen = id;
}

function showScreen(id) {
  if (!window.__noHistPush) {
    history.pushState({ screen: id }, '', '#' + id.replace('screen-',''));
  }
  _doShowScreen(id);
}

// Prevent browser back from exiting the page
window.addEventListener('popstate', function(e) {
  const screen = (e.state && e.state.screen) || 'screen-title';
  // Don't push another state — just switch visuals
  window.__noHistPush = true;
  _doShowScreen(screen);
  window.__noHistPush = false;

  if (screen === 'screen-title') {
    const hud = document.getElementById('global-hud');
    if (hud) hud.style.display = 'none';
    if (typeof Game !== 'undefined' && Game.char) {
      Game.char = null;
      Game.combatState = null;
      Game.travelState = null;
    }
  } else if (typeof Game !== 'undefined' && Game.char) {
    if (screen === 'screen-main-menu')  { window.__noHistPush = true; Game.showMainMenu();  window.__noHistPush = false; }
    else if (screen === 'screen-map')         { window.__noHistPush = true; Game.showMap();      window.__noHistPush = false; }
    else if (screen === 'screen-location')    { window.__noHistPush = true; Game.showLocation(); window.__noHistPush = false; }
    else if (screen === 'screen-quest')       { window.__noHistPush = true; Game.showQuestLog(); window.__noHistPush = false; }
    else if (screen === 'screen-character')   { window.__noHistPush = true; Game.showCharSheet();window.__noHistPush = false; }
  }
});

// Expose globally so UI.showScreen() also works
const UI = { showScreen, addLog, clearLog, renderHPBar };

function addLog(boxId, text, cls) {
  const box = document.getElementById(boxId);
  if (!box) return;
  const line = document.createElement('div');
  line.className = 'log-line' + (cls ? ' ' + cls : '');
  line.textContent = text;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function clearLog(boxId) {
  const box = document.getElementById(boxId);
  if (box) box.innerHTML = '';
}

function renderHPBar(current, max, fillId, textId) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const fill = document.getElementById(fillId);
  const txt = document.getElementById(textId);
  if (fill) fill.style.width = pct + '%';
  if (txt) txt.textContent = `${current} / ${max}`;
}

function renderFragPips(frammenti, total) {
  const container = document.getElementById('frag-pips');
  const counter = document.getElementById('frag-count-hud');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 1; i <= (total || 12); i++) {
    const pip = document.createElement('span');
    pip.className = 'frag-pip' + (frammenti.includes(i) ? ' lit' : '');
    pip.title = `Frammento ${i}`;
    container.appendChild(pip);
  }
  if (counter) counter.textContent = frammenti.length + '/' + (total || 12);
}

function rarityClass(rar) {
  const map = { normal: 'rar-normal', special: 'rar-special', rare: 'rar-rare', legend: 'rar-legend', unique: 'rar-unique' };
  return map[rar] || 'rar-normal';
}

function formatStatBonus(val) {
  if (val === undefined || val === null || val === 0) return '';
  return val > 0 ? `+${val}` : `${val}`;
}

function itemStatsText(item) {
  if (!item) return '';
  const parts = [];
  if (item.comb) {
    for (const [k, v] of Object.entries(item.comb)) {
      if (v !== 0) parts.push(`${k.toUpperCase()}${formatStatBonus(v)}`);
    }
  }
  if (item.attr) {
    for (const [k, v] of Object.entries(item.attr)) {
      if (v !== 0) parts.push(`${k}${formatStatBonus(v)}`);
    }
  }
  if (item.elemDan) {
    for (const [k, v] of Object.entries(item.elemDan)) {
      parts.push(`${k.toUpperCase()}${formatStatBonus(v)}`);
    }
  }
  if (item.res) {
    for (const [k, v] of Object.entries(item.res)) {
      if (v !== 0) parts.push(`Rid.${k}${formatStatBonus(v)}`);
    }
  }
  return parts.join(' ');
}

function slotLabel(item) {
  if (!item) return '';
  const tipo = (item.tipo || '').toLowerCase();
  if (tipo === 'consumabile' || tipo === 'pozione') return '🧪 Consumabile';
  if (tipo === 'materiale') return '📦 Materiale';
  const SLOT_IT = {
    'Testa':'🪖 Elmo', 'testa':'🪖 Elmo',
    'Collo':'📿 Amuleto', 'collo':'📿 Amuleto',
    'Bracciali':'🔗 Bracciali', 'bracciali':'🔗 Bracciali',
    'Cintura':'🔘 Cintura', 'cintura':'🔘 Cintura',
    'AnelloDX':'💍 Anello', 'anellodx':'💍 Anello', 'Dita':'💍 Anello',
    'Stivali':'👢 Stivali', 'stivali':'👢 Stivali',
    'Torso':'🛡 Armatura', 'torso':'🛡 Armatura',
    'Scudo':'🛡 Scudo', 'scudo':'🛡 Scudo',
    'Arma':'⚔ Arma 1M', 'arma':'⚔ Arma 1M', 'Arma1M':'⚔ Arma 1M',
    'Arma2M':'⚔ Arma 2M', 'arma2m':'⚔ Arma 2M',
    'Arco':'🏹 Arco', 'arco':'🏹 Arco',
    'Frammento':'❄ Frammento'
  };
  return SLOT_IT[item.slot] || (item.slot ? `[${item.slot}]` : '');
}

function weaponHandsTag(item) {
  if (!item) return '';
  const sl = (item.slot || '').toLowerCase();
  const isWeaponSlot = sl === 'arma' || sl === 'arma1m' || sl === 'arma2m' || sl === 'arco';
  if (!isWeaponSlot) return '';
  const is2H = sl === 'arma2m' ||
    !!(item.nome || '').toLowerCase().match(/arco|balestra|due mani|a due|ascia da guerra|\b2m\b/);
  return is2H ? ' [2M]' : ' [1M]';
}

function buildBiomeMap(seed, locations) {
  const layer = document.getElementById('biome-layer');
  if (!layer) return;
  layer.innerHTML = '';
  const img = document.createElement('img');
  img.src = 'imageLocations/MappaDellaCimmeria.png';
  img.style.cssText = 'width:100%;height:100%;object-fit:fill;display:block;';
  layer.appendChild(img);
}

function renderMapMarkers(locations, currentIdx, onMarkerClick) {
  const layer = document.getElementById('markers-layer');
  const svg = document.getElementById('route-svg');
  if (!layer) return;
  layer.innerHTML = '';
  if (svg) { const _l = svg.querySelector('#the-line'); if (_l) { _l.setAttribute('x1','0'); _l.setAttribute('y1','0'); _l.setAttribute('x2','0'); _l.setAttribute('y2','0'); } }

  locations.forEach((loc, i) => {
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.style.left = loc.x + '%';
    marker.style.top = loc.y + '%';

    const dot = document.createElement('div');
    const isCurrent = i === currentIdx;
    const isLocked = !loc.unlocked;
    dot.className = `marker-dot ${loc.t || 'camp'} ${isCurrent ? 'current' : ''} ${isLocked ? 'locked' : ''}`;

    const lbl = document.createElement('div');
    lbl.className = 'marker-label' + (isCurrent ? ' current' : '') + (isLocked ? ' locked' : '');
    lbl.textContent = isLocked ? '???' : loc.n;

    marker.appendChild(dot);
    marker.appendChild(lbl);

    if (!isLocked && onMarkerClick) {
      marker.style.cursor = 'pointer';
      marker.addEventListener('click', () => onMarkerClick(i, loc));
    }

    layer.appendChild(marker);
  });
}

function drawRoute(fromIdx, toIdx, locations) {
  const svg = document.getElementById('route-svg');
  if (!svg) return;
  const line = svg.querySelector('#the-line');
  if (!line) return;

  const from = locations[fromIdx];
  const to = locations[toIdx];
  if (!from || !to) { line.setAttribute('x1','0'); line.setAttribute('y1','0'); line.setAttribute('x2','0'); line.setAttribute('y2','0'); return; }

  line.setAttribute('x1', from.x + '%');
  line.setAttribute('y1', from.y + '%');
  line.setAttribute('x2', to.x + '%');
  line.setAttribute('y2', to.y + '%');
}

function petsciiArt(type) {
  const arts = {
    title: `
  ██████╗ ██████╗ ███╗   ██╗ █████╗ ███╗   ██╗    ██╗██╗
 ██╔════╝██╔═══██╗████╗  ██║██╔══██╗████╗  ██║    ██║██║
 ██║     ██║   ██║██╔██╗ ██║███████║██╔██╗ ██║    ██║██║
 ██║     ██║   ██║██║╚██╗██║██╔══██║██║╚██╗██║    ╚═╝╚═╝
 ╚██████╗╚██████╔╝██║ ╚████║██║  ██║██║ ╚████║    ██╗██╗
  ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═══╝    ╚═╝╚═╝`,
    subtitle: "L'URLO DI YMIR",
    sword: `
      /\\
     /  \\
    / !! \\
   /______\\
       |
       |
      / \\`,
    mountain: `
    /\\      /\\
   /  \\    /  \\
  / /\\ \\  / /\\ \\
 /_/  \\_\\/_/  \\_\\`,
    skull: `
  .---.
 /     \\
| () () |
 \\ ^   /
  |||||
  |||||`
  };
  return arts[type] || '';
}

function updateGlobalHUD(character) {
  if (!character) return;
  const hpEl = document.getElementById('hud-hp');
  const goldEl = document.getElementById('hud-gold');
  const destEl = document.getElementById('hud-dest');
  const fragEl = document.getElementById('hud-frags-count');
  const posEl = document.getElementById('hud-pos');

  if (hpEl) hpEl.textContent = `HP: ${character.derived ? character.derived.hp || '?' : '?'}/${character.derived ? character.derived.maxHp || '?' : '?'}`;
  if (goldEl) goldEl.textContent = `${character.gold || 0} ZEC`;
  if (destEl) destEl.textContent = (character.destino || 0) > 0 ? `⭐` : ``; // mystery — count hidden
  if (fragEl) fragEl.textContent = `FRAG: ${(character.frammenti || []).length}/12`;
  const onoreEl = document.getElementById('hud-onore');
  const durataEl = document.getElementById('hud-durata');
  if (onoreEl) {
    const o = character.onore || { vinte: 0, fuggite: 0, rese: 0 };
    const tot = (o.vinte || 0) + (o.fuggite || 0) + (o.rese || 0);
    const pct = tot > 0 ? Math.round((o.vinte / tot) * 100) : 100;
    onoreEl.textContent = `ONORE: ${pct}%`;
    onoreEl.title = `Vittorie: ${o.vinte} | Fughe: ${o.fuggite} | Rese: ${o.rese}`;
  }
  if (durataEl) durataEl.textContent = `DURATA: ${character.durata || 0}g`;
  const poisonEl = document.getElementById('hud-poison');
  if (poisonEl) {
    const pdmg = character.poisonDmgPerDay || 0;
    if (pdmg > 0) {
      poisonEl.textContent = `☠ VELENO: -${pdmg} HP/g`;
      poisonEl.style.display = '';
    } else {
      poisonEl.style.display = 'none';
    }
  }
  renderFragPips(character.frammenti || []);
}
