// All screen renderers

const Screens = {

  renderTitle(saves) {
    const titleEl = document.getElementById('title-art');
    if (titleEl) {
      titleEl.innerHTML = '';
      const img = document.createElement('img');
      img.src = '/imageLocations/CONANII.png';
      img.alt = 'CONAN II';
      img.style.cssText = 'max-width:500px;width:90%;height:auto;display:block;margin:0 auto;filter:drop-shadow(0 0 20px #3535cc88);';
      img.onerror = () => {
        titleEl.textContent = `
  ██████╗ ██████╗ ███╗   ██╗ █████╗ ███╗   ██╗
 ██╔════╝██╔═══██╗████╗  ██║██╔══██╗████╗  ██║
 ██║     ██║   ██║██╔██╗ ██║███████║██╔██╗ ██║
 ██║     ██║   ██║██║╚██╗██║██╔══██║██║╚██╗██║
 ╚██████╗╚██████╔╝██║ ╚████║██║  ██║██║ ╚████║
  ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═══╝
        II - L'URLO DI YMIR`;
      };
      titleEl.appendChild(img);
    }

    const savesList = document.getElementById('saves-list');
    if (!savesList) return;
    savesList.innerHTML = '';

    if (!saves || saves.length === 0) {
      savesList.innerHTML = '<div style="color:#555;font-size:11px;text-align:center;padding:10px;">NESSUN SALVATAGGIO</div>';
      return;
    }

    // CONTINUA button: load most recent save automatically
    const mostRecent = saves.reduce((a, b) => {
      const da = a.savedAt ? new Date(a.savedAt) : new Date(0);
      const db = b.savedAt ? new Date(b.savedAt) : new Date(0);
      return db > da ? b : a;
    }, saves[0]);
    const continueDiv = document.createElement('div');
    continueDiv.style.cssText = 'text-align:center;margin-bottom:12px;';
    continueDiv.innerHTML = `<button style="background:#002200;color:#3f3;border:2px solid #3f3;padding:8px 28px;font-size:13px;font-family:monospace;cursor:pointer;letter-spacing:1px;" onclick="Game.loadGame('${mostRecent.slot.replace(/'/g,"\\'")}')">▶▶ CONTINUA — ${mostRecent.nome || mostRecent.slot}</button>`;
    savesList.appendChild(continueDiv);

    // Wrap saves list in a scrollable container showing max 3 entries
    const savesScroll = document.createElement('div');
    savesScroll.style.cssText = 'max-height:180px;overflow-y:auto;';
    savesList.appendChild(savesScroll);

    saves.forEach(s => {
      const slot = s.slot;
      const el = document.createElement('div');
      el.className = 'save-entry';
      el.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #333;margin-bottom:6px;background:#0a0a16;';

      const dateStr = s.savedAt ? new Date(s.savedAt).toLocaleDateString('it-IT') : '?';

      const infoDiv = document.createElement('div');
      infoDiv.style.cssText = 'flex:1;';
      infoDiv.innerHTML = `<span class="save-name" style="color:var(--c64-gold);font-weight:bold;">${s.nome || slot}</span>
        <span class="save-info" style="margin-left:8px;font-size:10px;color:#aaa;">${s.razza||''} ${s.classe||''}</span>
        <span class="save-info" style="margin-left:8px;font-size:10px;color:#888;">${s.frammenti||0}/12 FRAG — ${dateStr}</span>`;

      const loadBtn = document.createElement('button');
      loadBtn.textContent = '▶ CARICA PARTITA';
      loadBtn.style.cssText = 'background:#001a00;color:#7f7;border:1px solid #3f3;padding:4px 10px;cursor:pointer;font-size:11px;font-family:monospace;flex-shrink:0;';
      loadBtn.addEventListener('click', () => Game.loadGame(slot));

      const delBtn = document.createElement('button');
      delBtn.style.cssText = 'background:#440000;color:#f77;border:1px solid #f44;padding:4px 8px;cursor:pointer;font-size:10px;font-family:monospace;flex-shrink:0;';
      delBtn.textContent = '✕';
      delBtn.title = 'Cancella partita';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`Cancellare la partita di ${s.nome}? Azione irreversibile.`)) return;
        try {
          await API.deleteCharacter(slot);
          const newSaves = await API.listCharacters();
          Screens.renderTitle(newSaves);
        } catch(err) { alert('Errore cancellazione: ' + err.message); }
      });

      el.appendChild(infoDiv); el.appendChild(loadBtn); el.appendChild(delBtn);
      savesScroll.appendChild(el);
    });
  },

  renderNewChar() {
    // charsheet.js handles all dropdowns, point buy, and live calc
    CS_init();
  },

  updateNames()      { /* charsheet.js handles this */ },
  newSeed()          { /* charsheet.js handles this */ },
  calcNewChar()      { /* charsheet.js handles this via calcAll() */ },
  updateSottoclassi(){ /* charsheet.js handles this via aggiornaSottoclasse() */ },

  collectCharForm() {
    const form = CS_collect();
    if (!form.nome) { alert('Seleziona un nome!'); return null; }
    return form;
  },

  // Alias for combat — re-renders with updated state
  updateCombat(state) { this.renderCombat(state); },

  // Alias for travel — re-renders with updated state
  updateTravel(state) { this.renderTravel(state, state.travelState); },

  // Alias for dialog updates
  updateDialog(state, npcId) {
    const npc = (state.currentDialogData) || { nome: npcId, id: npcId };
    const text = state.currentDialogText || '...';
    const choices = state.currentDialogChoices || [];
    this.renderDialog(npc, text, choices);
  },

  // Mini inventory for sidebar use
  renderInventoryMini(state, hudId, bagId) {
    this._renderSidebarInventory(state.character);
  },

  renderMainMenu(state) {
    const char = state.character;
    if (!char) return;

    const nameEl = document.getElementById('char-summary-name');
    const infoEl = document.getElementById('char-summary-info');
    const statsEl = document.getElementById('char-summary-stats');

    if (nameEl) nameEl.textContent = char.nome;
    if (infoEl) infoEl.textContent = `${char.razza} | ${char.classe} | ${char.sottoclasse}`;
    if (statsEl) {
      const d = char.derived || {};
      statsEl.innerHTML = `
        <div class="cs-item"><span class="cs-val">${d.hp || '?'}/${d.maxHp||'?'}</span>HP</div>
        <div class="cs-item"><span class="cs-val">${char.gold || 0}</span>ZEC</div>
        <div class="cs-item"><span class="cs-val">${(char.frammenti||[]).length}</span>/12 FRAG</div>
        <div class="cs-item"><span class="cs-val">${char.destino || 0}</span>DEST</div>`;
    }

    // Location info
    const locInfo = document.getElementById('mm-location-info');
    if (locInfo && state.locations) {
      const loc = state.locations[char.currentLocation];
      if (loc) locInfo.innerHTML = `<div style="font-size:10px;color:#888;">POS: </div><div style="color:var(--c64-gold);">${loc.n}</div><div style="font-size:10px;color:#666;">${loc.t||''} — ${loc.biome||''}</div>`;
    }

    // Active quest
    const questText = document.getElementById('mm-quest-text');
    if (questText && char.activeQuest) {
      questText.innerHTML = `<span style="color:var(--c64-orange);">${char.activeQuest}</span><br><span style="color:#aaa;">${char.questMajorStato[char.activeQuest]||'?'}</span>`;
    }

    updateGlobalHUD(char);
    document.getElementById('global-hud').style.display = 'flex';
  },

  renderCharSheet(state) {
    const char = state.character;
    if (!char) return;
    const a = char.attributes || {};
    const d = char.derived || {};
    const res = char.resistances || {};

    // Identity
    const idEl = document.getElementById('cs-identity');
    if (idEl) idEl.innerHTML = `
      <div class="panel-title">${char.nome || '?'}</div>
      <div style="display:flex;flex-wrap:wrap;gap:16px;font-size:11px;color:#ccc;">
        <span>${char.razza || '?'} / ${char.classe || '?'} / ${char.sottoclasse || '?'}</span>
        <span>ETÀ: ${char.eta || '?'}</span>
        <span>DEI: ${char.dio || '?'}</span>
        <span>BG: ${char.background || '?'}</span>
        <span style="color:var(--c64-gold);">💰 ${char.gold || 0} ZEC</span>
        ${(char.destino||0)>0 ? '<span style="color:var(--c64-gold);">⭐</span>' : ''}
        <span style="color:var(--c64-ice);">❄ ${(char.frammenti||[]).length}/12 FRAG</span>
        ${(() => { const o = char.onore || {vinte:0,fuggite:0,rese:0}; const tot = (o.vinte||0)+(o.fuggite||0)+(o.rese||0); const pct = tot>0?Math.round((o.vinte/tot)*100):100; return `<span style="color:#ffaa44;" title="V:${o.vinte} F:${o.fuggite} R:${o.rese}">⚔ ONORE: ${pct}%</span>`; })()}
        <span style="color:#888;">⏱ DURATA: ${char.durata || 0}g</span>
      </div>`;

    // Attributes
    const atEl = document.getElementById('cs-attributes');
    if (atEl) {
      const attrNames = {FOR:'Forza',DES:'Destrezza',COS:'Costituzione',RES:'Saggezza',INT:'Intelligenza',FRT:'Carisma'};
      atEl.innerHTML = '<div class="panel-title">ATTRIBUTI</div>' +
        `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">` +
        ['FOR','DES','COS','RES','INT','FRT'].map(k =>
          `<div class="nc-attr-box" style="text-align:center;">
            <div style="font-size:9px;color:#888;">${k}</div>
            <div style="font-size:18px;color:var(--c64-gold);font-weight:bold;">${a[k] || 8}</div>
            <div style="font-size:9px;color:#aaa;">${attrNames[k]}</div>
          </div>`).join('') + `</div>`;
    }

    // Combat stats
    const combEl = document.getElementById('cs-combat');
    if (combEl) {
      combEl.innerHTML = '<div class="panel-title">COMBATTIMENTO</div>' +
        `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">` +
        [['HP',`${d.hp||0}/${d.maxHp||0}`],['ATT',d.att||0],['DAN',d.dan||0],['DEF',d.def||0],['RD',d.rd||0],['INI',d.ini||0]].map(([k,v]) =>
          `<div class="nc-attr-box" style="text-align:center;">
            <div style="font-size:9px;color:#888;">${k}</div>
            <div style="font-size:16px;color:var(--c64-green);font-weight:bold;">${v}</div>
          </div>`).join('') + `</div>`;
    }

    // Skills | Traits | Resistances — 3 columns
    const skEl = document.getElementById('cs-skills');
    if (skEl) {
      const types = ['fuoco','freddo','acido','veleno','magia','fulmine','incanto'];
      const icons = {fuoco:'🔥',freddo:'❄',acido:'☣',veleno:'☠',magia:'✨',fulmine:'⚡',incanto:'🌀'};
      skEl.innerHTML = `<div style="display:flex;gap:0;border-top:1px solid #333;">
        <div style="width:23%;min-width:0;padding:8px 8px 8px 0;border-right:1px solid #333;">
          <div class="panel-title">ABILITÀ</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">${(char.skills||[]).filter(s=>!['odio','testardaggine'].includes(s.toLowerCase())).map(s=>`<span class="skill-tag">${s}</span>`).join('')}</div>
        </div>
        <div style="width:27%;min-width:0;padding:8px;border-right:1px solid #333;">
          <div class="panel-title">TRATTI</div>
          ${(char.traits||[]).map(t=>`<div style="font-size:10px;color:#aaa;margin-bottom:4px;">• ${t}</div>`).join('')}
        </div>
        <div style="width:50%;min-width:0;padding:8px 0 8px 8px;">
          <div class="panel-title">RESISTENZE</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${types.map(r=>`<div style="text-align:center;min-width:42px;"><div>${icons[r]||r}</div><div style="font-size:13px;color:${(res[r]||0)>0?'var(--c64-green)':'#444'};">${res[r]||0}</div><div style="font-size:8px;color:#666;">${r.toUpperCase()}</div></div>`).join('')}
          </div>
        </div>
      </div>`;
    }
    // cs-resistances now combined in cs-skills
    const resEl = document.getElementById('cs-resistances');
    if (resEl) resEl.style.display = 'none';

    // Equipment
    const eqEl = document.getElementById('cs-equipment');
    if (eqEl) {
      const slotLabels = {arma:'ARMA',armatura:'CORAZZA',elmo:'ELMO',amuleto:'AMULETO',anello:'ANELLO',bracciali:'BRACCIALI',cintura:'CINTURA',stivali:'STIVALI',scudo:'SCUDO'};
      eqEl.innerHTML = '<div class="panel-title">EQUIPAGGIAMENTO</div>' +
        `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px;">` +
        Object.entries(slotLabels).map(([slot,label])=>{
          const item = (char.equipment||{})[slot];
          return `<div style="border:1px solid var(--c64-border);padding:4px;font-size:10px;">
            <div style="color:#666;font-size:9px;">${label}</div>
            ${item ? `<div class="${rarityClass(item.rar||'normal')}" style="color:var(--col-${item.rar||'normal'});">${item.nome}${weaponHandsTag(item)}</div><div style="color:#888;font-size:9px;">${itemStatsText(item)}</div>` : `<div style="color:#333;">— vuoto —</div>`}
          </div>`;
        }).join('') + `</div>`;
    }

    // Inventory — ensure every item has an instanceId before rendering
    if (char.inventory) {
      char.inventory.forEach((item, idx) => {
        if (!item.instanceId) item.instanceId = `item_${idx}_${(item.nome||'x').replace(/\s/g,'_')}_${Date.now()}`;
      });
    }
    const invEl = document.getElementById('cs-inventory');
    if (invEl) {
      invEl.innerHTML = '<div class="panel-title">ZAINO</div>';
      if (!char.inventory || char.inventory.length === 0) {
        invEl.innerHTML += '<div style="color:#555;font-size:10px;">ZAINO VUOTO</div>';
      } else {
        const eq = char.equipment || {};
        invEl.innerHTML += `<div style="display:flex;flex-wrap:wrap;gap:6px;">` +
          char.inventory.map(item => {
            if (!item.nome) item.nome = item.n || '???';
            const iidAttr = (item.instanceId||'').replace(/"/g,'&quot;');
            const isLoot = (item.instanceId||'').startsWith('loot_');
            const lootBadge = isLoot ? `<span style="color:#aa6600;font-size:8px;"> [LOOT]</span>` : '';
            const isConsumable = item.tipo === 'consumabile' || item.tipo === 'consumabile_quest' || item.tipo === 'pozione';
            const slot = (typeof Game !== 'undefined') ? Game._guessSlot(item) : null;
            const is2H = slot === 'arma' && (typeof Game !== 'undefined') && Game._is2H(item);
            let actionBtn = '';
            if (isConsumable) {
              actionBtn = `<button data-iid="${iidAttr}" onclick="Game.handleInventoryAction(this.dataset.iid)" style="margin-left:4px;padding:1px 6px;background:#1a2a00;border:1px solid #5f5;color:#7f7;font-size:9px;cursor:pointer;">USA</button>`;
            } else if (slot) {
              // Determine what gets displaced
              let willDisplace = false;
              let displaceNote = '';
              if (slot === 'arma') {
                const hasWeapon = !!eq.arma;
                const hasShield = !!eq.scudo;
                if (is2H) {
                  willDisplace = hasWeapon || hasShield;
                  if (hasWeapon && hasShield) displaceNote = ' (arma+scudo)';
                  else if (hasShield) displaceNote = ' (scudo)';
                } else {
                  willDisplace = hasWeapon;
                }
              } else if (slot === 'scudo') {
                willDisplace = !!eq.scudo;
                // Equipping shield also displaces a 2H weapon
                if (!willDisplace && eq.arma && (typeof Game !== 'undefined') && Game._is2H(eq.arma)) {
                  willDisplace = true;
                  displaceNote = ' (arma 2M)';
                }
              } else {
                willDisplace = !!eq[slot];
              }
              const btnLabel = willDisplace ? `⟳ SWITCH${displaceNote}` : '✦ EQUIPAGGIA';
              const btnColor = willDisplace ? '#ffaa00' : '#7f7';
              const btnBg    = willDisplace ? '#2a1a00' : '#0a2a0a';
              const btnBdr   = willDisplace ? '#aa6600' : '#5f5';
              actionBtn = `<button data-iid="${iidAttr}" onclick="Game.handleInventoryAction(this.dataset.iid)" style="margin-left:4px;padding:1px 6px;background:${btnBg};border:1px solid ${btnBdr};color:${btnColor};font-size:9px;cursor:pointer;">${btnLabel}</button>`;
            }
            return `<div class="${rarityClass(item.rar||'normal')}" style="display:inline-flex;align-items:center;border:1px solid;padding:3px 6px;font-size:10px;margin:2px;" data-iid="${iidAttr}" onmouseenter="showItemTooltip(event,this.dataset.iid)" onmousemove="showItemTooltip(event,this.dataset.iid)" onmouseleave="hideItemTooltip()">
              ${item.nome}${weaponHandsTag(item)}${lootBadge}${actionBtn}
            </div>`;
          }).join('') + `</div>`;
      }
    }

    updateGlobalHUD(char);
  },

  renderMap(state) {
    const char = state.character;
    const locations = state.locations || [];

    updateGlobalHUD(char);

    // Build biome map
    buildBiomeMap(char.seed || 12345, locations);

    // Render markers
    renderMapMarkers(locations, char.currentLocation, (idx, loc) => {
      Game.selectDestination(idx, loc);
    });

    // Restore route arrow if destination already selected
    const existingDest = char.travelDestination;
    if (existingDest !== null && existingDest !== undefined) {
      drawRoute(char.currentLocation, existingDest, locations);
      const sel = document.getElementById('sel-dest');
      if (sel) sel.value = existingDest;
    }

    // Update HUD
    const curLoc = locations[char.currentLocation];
    const hudPos = document.getElementById('hud-pos');
    const hudType = document.getElementById('hud-type');
    const hudBiome = document.getElementById('hud-biome');
    if (hudPos && curLoc) hudPos.textContent = 'POS: ' + curLoc.n;
    if (hudType && curLoc) hudType.textContent = 'TIPO: ' + curLoc.t;
    if (hudBiome && curLoc) hudBiome.textContent = 'BIOMA: ' + curLoc.biome;

    // Populate destination select
    const sel = document.getElementById('sel-dest');
    if (sel) {
      sel.innerHTML = '<option value="" disabled selected>— seleziona destinazione —</option>' +
        locations
        .map((loc, origIdx) => {
          if (origIdx === char.currentLocation) return '';
          const locked = !loc.unlocked;
          return `<option value="${origIdx}" ${locked ? 'disabled' : ''}>${locked ? '???' : loc.n}${locked ? ' (BLOCCATA)' : ''}</option>`;
        })
        .join('');
      sel.onchange = function() {
        const idx = parseInt(this.value);
        if (!isNaN(idx)) Game.selectDestination(idx, locations[idx]);
      };
    }

    // Quest destinations panel
    this._renderQuestDestinations(char, locations);

    // Quest log sidebar
    this._renderSidebarQuests(char);
    this._renderSidebarInventory(char);
    this._renderSidebarAlliances(char);
  },

  _renderQuestDestinations(char, locations) {
    const el = document.getElementById('quest-dest-list');
    if (!el) return;

    const majorQuests = [
      {id:'M1',nome:'Il Primo Urlo',luogo:'Venarium'},
      {id:'M2',nome:'Il Canto dei Clan',luogo:'Gurth'},
      {id:'M3',nome:'La Sposa del Serpente',luogo:'Paludi Oscure'},
      {id:'M4',nome:'Il Cuore che Brucia',luogo:'Terre Vulcaniche'},
      {id:'M5',nome:'La Principessa di Ghiaccio',luogo:'Koppar'},
      {id:'M6',nome:'Il Re dei Troll',luogo:'Foreste Oscure'},
      {id:'M7',nome:'Il Mercante dell\'Ombra',luogo:'Shadizar'},
      {id:'M8',nome:'La Danza dei Morti',luogo:'Khorshemish'},
      {id:'M9',nome:'Il Tradimento',luogo:'Gurth'},
      {id:'M10',nome:'La Forgia Perduta',luogo:'Terre Vulcaniche'},
      {id:'M11',nome:'La Scalata',luogo:'Montagna'},
      {id:'M12',nome:'Il Trono di Ghiaccio',luogo:'Cima'}
    ];

    const active = majorQuests.filter(q => (char.questMajorStato || {})[q.id] === 'attiva');
    if (!active.length) {
      el.innerHTML = '<div style="color:#555;font-size:10px;">Nessuna quest attiva.</div>';
      return;
    }

    el.innerHTML = active.map(q => {
      const locIdx = locations.findIndex(l => l.n === q.luogo || l.n.includes(q.luogo.split(' ')[0]));
      const loc = locations[locIdx];
      const isHere = locIdx === char.currentLocation;
      const isLocked = loc && !loc.unlocked;
      const canTravel = locIdx >= 0 && !isHere && !isLocked;

      return `<div style="border:1px solid #442200;padding:6px;margin-bottom:5px;background:#0d0800;">
        <div style="color:var(--c64-gold);font-size:11px;font-weight:bold;">${q.id}: ${q.nome}</div>
        <div style="color:#aaa;font-size:10px;">📍 ${q.luogo}${isHere ? ' <span style="color:#7f7;">[QUI]</span>' : ''}</div>
        ${canTravel
          ? `<button class="btn-action" style="margin-top:4px;font-size:10px;padding:3px 8px;" onclick="Game.travelToQuest(${locIdx})">▶ VIAGGIA QUI</button>`
          : isHere
            ? `<button class="btn-action" style="margin-top:4px;font-size:10px;padding:3px 8px;background:#1a3a00;" onclick="Game.showLocation()">🏰 ESPLORA LOCATION</button>`
            : `<span style="color:#555;font-size:10px;">${isLocked ? '🔒 BLOCCATA' : 'Non trovata'}</span>`
        }
      </div>`;
    }).join('');
  },

  _renderSidebarQuests(char) {
    const questMap = document.getElementById('quest-major-log');
    const minorLog = document.getElementById('quest-minor-log');
    if (!questMap) return;

    // We need quest data - use the embedded reference
    const majorQuests = [
      {id:'M1',num:1,nome:'Il Primo Urlo',luogo:'Venarium'},
      {id:'M2',num:2,nome:'Il Canto dei Clan Traditi',luogo:'Gurth'},
      {id:'M3',num:3,nome:'La Sposa del Serpente',luogo:'Paludi Oscure'},
      {id:'M4',num:4,nome:'Il Cuore che Brucia',luogo:'Terre Vulcaniche'},
      {id:'M5',num:5,nome:'La Principessa di Ghiaccio',luogo:'Koppar'},
      {id:'M6',num:6,nome:'Il Re dei Troll',luogo:'Foreste Oscure'},
      {id:'M7',num:7,nome:'Il Mercante dell\'Ombra',luogo:'Shadizar'},
      {id:'M8',num:8,nome:'La Danza dei Morti',luogo:'Khorshemish'},
      {id:'M9',num:9,nome:'Il Tradimento del Mistico',luogo:'Gurth'},
      {id:'M10',num:10,nome:'La Forgia Perduta',luogo:'Terre Vulcaniche'},
      {id:'M11',num:11,nome:'La Scalata dell\'Addio',luogo:'Montagna'},
      {id:'M12',num:12,nome:'Il Trono di Ghiaccio',luogo:'Cima'}
    ];

    questMap.innerHTML = majorQuests.map(q => {
      const stato = (char.questMajorStato || {})[q.id];
      let cls = 'quest-entry major';
      let prefix = '';
      if (stato === 'completata') { cls += ' done'; prefix = '✓ '; }
      else if (stato === 'attiva') { cls += ' active'; prefix = '► '; }
      else if (!stato || stato === 'bloccata') { cls += ' locked'; prefix = '■ '; }
      else prefix = '○ ';
      return `<div class="${cls}">${prefix}M${q.num}: ${q.nome}</div>`;
    }).join('');
  },

  _renderSidebarInventory(char) {
    const armaEl = document.getElementById('inv-mini-arma');
    const armorEl = document.getElementById('inv-mini-armor');
    const amulEl = document.getElementById('inv-mini-amul');
    const anelloEl = document.getElementById('inv-mini-anello');
    if (armaEl) armaEl.textContent = (char.equipment && char.equipment.arma) ? char.equipment.arma.nome : '—';
    if (armorEl) armorEl.textContent = (char.equipment && char.equipment.armatura) ? char.equipment.armatura.nome : '—';
    if (amulEl) amulEl.textContent = (char.equipment && char.equipment.amuleto) ? char.equipment.amuleto.nome : '—';
    if (anelloEl) anelloEl.textContent = (char.equipment && char.equipment.anello) ? char.equipment.anello.nome : '—';

    const bagEl = document.getElementById('bag-area-mini');
    if (bagEl) {
      const inv = char.inventory || [];
      const cap = 10;
      if (inv.length === 0) {
        bagEl.innerHTML = '<span style="color:#555;font-size:9px;">VUOTO</span>';
      } else {
        bagEl.innerHTML = inv.slice(0, cap).map(item => {
          if (!item.nome) item.nome = item.n || '???';
          return `<span class="bag-item ${rarityClass(item.rar || 'normal')}" title="${item.nome} — clicca per equipaggiare" style="cursor:pointer" data-iid="${(item.instanceId||'').replace(/"/g,'&quot;')}" onclick="Game.handleInventoryAction(this.dataset.iid)">
            ${item.nome.substr(0,10)}
          </span>`;
        }).join('') + (inv.length >= cap ? `<span style="color:#f77;font-size:9px;display:block;margin-top:3px;">ZAINO PIENO ${inv.length}/${cap}</span>` : `<span style="color:#888;font-size:9px;display:block;margin-top:2px;">${inv.length}/${cap}</span>`);
      }
    }

    const zecEl = document.getElementById('zecchini-display');
    const destEl = document.getElementById('destino-display');
    if (zecEl) zecEl.textContent = char.gold || 0;
    if (destEl) destEl.textContent = char.destino || 0;
  },

  _renderSidebarAlliances(char) {
    const el = document.getElementById('alleanze-log');
    if (!el) return;
    if (!char.alleanze || char.alleanze.length === 0) {
      el.textContent = 'NESSUNA ALLEANZA ANCORA.';
    } else {
      el.innerHTML = char.alleanze.map(a => `<div>${a}</div>`).join('');
    }
  },

  renderLocation(state, options = {}) {
    const char = state.character;
    const locations = state.locations || [];
    const loc = locations[char.currentLocation];
    if (!loc) return;

    // Show PETSCII arrival art when player travels to a new location
    if (options.arrived) {
      setTimeout(() => this.showLocationArrival(loc), 50);
    }

    updateGlobalHUD(char);

    const nameEl = document.getElementById('loc-name');
    const artEl  = document.getElementById('loc-art');
    const descEl = document.getElementById('loc-desc');
    if (nameEl) nameEl.textContent = loc.n;
    // Use image when available, fallback to petscii text
    if (artEl) {
      // Explicit map: location name → image filename (case/space vary)
      const LOC_IMG = {
        'Venarium':           'venarium',
        'Gurth':              'Gurth',
        'Paludi Oscure':      'PaludiOscure',
        'Terre Vulcaniche':   'TerreVulcaniche',
        'Koppar':             'Koppar',
        'Foreste Oscure':     'ForesteOscure',
        'Shadizar':           'Shadizar',
        'Khorshemish':        'Khorshemish',
        'Conajohara':         'Conajohara',
        'Tarantia':           'Tarantia',
        'Zuarir':             'Zuarir',
        'Messantia':          'Messantia',
        'Montagna Luminosa':  'Montagna Luminosa',
        'Tyro':               'Tyro',
        'Arya':               'Arya',
        'Lago di OZ':         'Lago di OZ',
        'Torre Magica':       'Torre Magica',
        'Ormuz':              'Ormuz',
        'Deserto':            'Deserto',
        'Il Castello':        'Il Castello',
      };
      const imgFile = LOC_IMG[loc.n];
      artEl.innerHTML = '';
      if (imgFile) {
        const img = document.createElement('img');
        img.src = `/imageLocations/${encodeURIComponent(imgFile)}.png`;
        img.alt = loc.n;
        img.style.cssText = 'max-width:100%;max-height:220px;width:auto;object-fit:contain;border:1px solid #444;display:block;margin:0 auto 6px;';
        img.onerror = () => {
          img.remove();
          artEl.textContent = (loc.art || '').replace(/\\n/g, '\n');
        };
        artEl.appendChild(img);
      } else {
        artEl.textContent = (loc.art || '').replace(/\\n/g, '\n');
      }
    }
    if (descEl) descEl.textContent = loc.d;

    // Header
    const hdrName = document.getElementById('loc-header-name');
    const hdrType = document.getElementById('loc-header-type');
    if (hdrName) hdrName.textContent = `🏰 ${loc.n}`;
    if (hdrType) hdrType.textContent = loc.t ? loc.t.toUpperCase() : '';

    // Shops
    const shopsEl = document.getElementById('loc-shops');
    if (shopsEl) {
      const icons = { fabbro:'⚒', mistico:'📜', maga:'🔮' };
      const allShops = ['fabbro','mistico','maga'];
      shopsEl.innerHTML = allShops.map(s => {
        const avail = (loc.shops || []).includes(s);
        if (!avail) return `<button class="shop-btn disabled" disabled style="opacity:0.3;cursor:not-allowed;">${icons[s]||s} —</button>`;
        return `<button class="shop-btn ${s}" onclick="Game.openShop('${s}')">${icons[s]||s} ${s.toUpperCase()}</button>`;
      }).join('');
    }

    // NPC sidebar
    const npcEl = document.getElementById('loc-npcs');
    if (npcEl) {
      npcEl.innerHTML = loc.npcs && loc.npcs.length
        ? loc.npcs.map(n => `<div style="padding:3px 0;color:var(--c64-yellow);">💬 ${n}</div>`).join('')
        : '<div style="color:#555;">Nessun NPC presente.</div>';
    }

    // Sidebar inventory
    this._renderSidebarInventory(char);

    // Action buttons — per location type and content
    const btnsEl = document.getElementById('loc-btns');
    if (btnsEl) {
      const azioni = [];

      // Riposo available everywhere (camp/village/city) — taverna paid rest removed
      if (loc.t === 'city' || loc.t === 'village' || loc.t === 'camp') {
        azioni.push(`<button class="btn-action" onclick="Game._locAction('riposo')">🔥 RIPOSO (1 giorno)</button>`);
      }
      if (loc.t === 'dungeon') {
        azioni.push(`<button class="btn-action" onclick="Game.startRandomCombat()">⚔ ESPLORA DUNGEON</button>`);
      }

      // Per-NPC talk buttons
      if (loc.npcs && loc.npcs.length > 0) {
        const char = typeof Game !== 'undefined' ? Game.char : null;
        const m12Done = char && ((char.questMajorStato || {}).M12 === 'completata' || char.gameOver);
        loc.npcs.forEach(npcId => {
          if (npcId === 'Valthor' && m12Done) return;
          const isRealNPC = typeof Game !== 'undefined' && Game.data && Game.data.npcs && Game.data.npcs[npcId];
          if (isRealNPC) {
            azioni.push(`<button class="btn-action" onclick="Game.openNPCDialog('${npcId}')">💬 PARLA: ${npcId.toUpperCase()}</button>`);
          } else {
            azioni.push(`<button class="btn-action" style="background:#3a0000;border-color:#cc4444;color:#ff6666;" onclick="Game.openNPCDialog('${npcId}')">⚔ AFFRONTA: ${npcId.toUpperCase()}</button>`);
          }
        });
      }

      // Active quest for this location
      if (loc.questMajor) {
        const questId = `M${loc.questMajor}`;
        const stato = (char.questMajorStato || {})[questId];
        if (stato === 'attiva') {
          azioni.push(`<button class="btn-action" style="background:#3a1a00;border-color:var(--c64-gold);color:var(--c64-gold);" onclick="Game.checkQuestsAtLocation()">🗡 QUEST PRINCIPALE</button>`);
        }
      }

      btnsEl.innerHTML = azioni.join('');

      // Minor quests board
      const minorQuests = typeof Game !== 'undefined' ? Game._getMinorQuestsForLocation(loc) : [];
      const randomQuests = (!loc.noRandomQuests && minorQuests.length === 0 && typeof Game !== 'undefined') ? Game._getRandomQuestsForLocation(loc) : [];
      const allBoardQuests = minorQuests.concat(randomQuests);
      let mqHtml = '';
      if (allBoardQuests.length > 0) {
        const qms = char.questMinorStato || {};
        mqHtml = `<div style="margin-top:10px;border-top:1px solid #333;padding-top:8px;">
          <div style="color:var(--c64-yellow);font-size:10px;margin-bottom:5px;">📋 BACHECA AVVISI (${allBoardQuests.length})</div>
          ${allBoardQuests.map(q => {
            const stato = qms[q.id] || 'disponibile';
            if (stato === 'completata') {
              return `<button class="btn-action" disabled style="background:#111;border-color:#333;color:#555;font-size:10px;margin:2px 0;cursor:default;text-decoration:line-through;">✓ ${q.nome}</button>`;
            }
            if (stato === 'accettata') {
              return `<button class="btn-action" disabled style="background:#1a1400;border-color:#554400;color:#886600;font-size:10px;margin:2px 0;cursor:default;">⚔ ${q.nome} [IN CORSO]</button>`;
            }
            const color = q._isRandom ? '#aaffcc' : '#7f7';
            const border = q._isRandom ? '#226644' : '#336633';
            return `<button class="btn-action" style="background:#0a1a0a;border-color:${border};color:${color};font-size:10px;margin:2px 0;" onclick="Game.showMinorQuest('${q.id}')">📋 ${q.nome}</button>`;
          }).join('')}
        </div>`;
      }
      const existingMq = document.getElementById('loc-minor-quests');
      if (existingMq) {
        existingMq.innerHTML = mqHtml ? mqHtml : '';
      } else {
        const mqDiv = document.createElement('div');
        mqDiv.id = 'loc-minor-quests';
        mqDiv.innerHTML = mqHtml;
        btnsEl.after(mqDiv);
      }
    }

    // Hide dialog on arrival
    const dialogEl = document.getElementById('dialog-box');
    if (dialogEl) dialogEl.style.display = 'none';

    clearLog('log-local');
    addLog('log-local', `► ARRIVATO A ${(loc.n||'').toUpperCase()}!`, '#ffd700');
    addLog('log-local', loc.d || '', '#888');
    const typeMsg = { city:'CITTA\' — tutti i servizi.', village:'VILLAGGIO.', camp:'ACCAMPAMENTO.', dungeon:'DUNGEON — pericolo!', oasis:'OASI.', rovine:'ROVINE.' };
    if (typeMsg[loc.t]) addLog('log-local', typeMsg[loc.t], loc.t === 'dungeon' ? '#cc4444' : '#aaa');

    updateGlobalHUD(char);
  },

  renderTravel(state, travelResult) {
    const char = state.character;
    const locations = state.locations || [];

    updateGlobalHUD(char);

    const fromEl = document.getElementById('travel-from');
    const toEl = document.getElementById('travel-to');
    const progEl = document.getElementById('travel-progress-fill');
    const progTxt = document.getElementById('travel-progress-text');
    const eventEl = document.getElementById('travel-event-box');

    if (char.travelDestination !== null && char.travelDestination !== undefined) {
      const destLoc = locations[char.travelDestination];
      const curLoc = locations[char.currentLocation];
      if (fromEl && curLoc) fromEl.textContent = curLoc.n;
      if (toEl && destLoc) toEl.textContent = destLoc.n;

      const pct = char.travelDistance > 0 ? Math.min(100, (char.travelProgress / char.travelDistance) * 100) : 0;
      if (progEl) progEl.style.width = pct + '%';
      if (progTxt) progTxt.textContent = `TAPPA ${char.travelProgress} / ${char.travelDistance}  —  ${char.travelDistance} GIORNI DI VIAGGIO`;
    }

    if (travelResult && eventEl) {
      eventEl.className = 'travel-event ' + (travelResult.event || 'nothing');
      eventEl.textContent = travelResult.message || '';
    }
  },

  renderCombat(state) {
    const cs = state.combatState;
    if (!cs) return;

    updateGlobalHUD(state.character);

    // Enemy panel
    const eName = document.getElementById('enemy-combat-name');
    const eTier = document.getElementById('enemy-tier');
    if (eName) eName.textContent = cs.enemy.nome;
    if (eTier) eTier.textContent = `[${cs.enemy.tier || 'NORMALE'}] ${cs.enemy.tipo || ''}`;

    renderHPBar(cs.enemy.hp, cs.enemy.maxHp || cs.enemy.hp, 'enemy-hp-fill', 'enemy-hp-text');
    renderHPBar(cs.player.hp, cs.player.maxHp, 'player-hp-fill-c', 'player-hp-text-c');

    // Stats
    const statIds = { 'cstat-enemy-att': cs.enemy.att, 'cstat-enemy-dan': cs.enemy.dan, 'cstat-enemy-def': cs.enemy.def, 'cstat-enemy-rd': cs.enemy.rd };
    for (const [id, val] of Object.entries(statIds)) {
      const el = document.getElementById(id);
      if (el) el.textContent = Math.max(0, val ?? 0);
    }
    const playerStatIds = { 'cstat-player-att': cs.player.att, 'cstat-player-dan': cs.player.dan, 'cstat-player-def': cs.player.def, 'cstat-player-rd': cs.player.rd };
    for (const [id, val] of Object.entries(playerStatIds)) {
      const el = document.getElementById(id);
      if (el) el.textContent = Math.max(0, val ?? 0);
    }

    // Attr/res/elem helpers
    const ATTR_COLORS = { FOR:'#cc4422',DES:'#22aacc',COS:'#cc8822',RES:'#44aa44',INT:'#aa44cc',FRT:'#ccaa22' };
    const ELEM_COLORS = { FRE:'#44aaff',FUO:'#ff6622',VEL:'#44cc44',ACI:'#aacc22',MAG:'#aa44cc',FUL:'#ffcc00',INC:'#cc44aa',
                          freddo:'#44aaff',fuoco:'#ff6622',veleno:'#44cc44',acido:'#aacc22',magia:'#aa44cc',fulmine:'#ffcc00',incanto:'#cc44aa' };

    function renderAttrGrid(attrs) {
      const keys = ['FOR','DES','COS','RES','INT','FRT'];
      return `<div style="font-size:9px;color:#555;letter-spacing:1px;margin-bottom:3px;border-top:1px solid #1a1a1a;padding-top:4px;">ATTRIBUTI</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;">
          ${keys.map(k=>`<div style="background:#0a0a0a;border:1px solid #2a2a2a;padding:2px;text-align:center;font-size:8px;color:#555;">${k}<span style="display:block;font-size:11px;font-weight:bold;color:${ATTR_COLORS[k]};">${attrs[k]??0}</span></div>`).join('')}
        </div>`;
    }

    function renderResGrid(res, isUpperCase) {
      const entries = Object.entries(res).filter(([,v])=>v!==0);
      if (!entries.length) return '';
      return `<div style="font-size:9px;color:#555;letter-spacing:1px;margin-bottom:2px;">RES. ELEM.</div>
        <div style="display:flex;flex-wrap:wrap;gap:2px;">
          ${entries.map(([k,v])=>{
            const col = v>0?(ELEM_COLORS[k]||'#88aa88'):'#cc3333';
            const label = isUpperCase ? k : k.substring(0,3).toUpperCase();
            return `<span style="background:#0a0a0a;border:1px solid #2a2a2a;padding:1px 4px;font-size:9px;color:${col};">${label}:${v>0?'+':''}${v}</span>`;
          }).join('')}
        </div>`;
    }

    // Enemy attrs / elem / res
    const eAttrsEl = document.getElementById('comb-enemy-attrs');
    if (eAttrsEl && cs.enemy.attr) eAttrsEl.innerHTML = renderAttrGrid(cs.enemy.attr);

    const eElemEl = document.getElementById('comb-enemy-elem');
    if (eElemEl) {
      if (cs.enemy.elemDan) {
        const m = cs.enemy.elemDan.match(/(\w+)\s*\+(\d+)/);
        const col = m ? (ELEM_COLORS[m[1]]||'#aaa') : '#aaa';
        eElemEl.innerHTML = `<span style="background:#0a0a0a;border:1px solid #2a2a2a;padding:2px 6px;font-size:9px;color:${col};">⚡ ${cs.enemy.elemDan}</span>`;
      } else { eElemEl.innerHTML = ''; }
    }

    const eResEl = document.getElementById('comb-enemy-res');
    if (eResEl) eResEl.innerHTML = cs.enemy.baseRes ? renderResGrid(cs.enemy.baseRes, true) : '';

    // Player attrs / elem / res
    const pAttrsEl = document.getElementById('comb-player-attrs');
    if (pAttrsEl && state.character && state.character.attributes)
      pAttrsEl.innerHTML = renderAttrGrid(state.character.attributes);

    const pElemEl = document.getElementById('comb-player-elem');
    if (pElemEl && state.character) {
      const eq = state.character.equipment || {};
      const parts = [];
      for (const item of Object.values(eq)) {
        if (!item || !item.elemDan) continue;
        for (const [type, val] of Object.entries(item.elemDan)) {
          if (val > 0) {
            const col = ELEM_COLORS[type] || '#aaa';
            parts.push(`<span style="background:#0a0a0a;border:1px solid #2a2a2a;padding:1px 4px;font-size:9px;color:${col};">⚡ ${type.substring(0,3).toUpperCase()} +${val}</span>`);
          }
        }
      }
      pElemEl.innerHTML = parts.length
        ? `<div style="font-size:9px;color:#555;letter-spacing:1px;margin-bottom:2px;">DAN. ELEM.</div><div style="display:flex;flex-wrap:wrap;gap:2px;">${parts.join('')}</div>`
        : '';
    }

    const pResEl = document.getElementById('comb-player-res');
    if (pResEl) pResEl.innerHTML = renderResGrid(cs.player.resistances || {}, false);

    // Enemy special skills display
    const enemySkEl = document.getElementById('enemy-skills');
    if (enemySkEl) {
      const eskills = cs.enemy.skills || [];
      if (eskills.length > 0) {
        enemySkEl.innerHTML = `<div style="font-size:9px;color:#666;margin-bottom:3px;letter-spacing:1px;">ABILITÀ:</div>` +
          eskills.map(sk => `<span style="display:inline-block;background:#1a0000;border:1px solid #550000;color:#aa3333;font-size:9px;padding:1px 5px;margin:1px;">${sk}</span>`).join('');
      } else {
        enemySkEl.innerHTML = '';
      }
    }

    // Player combat skills — ATK vs DEF split
    const plSkillEl = document.getElementById('comb-player-skills');
    if (plSkillEl && state.character) {
      const ATK_SK = new Set(['Furia','Colpo Possente','Schermaglia','Carica','Lama Avvelenata','Colpo Furtivo','Dardo Oscuro','Evocazione','Maledizione','Furia Berserker','Arco Composito','Tattica','Combattimento','Scherma',"Furtivita'"]);
      const DEF_SK = new Set(['Scudo di Ferro','Tattiche di Gruppo','Guarigione','Benedizione','Visione','Resistenza al Freddo','Senso di Sopravvivenza','Schivata','Sopportazione','Disciplina','Curare']);
      const ATK_TR = ['danno', 'attacco', 'furia', 'evocar', 'ini nel primo', 'raddoppiato', 'furtivo', 'punti deboli'];
      const DEF_TR = ['bloccare', 'ignora', 'hp extra', 'guarigione', 'resistenza', 'recupera'];
      const char = state.character;
      const atkSkills = (char.skills||[]).filter(s => ATK_SK.has(s));
      const defSkills = (char.skills||[]).filter(s => DEF_SK.has(s));
      const atkTraits = (char.traits||[]).filter(t => ATK_TR.some(k => t.toLowerCase().includes(k)));
      const defTraits = (char.traits||[]).filter(t => DEF_TR.some(k => t.toLowerCase().includes(k)));
      const hasAny = atkSkills.length || defSkills.length || atkTraits.length || defTraits.length;
      if (hasAny) {
        plSkillEl.innerHTML = `<div style="display:flex;gap:6px;border-top:1px solid #333;padding-top:6px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:9px;color:var(--c64-fire);letter-spacing:1px;margin-bottom:3px;">⚔ ATTACCO</div>
            ${atkSkills.map(s=>`<span style="display:inline-block;background:#330a00;border:1px solid var(--c64-fire);color:var(--c64-fire);font-size:9px;padding:1px 5px;margin:1px;">${s}</span>`).join('')}
            ${atkTraits.map(t=>`<div style="font-size:9px;color:#cc6633;margin-top:2px;">• ${t}</div>`).join('')}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:9px;color:var(--c64-ice);letter-spacing:1px;margin-bottom:3px;">🛡 DIFESA</div>
            ${defSkills.map(s=>`<span style="display:inline-block;background:#001133;border:1px solid var(--c64-ice);color:var(--c64-ice);font-size:9px;padding:1px 5px;margin:1px;">${s}</span>`).join('')}
            ${defTraits.map(t=>`<div style="font-size:9px;color:#5599cc;margin-top:2px;">• ${t}</div>`).join('')}
          </div>
        </div>`;
      } else {
        plSkillEl.innerHTML = '';
      }
    }

    // Log
    const logEl = document.getElementById('combat-log');
    if (logEl && cs.log) {
      logEl.innerHTML = cs.log.map(l => {
        let cls = '';
        if (l.includes('COLPITO') || l.includes('SCONFITTO')) cls = 'color:var(--c64-green)';
        if (l.includes('CADUTO') || l.includes('Danno:')) cls = 'color:var(--c64-red)';
        if (l.includes('INIZIATIVA') || l.includes('turno')) cls = 'color:var(--c64-yellow)';
        return `<div style="${cls}">${l}</div>`;
      }).join('');
      logEl.scrollTop = logEl.scrollHeight;
    }

    // Enable/disable buttons
    const active = cs.active;
    ['btn-attack','btn-defend','btn-skill','btn-flee','btn-surrender'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !active;
    });

    // Turn counter
    const turnEl = document.getElementById('combat-turn');
    if (turnEl) turnEl.textContent = `TURNO ${cs.turn}${(typeof Game !== 'undefined' && Game.godMode) ? ' 🛡GOD' : ''}`;

    // Enemy skills — kept as rendered by renderCombat (don't overwrite with plain text)
  },

  renderShop(shopData, shopType, character) {
    const titleEl = document.getElementById('shop-title-name');
    const voiceEl = document.getElementById('shop-keeper-voice');
    const gridEl = document.getElementById('shop-items-grid');

    if (titleEl) titleEl.textContent = shopData.nome;
    if (voiceEl) voiceEl.textContent = shopData.voce;
    if (!gridEl) return;

    gridEl.innerHTML = '';
    (shopData.items || []).forEach(item => {
      const el = document.createElement('div');
      el.className = `shop-item ${rarityClass(item.rar || 'normal')}`;
      el.innerHTML = `
        <div class="item-name">${item.nome}</div>
        <div class="item-price">${item.prezzo || 0} ZEC</div>
        <div class="item-effect">${itemStatsText(item) || item.desc || ''}</div>`;
      el.addEventListener('mouseenter', (e) => GameTooltip.show(e, item));
      el.addEventListener('mousemove', (e) => GameTooltip._move(e));
      el.addEventListener('mouseleave', () => GameTooltip.hide());
      el.addEventListener('click', () => { GameTooltip.hide(); Game.selectShopItem(item, shopType); });
      gridEl.appendChild(el);
    });

    updateGlobalHUD(character);
  },

  renderQuestLog(state) {
    const char = state.character;
    const majorEl = document.getElementById('quest-log-major');
    const minorEl = document.getElementById('quest-log-minor');

    updateGlobalHUD(char);

    const majorQuests = [
      {id:'M1',num:1,nome:'Il Primo Urlo',luogo:'Venarium',desc:'Purifica il pozzo sacro.',ricompensa:'Frammento 1'},
      {id:'M2',num:2,nome:'Il Canto dei Clan',luogo:'Gurth',desc:'Parla col Mistico Cieco.',ricompensa:'Frammento 2'},
      {id:'M3',num:3,nome:'La Sposa del Serpente',luogo:'Paludi Oscure',desc:'Salva la figlia o allea con la Strega.',ricompensa:'Frammento 3'},
      {id:'M4',num:4,nome:'Il Cuore che Brucia',luogo:'Terre Vulcaniche',desc:'Scegli tra Golem e Djinn.',ricompensa:'Frammento 4'},
      {id:'M5',num:5,nome:'La Principessa di Ghiaccio',luogo:'Koppar',desc:'Spezza la maledizione di Elara.',ricompensa:'Frammento 5'},
      {id:'M6',num:6,nome:'Il Re dei Troll',luogo:'Foreste Oscure',desc:'Patto o combattimento col Re Troll.',ricompensa:'Frammento 6'},
      {id:'M7',num:7,nome:'Il Mercante dell\'Ombra',luogo:'Shadizar',desc:'Scopri il traditore millenario.',ricompensa:'Frammento 7'},
      {id:'M8',num:8,nome:'La Danza dei Morti',luogo:'Khorshemish',desc:'Danza con gli Spettri.',ricompensa:'Frammento 8'},
      {id:'M9',num:9,nome:'Il Tradimento del Mistico',luogo:'Gurth',desc:'Il Mistico e\' figlio di Valthor.',ricompensa:'Frammento 9'},
      {id:'M10',num:10,nome:'La Forgia Perduta',luogo:'Vulcano',desc:'Forgia il Martello del Destino.',ricompensa:'Martello del Destino'},
      {id:'M11',num:11,nome:'La Scalata dell\'Addio',luogo:'Montagna',desc:'Salita epica.',ricompensa:'Frammenti 10+11'},
      {id:'M12',num:12,nome:'Il Trono di Ghiaccio',luogo:'Montagna',desc:'Affronta Re Valthor.',ricompensa:'Corona di Ymir'}
    ];

    if (majorEl) {
      majorEl.innerHTML = majorQuests.map(q => {
        const stato = (char.questMajorStato || {})[q.id];
        let cls = 'quest-card';
        let badge = '';
        if (stato === 'completata') { cls += ' done'; badge = '<span class="quest-badge">COMPLETATA</span>'; }
        else if (stato === 'attiva') { cls += ' active'; badge = '<span class="quest-badge" style="background:#cc6600;">ATTIVA</span>'; }
        else if (!stato || stato === 'bloccata') cls += ' locked';
        return `<div class="${cls}">
          <div class="quest-name">M${q.num}: ${q.nome}${badge}</div>
          <div class="quest-loc">LUOGO: ${q.luogo}</div>
          <div class="quest-desc">${q.desc}</div>
          <div class="quest-reward">RICOMPENSA: ${q.ricompensa}</div>
        </div>`;
      }).join('');
    }

    if (minorEl) {
      const minorQuests = (typeof Game !== 'undefined' && Game.data && Game.data.quests && Game.data.quests.minor) ? Game.data.quests.minor : [];
      const allLocations = (typeof Game !== 'undefined' && Game.data && Game.data.locations) ? Game.data.locations : [];
      const unlockedLocs = char.unlockedLocations || [];
      const qms = char.questMinorStato || {};
      const visible = minorQuests.filter(q => q.stato !== 'bloccata');
      if (visible.length === 0) {
        minorEl.innerHTML = '<div style="color:#555;font-size:11px;">Nessuna missione secondaria disponibile.</div>';
      } else {
        minorEl.innerHTML = visible.map(q => {
          const stato = qms[q.id] || 'disponibile';
          // Check if quest's bioma location is unlocked
          const biomaNorm = (q.bioma || '').toLowerCase();
          const locIdx = allLocations.findIndex(l => (l.n || '').toLowerCase() === biomaNorm);
          const locLocked = locIdx >= 0 && !unlockedLocs.includes(locIdx);
          let cls = 'quest-card';
          let badge = '';
          if (stato === 'completata') { cls += ' done'; badge = '<span class="quest-badge">COMPLETATA</span>'; }
          else if (stato === 'accettata') { cls += ' active'; badge = '<span class="quest-badge" style="background:#006633;">IN CORSO</span>'; }
          else if (locLocked) { cls += ' locked'; }
          // Resolve bioma → all matching locations
          const matchingLocs = allLocations
            .map((l, i) => ({ l, i }))
            .filter(({ l }) => (l.biome||'').toLowerCase() === biomaNorm || (l.n||'').toLowerCase() === biomaNorm);
          const locNames = matchingLocs.map(({ l }) => l.n).join(' / ') || q.bioma;
          const travelBtns = matchingLocs
            .filter(({ i }) => !locLocked && unlockedLocs.includes(i) && i !== (char.currentLocation))
            .map(({ l, i }) => `<button style="font-size:9px;padding:2px 6px;margin-top:3px;background:#001a1a;border:1px solid #336633;color:#7fb;cursor:pointer;font-family:monospace;" onclick="Game.travelDirectTo(${i})">📍 VAI A ${l.n.toUpperCase()}</button>`)
            .join('');

          if (locLocked && stato !== 'completata') {
            return `<div class="${cls}">
              <div class="quest-name" style="color:#555;">${q.nome}</div>
              <div class="quest-loc" style="color:#444;font-size:10px;">🔒 ZONA BLOCCATA: ${q.bioma} (${locNames}) — Sblocca prima questa area</div>
            </div>`;
          }
          const npcInfo = q.npc ? `<div style="font-size:10px;color:#88ccff;margin-top:2px;">NPC: ${q.npc} — cerca a ${locNames}</div>` : '';
          return `<div class="${cls}">
            <div class="quest-name">${q.nome}${badge}</div>
            <div class="quest-loc" style="color:#557733;">ZONA: ${q.bioma} → <span style="color:#aaffcc;">${locNames}</span></div>
            ${npcInfo}
            <div class="quest-reward" style="font-size:10px;">${q.ris1 || ''}</div>
            ${travelBtns}
          </div>`;
        }).join('');
      }
    }
  },

  renderQuestAtLocation(char, quest, loc) {
    const stato = (char.questMajorStato || {})[quest.id] || 'bloccata';
    if (stato !== 'attiva') {
      addLog('log-local', stato === 'completata' ? `✓ Quest già completata: ${quest.nome}` : `■ Quest bloccata.`, stato === 'completata' ? '#7f7' : '#888');
      return;
    }

    addLog('log-local', `► MISSIONE ATTIVA: ${quest.nome}`, '#ffd700');
    addLog('log-local', quest.desc || '', '#aaa');

    // Use choice1/choice2 (quests.json field names)
    const c1 = quest.choice1 || quest.scelta1;
    const c2 = quest.choice2 || quest.scelta2;
    const cDesc = quest.choiceDesc || quest.desc || '';

    const box = document.getElementById('dialog-box');
    if (!box) return;
    box.style.display = 'block';

    const speaker = document.getElementById('dialog-speaker');
    const text = document.getElementById('dialog-text');
    const choices = document.getElementById('dialog-choices');

    if (speaker) speaker.textContent = `🗡 MISSIONE: ${quest.nome}`;
    if (text) text.textContent = cDesc;
    if (choices) {
      let btns = '';
      if (c1) btns += `<button class="dialog-choice" onclick="Game.iniziaQuestMajor('${quest.id}', 1)">${c1}</button>`;
      if (c2) btns += `<button class="dialog-choice" onclick="Game.iniziaQuestMajor('${quest.id}', 2)">${c2}</button>`;
      btns += `<button class="dialog-choice" style="background:#1a0a00;color:#888;" onclick="document.getElementById('dialog-box').style.display='none';addLog('log-local','⏳ MISSIONE IN SOSPESO — torna qui quando sei pronto per completarla.','#888')">⏳ TORNA DOPO</button>`;
      choices.innerHTML = btns;
    }
  },

  renderDialog(npcData, dialogText, choices) {
    const box = document.getElementById('dialog-box');
    const speaker = document.getElementById('dialog-speaker');
    const text = document.getElementById('dialog-text');
    const choicesEl = document.getElementById('dialog-choices');

    if (!box) return;
    box.style.display = 'block';
    if (speaker) speaker.textContent = npcData.nome || 'SCONOSCIUTO';
    if (text) text.textContent = dialogText || '...';
    if (choicesEl && choices) {
      choicesEl.innerHTML = choices.map(c =>
        `<button class="dialog-choice" onclick="Game.makeDialogChoice('${npcData.id}', '${c.id}')">${c.text}</button>`
      ).join('');
    }
  },

  // ── PETSCII LOCATION ARRIVAL ART ─────────────────────────────────────────

  _biomeColors(biome, type) {
    const b = (biome || '').toLowerCase();
    const t = (type  || '').toLowerCase();
    if (t === 'dungeon' && b === 'vulcano') return { bg:'#1a0000', fg:'#ff6600', art:'#ffaa00', gnd:'#660000' };
    if (t === 'dungeon' && b === 'foresta') return { bg:'#060e06', fg:'#44cc55', art:'#88ff88', gnd:'#0a1a0a' };
    if (t === 'dungeon' && b === 'palude')  return { bg:'#061206', fg:'#55aa66', art:'#33cc55', gnd:'#0a1a08' };
    if (t === 'dungeon' && b === 'montagna')return { bg:'#111122', fg:'#88aacc', art:'#cceeff', gnd:'#222233' };
    if (t === 'dungeon')                    return { bg:'#0d000d', fg:'#aa55cc', art:'#cc88ff', gnd:'#1a001a' };
    if (b === 'tundra')   return { bg:'#1a2a44', fg:'#aaccff', art:'#ddeeff', gnd:'#334466' };
    if (b === 'picchi')   return { bg:'#1a1a26', fg:'#aaaacc', art:'#ccccee', gnd:'#333344' };
    if (b === 'vulcano')  return { bg:'#1a0000', fg:'#ff5500', art:'#ffaa00', gnd:'#440000' };
    if (b === 'palude')   return { bg:'#060e08', fg:'#44aa66', art:'#66cc88', gnd:'#0a1a0c' };
    if (b === 'foresta')  return { bg:'#060e06', fg:'#33bb44', art:'#66dd77', gnd:'#0a1a0a' };
    if (b === 'rovine')   return { bg:'#141400', fg:'#bbbb44', art:'#ffff66', gnd:'#282800' };
    if (b === 'deserto')  return { bg:'#2a1800', fg:'#ffcc44', art:'#ffee88', gnd:'#6a4410' };
    if (b === 'montagna') return { bg:'#111a22', fg:'#88aacc', art:'#bbddff', gnd:'#223344' };
    if (t === 'oasis')    return { bg:'#0a1a00', fg:'#55cc44', art:'#88ff66', gnd:'#1a3300' };
    if (t === 'city')     return { bg:'#0a0022', fg:'#8866ff', art:'#ccaaff', gnd:'#1a0044' };
    if (t === 'village')  return { bg:'#0a1200', fg:'#66aa44', art:'#99cc66', gnd:'#142200' };
    return                       { bg:'#0a0a0a', fg:'#cccccc', art:'#ffffff', gnd:'#1a1a1a' };
  },

  _biomeArt(biome, type, locName) {
    const b = (biome || '').toLowerCase();
    const t = (type  || '').toLowerCase();

    // ── VULCANO ──────────────────────────────────────────
    if (b === 'vulcano') return `
████████████████████████████
█                          █
█     ░░   /\\   ░░         █
█    ░░░  /▓▓\\  ░░░        █
█   ░░░░ /▓▓▓▓\\ ░░░░       █
█  ░░░░ /▓▓▓▓▓▓\\ ░░░░      █
████████████████████████████
▓▓▒▒░░  MAGMA  ░░▒▒▓▓▓▓▓▓▓`.trim();

    // ── FORESTA ──────────────────────────────────────────
    if (b === 'foresta') return `
████████████████████████████
█  ▲  ▲▲ ▲  ▲▲  ▲ ▲▲  ▲  █
█ ███ ██ ██ ███ ██ ██  ██  █
█ ███ ██ ██ ███ ██ ██  ██  █
█  █   █  █  ██  █  █   █  █
████████████████████████████
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓`.trim();

    // ── PALUDE ───────────────────────────────────────────
    if (b === 'palude') return `
████████████████████████████
█  |   |  ≋≋  |   |  ≋≋  █
█  |   |       |  ≋  |   █
█ ≋|≋≋≋|≋≋≋≋≋≋|≋≋≋≋|≋≋≋≋ █
█  ≋  ≋≋  ≋≋  ≋≋≋  ≋≋  ≋ █
████████████████████████████
▓▓▓▓▓▓ ACQUA NERA ▓▓▓▓▓▓▓▓`.trim();

    // ── TUNDRA ───────────────────────────────────────────
    if (b === 'tundra') return `
████████████████████████████
█  *         *      *      █
█       *        *     *   █
█  ▄▄▄      ▄▄▄     ▄▄▄   █
█ █▓▓▓█    █▓▓▓█   █▓▓▓█  █
████████████████████████████
▓▓▓▓▓▓▓▓ TUNDRA ▓▓▓▓▓▓▓▓▓▓`.trim();

    // ── PICCHI ───────────────────────────────────────────
    if (b === 'picchi') return `
████████████████████████████
█    *         *     *     █
█        /\\        /\\      █
█   /\\  /▓▓\\  /\\ /▓▓\\  /\\ █
█  /▓▓\\/▓▓▓▓\\/▓▓\/▓▓▓▓\\/▓▓\\ █
████████████████████████████
▓▓▓▓▓▓▓▓ PICCHI ▓▓▓▓▓▓▓▓▓▓`.trim();

    // ── MONTAGNA ─────────────────────────────────────────
    if (b === 'montagna') return `
████████████████████████████
█   *   *   *   *   *     █
█          /\\              █
█    /\\   /▒▒\\   /\\        █
█   /▒▒\\ /▒▒▒▒\\ /▒▒\\      █
████████████████████████████
▓▓▓▓▓▓▓ MONTAGNA ▓▓▓▓▓▓▓▓▓`.trim();

    // ── ROVINE ───────────────────────────────────────────
    if (b === 'rovine') return `
████████████████████████████
█  ╔╗    ╔╗   ╔══╗   ╔╗   █
█  ╠╬════╬╬═══╬▓▓╬═══╬╣   █
█  ║║    ║║   ║▓▓║   ║║   █
█  ║║    ║║   ╚══╝   ║║   █
████████████████████████████
▓▓▓▓▓▓▓▓ ROVINE ▓▓▓▓▓▓▓▓▓▓`.trim();

    // ── DESERTO ──────────────────────────────────────────
    if (b === 'deserto') return `
████████████████████████████
█  ░   ░░   ░  ░░   ░  ░  █
█ ░░░  ░░░ ░░ ░░░░ ░░░░░  █
█░░░░░░░░░░░░░░░░░░░░░░░░░ █
█░░░░░░░░░░░░░░░░░░░░░░░░░ █
████████████████████████████
▓▓▓▓▓▓▓▓ DESERTO ▓▓▓▓▓▓▓▓▓`.trim();

    // ── COSTA ────────────────────────────────────────────
    if (b === 'costa') return `
████████████████████████████
█  ▲   ▲   ▲    ⛵          █
█══╧═══╧═══╧══             █
█  █   █   █    ≈≈≈≈≈≈≈≈  █
█  ███████████  ≈≈≈≈≈≈≈≈  █
████████████████████████████
≈≈≈≈≈≈≈≈ PORTO ≈≈≈≈≈≈≈≈≈≈≈`.trim();

    // ── CITY ─────────────────────────────────────────────
    if (t === 'city') return `
████████████████████████████
█  ██  █  ██  █  ████  ██  █
█  ██  █  ██  █  ████  ██  █
█  ╔══╗█  ╔══╗█  ╔══╗  ██  █
█  ║▓▓║█  ║▓▓║█  ║▓▓║  ██  █
████████████████████████████
▓▓▓▓▓▓▓▓  CITTA'  ▓▓▓▓▓▓▓▓`.trim();

    // ── OASIS ────────────────────────────────────────────
    if (t === 'oasis') return `
████████████████████████████
█  ░░░░░░░░░░░░░░░░░░░░░  █
█  ░   /\\  *  /\\    ░░   █
█  ░  /▓▓\\ * /▓▓\\   ░    █
█  ░ ≈≈≈≈≈≈≈≈≈≈≈≈  ░░░░  █
████████████████████████████
░░░░░░░░░ OASI ░░░░░░░░░░░░`.trim();

    // ── VILLAGE ──────────────────────────────────────────
    if (t === 'village') return `
████████████████████████████
█       /\\      /\\          █
█      /▓▓\\    /▓▓\\         █
█  /\\ /▓▓▓▓\\  /▓▓▓▓\\ /\\   █
█ /▓▓\\▓▓▓▓▓▓\\/▓▓▓▓▓▓/▓▓\\ █
████████████████████████████
▓▓▓▓▓▓▓▓ VILLAGGIO ▓▓▓▓▓▓▓▓`.trim();

    // ── CAMP ─────────────────────────────────────────────
    if (t === 'camp') return `
████████████████████████████
█                    *  *  █
█    /\\     /\\             █
█   /▓▓\\   /▓▓\\  [TENDA]  █
█  /▓▓▓▓\\_/▓▓▓▓\\          █
████████████████████████████
▓▓▓▓▓▓▓▓ AVAMPOSTO ▓▓▓▓▓▓▓▓`.trim();

    // ── DUNGEON ──────────────────────────────────────────
    return `
████████████████████████████
█▓▓▓  ▒▒▒▒▒▒▒▒▒▒▒▒  ▒▒▓▓▓█
█▓▓  ▒▒   ░░░░░░   ▒▒  ▓▓█
█▓▓▒▒░░  ENTRATA   ░░▒▒▓▓█
█▓▓▒░░░░░░░░░░░░░░░░░░▒▓▓█
█▓▓▒░   |      |   ░░▒▓▓▓█
████████████████████████████`.trim();
  },

  showLocationArrival(loc) {
    const existing = document.getElementById('arrival-overlay');
    if (existing) existing.remove();

    const col = this._biomeColors(loc.biome, loc.t);
    const art = this._biomeArt(loc.biome, loc.t, loc.n);

    const overlay = document.createElement('div');
    overlay.id = 'arrival-overlay';
    overlay.style.cssText = [
      'position:fixed','top:0','left:0','right:0','bottom:0',
      `background:${col.bg}`,
      'display:flex','flex-direction:column','align-items:center','justify-content:center',
      'font-family:"Courier New",Courier,monospace',
      'z-index:9000','cursor:pointer',
      'user-select:none'
    ].join(';');

    const locName = (loc.n || '').toUpperCase();
    const locType = (loc.t || '').toUpperCase();
    const locBiome = (loc.biome || '').toUpperCase();

    overlay.innerHTML = `
      <div style="text-align:center;max-width:620px;padding:20px;">
        <div style="font-size:10px;letter-spacing:4px;margin-bottom:6px;color:${col.fg};opacity:0.5;">
          ════════════ ARRIVO ════════════
        </div>
        <div style="font-size:28px;letter-spacing:8px;margin-bottom:4px;color:#ffd700;font-weight:bold;
                    font-family:'Courier New',monospace;
                    text-shadow:0 0 12px #ffd700cc,0 0 24px #ffd70066;">
          ${locName}
        </div>
        <div style="font-size:9px;letter-spacing:3px;margin-bottom:14px;color:${col.fg};opacity:0.55;
                    font-family:'Courier New',monospace;">
          ◄ ${locType} — ${locBiome} ►
        </div>
        <div style="border:2px solid ${col.fg}44;background:#000;padding:4px;display:inline-block;
                    box-shadow:0 0 20px ${col.art}44,inset 0 0 10px #00000088;">
          <pre style="font-family:'Courier New',Courier,monospace;font-size:14px;line-height:1.4;
                      margin:0;white-space:pre;text-align:left;
                      color:${col.art};text-shadow:0 0 4px ${col.art}88;">${art}</pre>
        </div>
        <div style="font-size:9px;letter-spacing:3px;color:${col.fg};margin-top:12px;opacity:0.4;
                    font-family:'Courier New',monospace;">
          ════ PREMI UN TASTO PER CONTINUARE ════
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const dismiss = (e) => {
      if (e && e.type === 'keydown' && e.key === 'Tab') return;
      overlay.remove();
      document.removeEventListener('keydown', dismiss);
    };
    overlay.addEventListener('click', dismiss);
    document.addEventListener('keydown', dismiss);
    // Auto-dismiss after 6s
    setTimeout(() => { if (document.getElementById('arrival-overlay')) { overlay.remove(); document.removeEventListener('keydown', dismiss); } }, 6000);
  },

  renderEnding(state) {
    const char = state.character;
    const titleEl = document.getElementById('ending-title');
    const textEl = document.getElementById('ending-text');
    const fragsEl = document.getElementById('ending-frags');

    const endings = {
      liberation: {
        title: 'CIMMERIA E\' LIBERA!',
        text: `${char.nome} ha distrutto la Corona di Ymir. Il ghiaccio millenario si scioglie sotto il caldo sole di primavera. I clan di Cimmeria si radunano per la prima volta in secoli. Hai salvato la tua terra. Crom ti guarda con rispetto — e tace, come sempre.`
      },
      king: {
        title: 'IL RE DI CIMMERIA!',
        text: `${char.nome} ha indossato la Corona di Ymir. Il freddo ti scorre nelle vene, ma non ti spezza. Sei il nuovo Re di Cimmeria — non per sangue o tradimento, ma per acciaio e volonta'. La Principessa Elara siede al tuo fianco. Il Mistico ti consiglia nell'ombra. L'era del ghiaccio e' finita. L'era di Conan ha inizio.`
      },
      betrayal: {
        title: 'IL TRADIMENTO FINALE',
        text: `${char.nome} ha scelto il ghiaccio. Cimmeria soffre, ma il tuo potere e' immenso. Nell'oscurita' del tuo trono gelato, senti i sussurri dei morti. Hai vinto... ma a quale prezzo?`
      }
    };

    const ending = endings[char.ending] || endings.liberation;
    if (titleEl) titleEl.textContent = ending.title;
    if (textEl) textEl.textContent = ending.text;
    if (fragsEl) fragsEl.textContent = `FRAMMENTI RACCOLTI: ${(char.frammenti||[]).length} / 12`;
  },

  // Refresh only the bulletin board div — called after quest completion to update grey styling
  _refreshBulletinBoard(state, loc) {
    const char = state.character;
    const existingMq = document.getElementById('loc-minor-quests');
    if (!existingMq || !char) return;
    const minorQuests = typeof Game !== 'undefined' ? Game._getMinorQuestsForLocation(loc) : [];
    const randomQuests = (minorQuests.length === 0 && typeof Game !== 'undefined') ? Game._getRandomQuestsForLocation(loc) : [];
    const allBoardQuests = minorQuests.concat(randomQuests);
    if (!allBoardQuests.length) return;
    const qms = char.questMinorStato || {};
    const mqHtml = `<div style="margin-top:10px;border-top:1px solid #333;padding-top:8px;">
      <div style="color:var(--c64-yellow);font-size:10px;margin-bottom:5px;">📋 BACHECA AVVISI (${allBoardQuests.length})</div>
      ${allBoardQuests.map(q => {
        const stato = qms[q.id] || 'disponibile';
        if (stato === 'completata') {
          return `<button class="btn-action" disabled style="background:#111;border-color:#333;color:#555;font-size:10px;margin:2px 0;cursor:default;text-decoration:line-through;">✓ ${q.nome}</button>`;
        }
        if (stato === 'accettata') {
          return `<button class="btn-action" disabled style="background:#1a1400;border-color:#554400;color:#886600;font-size:10px;margin:2px 0;cursor:default;">⚔ ${q.nome} [IN CORSO]</button>`;
        }
        const color = q._isRandom ? '#aaffcc' : '#7f7';
        const border = q._isRandom ? '#226644' : '#336633';
        return `<button class="btn-action" style="background:#0a1a0a;border-color:${border};color:${color};font-size:10px;margin:2px 0;" onclick="Game.showMinorQuest('${q.id}')">📋 ${q.nome}</button>`;
      }).join('')}
    </div>`;
    existingMq.innerHTML = mqHtml;
  },

  renderWalkthrough() {
    const el = document.getElementById('walkthrough-content');
    if (!el) return;
    const sec = (color, txt) => `<div style="color:${color};font-size:12px;font-weight:bold;margin:18px 0 8px 0;">${txt}</div>`;
    const mqCard = (id, title, loc, body, unlock) => `
      <div style="border:1px solid #2a4a2a;padding:10px;background:#0a120a;margin-bottom:8px;">
        <div style="color:var(--c64-green);font-weight:bold;">${id} — ${title} <span style="color:#666;font-weight:normal;">[${loc}]</span></div>
        <div style="color:#aaa;margin-top:4px;font-size:11px;">${body}</div>
        ${unlock ? `<div style="color:var(--c64-gold);font-size:10px;margin-top:4px;">SBLOCCA → ${unlock}</div>` : ''}
      </div>`;
    const smCard = (title, loc, body) => `
      <div style="border:1px solid #333;padding:8px;background:#0a0a12;">
        <div style="color:var(--c64-cyan);font-size:11px;font-weight:bold;">${title} <span style="color:#666;">[${loc}]</span></div>
        <div style="color:#999;font-size:10px;margin-top:3px;">${body}</div>
      </div>`;

    el.innerHTML = `
<div style="color:var(--c64-gold);font-size:15px;font-weight:bold;border-bottom:2px solid var(--c64-gold);margin-bottom:16px;padding-bottom:8px;">
  ❄ L'URLO DI YMIR — LA STORIA COMPLETA
</div>
<div style="color:var(--c64-ice);font-size:12px;margin-bottom:16px;font-style:italic;line-height:1.7;">
  In principio Ymir urlò — e dal suo urlo nacque il gelo eterno che ricoprì Cimmeria.<br>
  Re Valthor il Gelido ha spezzato la Corona del dio in 12 Frammenti nascosti per Hyboria.<br>
  Se li riunisce, l'Urlo si ripete e il mondo muore nel ghiaccio.<br>
  Tu sei l'unico che può fermarlo.
</div>
${sec('var(--c64-yellow)', '── QUEST PRINCIPALE ──────────────────────────────')}
${mqCard('[M1]', 'IL PRIMO URLO', 'Venarium',
  'Il pozzo sacro è profanato dallo Spettro di Acheron, prima eco dell\'Urlo di Ymir. Purificalo. <em>Scelta:</em> onore (+Destino) o inganno (meno HP persi).',
  'Gurth')}
${mqCard('[M2]', 'IL CANTO DEI CLAN TRADITI', 'Gurth',
  'Un capo clan corrotto dall\'eco di Valthor. Il Mistico Cieco conosce la verità. <em>Scelta:</em> duello aperto (rispetto) o consulta il Mistico (+INT, segreti).',
  'Conajohara, Paludi Oscure')}
${mqCard('[M3]', 'LA SPOSA DEL SERPENTE', 'Paludi Oscure',
  'La figlia del capo prigioniera del Grande Serpente. La Strega delle Paludi offre un patto. <em>Scelta:</em> alleanza (Mantello garantito) o combatti solo (+COS).',
  'Terre Vulcaniche')}
${mqCard('[M4]', 'IL CUORE CHE BRUCIA', 'Terre Vulcaniche',
  'Golem di Magma vs Djinn della Tempesta — uno deve morire. <em>Scelta:</em> salva Djinn (favore futuro) o Golem (armi migliori).',
  'Koppar, Zuarir')}
${mqCard('[M5]', 'LA PRINCIPESSA DI GHIACCIO', 'Koppar',
  'Elara imprigionata dalla maledizione del ghiaccio nelle miniere. Spezza l\'incantesimo — non ucciderla. <em>Scelta:</em> alleanza (+FRT) o vai solo.',
  'Foreste Oscure')}
${mqCard('[M6]', 'IL RE DEI TROLL', 'Foreste Oscure',
  'Il Re Troll controlla i passi verso nord. Vuole alleanza contro Valthor. <em>Scelta:</em> patto (alleati nel finale) o combattimento (+FOR).',
  'Shadizar')}
${mqCard('[M7]', "IL MERCANTE DELL'OMBRA", 'Shadizar',
  'Un mercante millenario raccoglie Frammenti per Valthor nell\'ombra. <em>Scelta:</em> uccidi (+Destino) o interroga (posizioni extra Frammenti).',
  'Khorshemish')}
${mqCard('[M8]', 'LA DANZA DEI MORTI', 'Khorshemish',
  'Spettri di Acheron danzano nell\'antica città. Il Re Spettrale detiene il Frammento in un enigma. <em>Scelta:</em> danza (+RES permanente) o combatti (+Destino).',
  'Gurth (ritorno)')}
${mqCard('[M9]', 'IL TRADIMENTO DEL MISTICO ⚠', 'Gurth',
  '<strong style="color:#ff9966;">RIVELAZIONE:</strong> Il Mistico è figlio di Valthor — ma vuole spezzare la catena. <em>Scelta CRITICA:</em> perdona (alleato eterno + via segreta) o uccidi (-2 Destino).',
  'Terre Vulcaniche (ritorno)')}
${mqCard('[M10]', 'LA FORGIA PERDUTA', 'Terre Vulcaniche',
  'Con tutti i 9 Frammenti forgia il Martello del Destino nella lava viva — l\'unica arma che spezza la Corona di Ymir.',
  'Montagna Luminosa')}
<div style="border:1px solid #3a3a1a;padding:10px;background:#12120a;margin-bottom:8px;">
  <div style="color:var(--c64-yellow);font-weight:bold;">[M11] LA SCALATA DELL'ADDIO [Montagna Luminosa]</div>
  <div style="color:#aaa;margin-top:4px;font-size:11px;">Scalata epica. I fantasmi di tutti i PNG riappaiono. Trovi Frammenti 10 e 11. <em>Scelta:</em> chiedi aiuto agli alleati (+5 Destino) o vai solo (+3 FOR). SBLOCCA → Cima</div>
</div>
<div style="border:1px solid #3a1a1a;padding:10px;background:#120a0a;margin-bottom:8px;">
  <div style="color:#ff6666;font-weight:bold;">[M12] IL TRONO DI GHIACCIO ★ FINALE ★</div>
  <div style="color:#aaa;margin-top:4px;font-size:11px;">Valthor sul Trono di Ymir con la Corona riassemblata. Combatti col Martello del Destino.</div>
  <div style="color:#ff9966;font-size:11px;margin-top:6px;">
    <strong>FINALE A — LIBERAZIONE:</strong> Distruggi la Corona. Cimmeria libera.<br>
    <strong>FINALE B — RE DI CIMMERIA:</strong> Indossa la Corona. Diventi il nuovo Re di Ghiaccio.<br>
    <strong>FINALE C — SEGRETO:</strong> Elara + Troll + Mistico alleati + 12/12 Frammenti + Destino alto.
  </div>
</div>
${sec('var(--c64-yellow)', '── QUEST SECONDARIE ──────────────────────────────')}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
${smCard('Caccia al Lupo Mannaro', 'Gurth', 'Uccidi il lupo prima dell\'alba → Pelle + Zanna Argentata + 40 Zec +1 Destino.')}
${smCard('Il Caravaniere Scomparso', 'Conajohara', 'Recupera la merce dai cultisti → Cotta di Maglia + 60 Zec + Pergamena +2 INT.')}
${smCard('La Vendetta del Djinn', 'Picchi', 'Duello col Djinn traditore → Anello Fulmine +1 Destino +FRT.')}
${smCard('Il Ponte dei Troll', 'Foreste Oscure', 'Patto o duello col Re Troll → Ascia dei Troll +FOR.')}
${smCard('La Tomba del Sacerdote', 'Khorshemish', 'Danza con gli Spettri → Frammento Minore +2 RES permanente.')}
${smCard('La Carovana delle Sabbie', 'Zuarir', 'Difendi i mercanti → Daga Stigiana + 30 Zec +DES.')}
${smCard('Il Figlio Perduto della Strega', 'Paludi (dopo M3)', 'Salva il figlio → Mantello Scaglie Viventi + Alleanza permanente.')}
${smCard('Bounty: Il Cacciatore di Teschi', 'Venarium', 'Taglia bacheca → Trofeo +1 Destino + 50 Zec.')}
${smCard('La Miniera Infestata', 'Koppar', 'Ripulisci le miniere per Elara → Piastre Ghiaccio Eterno + 150 Zec +COS.')}
</div>
${sec('var(--c64-yellow)', '── CONSIGLI STRATEGICI ───────────────────────────')}
<div style="display:grid;gap:5px;font-size:11px;margin-bottom:24px;">
  <div style="color:#7f7;">✦ Perdona il Mistico [M9] → via segreta + alleato nel finale.</div>
  <div style="color:#7f7;">✦ Destino alto sblocca Finale C.</div>
  <div style="color:#7f7;">✦ Lupo Mannaro + Bounty Teschi subito — facili, alto ritorno Destino.</div>
  <div style="color:#7f7;">✦ Elara + Troll + Mistico + 12/12 Frammenti → Finale C segreto.</div>
  <div style="color:#ff9966;">⚠ Non uccidere Elara [M5] — perdi Frammento 5.</div>
  <div style="color:#ff9966;">⚠ Servono tutti 12 Frammenti alla Forgia [M10].</div>
</div>
<div style="color:#555;font-size:10px;text-align:center;padding-top:12px;border-top:1px solid #222;">
  CROM NON SENTE LE TUE PREGHIERE. MA HA DATO TUTTO IL RESTO.
</div>`;
  }
};
