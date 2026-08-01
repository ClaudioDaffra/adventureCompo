// ══════════════════════════════════════════════
// GAME CONTROLLER — CONAN II L'URLO DI YMIR
// Thick-client: tutta la logica di gioco qui.
// ══════════════════════════════════════════════

const Game = {
  // ── Stato globale ──────────────────────────
  data: null,          // dati statici (races, classes, enemies, locations...)
  char: null,          // personaggio attivo (include tutto lo stato di gioco)
  combatState: null,   // stato combattimento corrente
  travelState: null,   // stato viaggio corrente
  rng: null,           // generatore casuale seeded
  godMode: false,      // GOD mode: player immune to damage

  // ── INIT ──────────────────────────────────
  async init() {
    try {
      this.data = await API.loadGameData();
      const saves = await API.listCharacters();
      Screens.renderTitle(saves);
      showScreen('screen-title');
    } catch (e) {
      console.error('Init error:', e);
      document.body.innerHTML = `<div style="color:#f00;padding:20px;font-family:monospace;">
        ERRORE AVVIO: ${e.message}<br>
        Assicurati che il server sia in esecuzione su http://localhost:3000
      </div>`;
      return;
    }

    document.getElementById('btn-new-game').addEventListener('click', () => {
      Screens.renderNewChar(this.data);
      showScreen('screen-new-char');
    });

    // btn-load-game removed from HTML — saves auto-load at init
    const btnLoad = document.getElementById('btn-load-game');
    if (btnLoad) btnLoad.addEventListener('click', async () => {
      const saves = await API.listCharacters();
      Screens.renderTitle(saves);
    });

    document.getElementById('btn-god-mode').addEventListener('click', () => {
      this.createGodChar('HEX');
    });

    document.getElementById('btn-walkthrough').addEventListener('click', () => {
      this.goWalkthrough();
    });

    document.getElementById('btn-exit').addEventListener('click', () => {
      if (confirm('Uscire dal gioco?')) window.close();
    });

    // Keyboard shortcuts on title screen
    document.addEventListener('keydown', (e) => {
      const titleVisible = document.getElementById('screen-title').classList.contains('active-screen');
      if (!titleVisible) return;
      const key = e.key.toLowerCase();
      if (key === 'n') document.getElementById('btn-new-game').click();
      else if (key === 'w') this.goWalkthrough();
      else if (key === 'e') document.getElementById('btn-exit').click();
      else if (key === 'g') this.createGodChar('HEX');
    });

    document.getElementById('btn-confirm-char').addEventListener('click', () => {
      this.createCharacter();
    });
  },

  // ── CREAZIONE PERSONAGGIO ─────────────────
  createCharacter() {
    const form = Screens.collectCharForm();
    if (!form) return;

    this.godMode = false;
    const seedNum = this._hashSeed(String(form.seed) || String(Date.now()));
    this.rng = this._makeRNG(seedNum);

    // Lookup DB from charsheet.js (global)
    const razza     = DB.razze[form.razza]     || {};
    const classeKey = form.classe;
    const scKey     = form.sottoclasse;
    const classeD   = (DB.classi[classeKey] && DB.classi[classeKey].sottoclassi[scKey]) || {};
    const bg        = DB.background[form.background] || {};
    const dio       = DB.dei[form.dio]         || {};
    const evento    = DB.eventi[form.evento]   || {};
    const condotta  = DB.condotte[form.condotta] || {};
    const etaD      = DB.eta[String(form.eta)] || {};

    // Compute final attributes from pbState + all DB bonuses
    const _cl  = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
    const _gv  = (obj, k) => (obj && obj[k]) ? Number(obj[k]) : 0;
    // Gender modifier: female = FOR-1, DES+1
    const sessoMod = (form.sesso === 'femmine') ? { FOR: -1, DES: 1, RES: 1, COS: -1, INT: 1, FRT: -1 } : {};
    const attrs = {};
    ['FOR','DES','COS','RES','INT','FRT'].forEach(k => {
      const pb   = (form.pbState && form.pbState[k]) || { base:9, prim:0, sec:0 };
      const mods = _gv(razza.attr,k) + _gv(classeD.attr,k) + _gv(bg.attr,k)
                 + _gv(dio.attr,k)   + _gv(evento.attr,k)  + _gv(condotta.attr,k)
                 + _gv(etaD.attr,k)  + (sessoMod[k] || 0);
      attrs[k] = _cl(pb.base + pb.prim + pb.sec + mods, 0, 18);
    });

    // Base resistances from DB
    const baseRes = { fuoco:0, freddo:0, acido:0, veleno:0, magia:0, fulmine:0, incanto:0 };
    ['fuoco','freddo','acido','veleno','magia','fulmine'].forEach(t => {
      baseRes[t] = Math.max(0,
        _gv(razza.res,t) + _gv(dio.res,t) + _gv(evento.res,t) + _gv(condotta.res,t)
        + Math.floor(attrs.RES / 5));
    });
    baseRes.incanto = Math.max(0,
      Math.floor(attrs.FRT / 2) + Math.floor(attrs.RES / 5)
      + _gv(condotta.res,'incanto'));

    // Skills & traits
    const _sk  = (o) => ({ ab: (o.skills && o.skills.abilita) || [], co: (o.skills && o.skills.competenze) || [] });
    const srcs = [razza, classeD, bg, dio, evento, condotta];
    const skills     = [...new Set(srcs.flatMap(s => _sk(s).ab))];
    const competenze = [...new Set(srcs.flatMap(s => _sk(s).co))];
    const traits     = [razza.tratto, dio.bonus].filter(Boolean);

    this.char = {
      nome: form.nome, sesso: form.sesso, eta: form.eta,
      razza: form.razza, classe: form.classe, sottoclasse: form.sottoclasse,
      background: form.background, dio: form.dio,
      evento: form.evento, condotta: form.condotta,
      seed: seedNum,
      attributes: attrs,
      derived: {},
      baseResistances: { ...baseRes },
      resistances: { ...baseRes },
      skills, competenze, traits,
      equipment: this._startingEquip(form.sottoclasse, form.equippedItems),
      inventory: [...form.bagItems],
      gold: form.gold || 1,
      destino: 0, destinoGemsFound: [],  // earned via rare travel events or destino_gem locations
      frammenti: [...form.frammenti],
      alleanze: [],
      currentLocation: 0, visitedLocations: [0],
      // 0=Venarium,1=Gurth always unlocked; 8=Conajohara,9=Tarantia,10=Zuarir,11=Messantia free exploration
      // 13=Tyro,14=Arya,15=Lago di OZ,16=Torre Magica,17=Ormuz,18=Deserto geographic locations
      unlockedLocations: [0, 1, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19],
      questMajorStato: { M1: 'attiva' },
      questMinorStato: {},
      activeQuest: 'M1',
      travelDestination: null, travelProgress: 0, travelDistance: 0,
      combatState: null, gameOver: false, ending: null,
      onore: { vinte: 0, fuggite: 0, rese: 0 },
      durata: 0,
      pbState: form.pbState,
      createdAt: new Date().toISOString()
    };

    this._recalcStats();
    clearLog('log-main');
    addLog('log-main', `BENVENUTO, ${this.char.nome.toUpperCase()}! LA TUA AVVENTURA INIZIA.`, '#ffd700');
    this.showLocation();
  },

  // Arma iniziale in base alla sottoclasse
  _startingEquip(sc, formEquip) {
    const eq = {
      elmo:null, armatura:null, bracciali:null, cintura:null,
      amuleto:null, anello:null, stivali:null, arma:null, scudo:null,
      ...formEquip
    };
    // Only set arma if player didn't already pick one in charsheet
    if (!eq.arma) {
      const W = {
        berserker:     { id:'sw1', nome:'Ascia da Guerra',       rar:'normal', slot:'Arma2M', attr:{}, comb:{dan:3,att:-1}, res:{}, lore:'Pesante ascia cimmera a due mani.' },
        nomade:        { id:'sw2', nome:'Lancia del Nomade',      rar:'normal', slot:'Arma',   attr:{}, comb:{att:1,ini:1},  res:{}, lore:'Lancia leggera da cavaliere.' },
        condottiero:   { id:'sw3', nome:'Spada del Condottiero',  rar:'normal', slot:'Arma',   attr:{}, comb:{att:1,def:1},  res:{}, lore:'Lama da ufficiale aquiloniano.' },
        guardia:       { id:'sw4', nome:'Spada da Guardia',       rar:'normal', slot:'Arma',   attr:{}, comb:{def:1},        res:{}, lore:'Spada standard da guardia del corpo.' },
        assassino:     { id:'sw5', nome:'Pugnale Affilato',       rar:'normal', slot:'Arma',   attr:{}, comb:{att:1,ini:2,dan:-1}, res:{}, lore:'Lama corta e silenziosa.' },
        borseggiatore: { id:'sw6', nome:'Stiletto',               rar:'normal', slot:'Arma',   attr:{}, comb:{ini:3,dan:-2}, res:{}, lore:'Ago d\'acciaio per colpi rapidi.' },
        guaritore:     { id:'sw7', nome:'Bastone Tribale',        rar:'normal', slot:'Arma',   attr:{INT:1}, comb:{rd:1},   res:{}, lore:'Bastone dello sciamano guaritore.' },
        veggente:      { id:'sw8', nome:'Bastone del Veggente',   rar:'normal', slot:'Arma',   attr:{FRT:1}, comb:{},       res:{magia:1}, lore:'Incanalatore di profezie.' }
      };
      eq.arma = W[sc] || { id:'sw0', nome:'Spada di Ferro',      rar:'normal', slot:'Arma',   attr:{}, comb:{att:1},        res:{}, lore:'Lama di ferro forgiata in Cimmeria.' };
      // Guardia gets starting shield too
      if (sc === 'guardia' && !eq.scudo) {
        eq.scudo = { id:'sh1', nome:'Scudo di Legno', rar:'normal', slot:'Scudo', attr:{}, comb:{def:1,rd:1}, res:{}, lore:'Scudo robusto di quercia.' };
      }
    }
    return eq;
  },

  // Ricalcola stats derivate da attributi + equipaggiamento
  _recalcStats() {
    const a = this.char.attributes;
    const eq = this.char.equipment;

    // Effective attributes: base + equipment attr bonuses
    const ea = { ...a };
    for (const item of Object.values(eq)) {
      if (!item || !item.attr) continue;
      for (const [k, v] of Object.entries(item.attr)) {
        ea[k] = (ea[k] || 0) + v;
      }
    }

    // Threshold mastery bonus: >=15→+1, >=18→+2, >=21→+3
    const thrBonus = v => v >= 21 ? 3 : v >= 18 ? 2 : v >= 15 ? 1 : 0;
    for (const k of ['FOR','DES','COS','RES','INT','FRT']) {
      ea[k] = (ea[k] || 9) + thrBonus(ea[k] || 9);
    }

    // ATT←FOR, DAN←INT, DEF←DES, RD←RES, INI←FRT, HP←COS
    let att = Math.floor((ea.FOR || 9) / 3);
    let dan = Math.floor((ea.INT || 9) / 3);
    let def = Math.floor((ea.DES || 9) / 4);
    let rd  = Math.floor((ea.RES || 9) / 5);
    let ini = Math.floor((ea.FRT || 9) / 2);
    let maxHp = (a.COS || 9) * 2 + 10;

    // Applica bonus comb da equipaggiamento
    for (const item of Object.values(eq)) {
      if (!item || !item.comb) continue;
      if (item.comb.att) att += item.comb.att;
      if (item.comb.dan) dan += item.comb.dan;
      if (item.comb.def) def += item.comb.def;
      if (item.comb.rd)  rd  += item.comb.rd;
      if (item.comb.ini) ini += item.comb.ini;
    }

    // Applica bonus pergamene permanenti
    const sb = this.char.scrollBonuses || {};
    if (sb.att) att += sb.att;
    if (sb.dan) dan += sb.dan;
    if (sb.def) def += sb.def;
    if (sb.rd)  rd  += sb.rd;
    if (sb.ini) ini += sb.ini;

    // Applica bonus comb da classe/sottoclasse, dei, condotta (Bug #1/#2)
    const _gvC = (obj, k) => (obj && obj[k] !== undefined) ? Number(obj[k]) || 0 : 0;
    const charSC   = (DB.classi[this.char.classe] && DB.classi[this.char.classe].sottoclassi[this.char.sottoclasse]) || {};
    const charBgC  = DB.background[this.char.background] || {};
    const charDioC = DB.dei[this.char.dio] || {};
    const charCndC = DB.condotte[this.char.condotta] || {};
    att += _gvC(charSC.comb,'att') + _gvC(charBgC.comb,'att') + _gvC(charDioC.comb,'att') + _gvC(charCndC.comb,'att');
    dan += _gvC(charSC.comb,'dan') + _gvC(charBgC.comb,'dan') + _gvC(charDioC.comb,'dan') + _gvC(charCndC.comb,'dan');
    def += _gvC(charSC.comb,'def') + _gvC(charBgC.comb,'def') + _gvC(charDioC.comb,'def') + _gvC(charCndC.comb,'def');
    rd  += _gvC(charSC.comb,'rd')  + _gvC(charBgC.comb,'rd')  + _gvC(charDioC.comb,'rd')  + _gvC(charCndC.comb,'rd');
    ini += _gvC(charSC.comb,'ini') + _gvC(charBgC.comb,'ini') + _gvC(charDioC.comb,'ini') + _gvC(charCndC.comb,'ini');
    maxHp += _gvC(charSC,'hp') + _gvC(charBgC,'hp') + _gvC(charDioC,'hp');
    // Bonus HP permanenti da quest reward (Bug #6)
    maxHp += this.char.permHpBonus || 0;

    const prevHp = this.char.derived.hp;
    const prevMax = this.char.derived.maxHp || maxHp;
    const hpRatio = prevMax > 0 ? prevHp / prevMax : 1;

    this.char.derived = {
      hp: prevHp !== undefined ? Math.round(maxHp * hpRatio) : maxHp,
      maxHp, energia: a.COS * 2, maxEnergia: a.COS * 2,
      att, dan, def, rd, ini
    };

    // Deity penalty: legendary/unique items linked to a different god → -2 ATT, -2 DAN, -1 DEF
    const charDio = this.char.dio || '';
    for (const item of Object.values(eq)) {
      if (!item || !item.dio) continue;
      const rarIsHighTier = item.rar === 'legend' || item.rar === 'unique';
      if (rarIsHighTier && item.dio !== charDio) {
        att = Math.max(0, att - 2);
        dan = Math.max(1, dan - 2);
        def = Math.max(0, def - 1);
      }
    }

    // Resistenze: base DB + bonus equipaggiamento + pozioni attive
    const res = { ...(this.char.baseResistances || { fuoco:0, freddo:0, acido:0, veleno:0, magia:0, fulmine:0, incanto:0 }) };
    const pr = this.char.potionResistances || {};
    for (const [k, v] of Object.entries(pr)) { res[k] = (res[k] || 0) + v; }
    for (const item of Object.values(eq)) {
      if (!item || !item.res) continue;
      for (const [k, v] of Object.entries(item.res)) {
        if (res.hasOwnProperty(k)) res[k] += v;
      }
    }
    this.char.resistances = res;
  },

  // ── NAVIGAZIONE ──────────────────────────
  goWalkthrough() {
    Screens.renderWalkthrough();
    showScreen('screen-walkthrough');
  },

  async goTitle() {
    if (this.char) {
      const choice = confirm(`ATTENZIONE: Tornare al menu iniziale perderà la sessione corrente.\n\nSalva prima di uscire?`);
      if (choice) {
        try {
          const sr = await API.saveCharacter(this.char);
          if (sr && sr.slot) this.char.saveSlot = sr.slot;
          addLog('log-main', `SALVATO: ${this.char.nome}`, '#7f7');
        } catch (e) { alert('Errore salvataggio: ' + e.message); return; }
      }
    }
    this.char = null; this.combatState = null; this.travelState = null;
    const saves = await API.listCharacters();
    Screens.renderTitle(saves);
    showScreen('screen-title');
  },

  _state(extra) {
    // Stamp unlocked state from char onto locations array copy
    const locations = (this.data ? this.data.locations : []).map((loc, i) => {
      const questId = loc.questMajor ? `M${loc.questMajor}` : null;
      const questDone = questId && this.char && (this.char.questMajorStato || {})[questId] === 'completata';
      const npcs = (loc.npcs || []).filter(npcId => {
        // Boss NPCs (not in npcs DB) disappear after quest completion
        const isRealNPC = this.data.npcs && this.data.npcs[npcId];
        if (!isRealNPC && questDone) return false;
        return true;
      });
      return {
        ...loc,
        unlocked: (this.char && this.char.unlockedLocations) ? this.char.unlockedLocations.includes(i) : (loc.unlocked || false),
        npcs
      };
    });
    return { character: this.char, locations, ...extra };
  },

  showMainMenu() {
    if (!this.char) return;
    Screens.renderMainMenu(this._state());
    showScreen('screen-main-menu');
  },

  showCharSheet() {
    if (!this.char) return;
    Screens.renderCharSheet(this._state());
    showScreen('screen-character');
  },

  showMap() {
    if (!this.char) return;
    try {
      Screens.renderMap(this._state());
    } catch(e) {
      console.error('renderMap error:', e);
      addLog('log-main', 'ERRORE MAPPA: ' + e.message, '#f44');
    }
    showScreen('screen-map');
  },

  showQuestLog() {
    if (!this.char) return;
    Screens.renderQuestLog(this._state());
    showScreen('screen-quest');
  },

  showLocation() {
    if (!this.char) return;
    const loc = this.data.locations[this.char.currentLocation];
    if (!loc) { this.showMainMenu(); return; }
    const arrived = !!this._arrivedAtLocation;
    this._arrivedAtLocation = false;
    // Invalidate shop stock cache when entering a new location
    if (!this._shopStockCache || this._shopStockCache.locIdx !== this.char.currentLocation) {
      this._shopStockCache = { locIdx: this.char.currentLocation, stocks: {} };
    }
    // Destino gem: trovabile 1 sola volta in tutta la partita (Bug #7)
    if (loc.destino_gem && !this.char.destinoEverFound && (this.char.destino || 0) < 1) {
      if (!this.char.destinoGemsFound) this.char.destinoGemsFound = [];
      const locIdx = this.char.currentLocation;
      if (!this.char.destinoGemsFound.includes(locIdx) && (this.rng ? this.rng() : Math.random()) < 0.35) {
        this.char.destinoGemsFound.push(locIdx);
        this.char.destino = (this.char.destino || 0) + 1;
        this.char.destinoEverFound = true;
        setTimeout(() => addLog('log-local', `💎 GEMMA DEL DESTINO trovata tra le rovine! ⭐ DESTINO: ${this.char.destino}/1 (trovabile 1 sola volta)`, '#ffd700'), 300);
        updateGlobalHUD(this.char);
      }
    }
    // First visit to Venarium (location 0) → intro narrative
    const isFirstVenarium = this.char.currentLocation === 0 && !this.char._venariumIntroDone;
    Screens.renderLocation(this._state(), { arrived });
    showScreen('screen-location');
    if (isFirstVenarium) {
      this.char._venariumIntroDone = true;
      setTimeout(() => this._showVenariumIntro(), 300);
    }
  },

  _showVenariumIntro() {
    const existing = document.getElementById('venarium-intro-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'venarium-intro-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9000;background:#000;display:flex;align-items:center;justify-content:center;cursor:pointer;';

    overlay.innerHTML = `
      <div style="max-width:600px;padding:32px;background:#050010;border:2px solid #5522aa;color:#cce;font-family:monospace;font-size:13px;line-height:1.8;text-align:left;">
        <div style="color:#aa66ff;font-size:16px;font-weight:bold;margin-bottom:16px;letter-spacing:3px;">❄ VENARIUM — FORTEZZA DI CONFINE ❄</div>
        <div style="color:#8899cc;margin-bottom:12px;">
          La notte incombe su Venarium.<br>
          Fumo di torce, vento tagliente dal nord.<br><br>
          Sei Conan di Cimmeria — giovane, forte, con le mani che sanno solo stringere una spada.<br>
          Davanti a te: l'impero di Acheron, sepolto ma non morto.<br><br>
          Uno <span style="color:#cc66ff;">Spettro antico</span> si materializza fra le rovine della fortezza.<br>
          Non parla. Aspetta.<br><br>
          Qualcosa nel gelo dell'aria ti dice che questa notte cambierà tutto.
        </div>
        <div style="color:#ffcc44;font-size:11px;margin-bottom:8px;">► L'Urlo di Ymir si frantuma in dodici frammenti.<br>
        ► Trova i frammenti. Sconfiggi Re Valthor.<br>
        ► La Cimmeria dipende da te.</div>
        <div style="color:#445566;font-size:10px;margin-top:16px;">[CLICCA O PREMI UN TASTO PER CONTINUARE]</div>
      </div>`;

    const close = () => { overlay.remove(); };
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', close, { once: true });

    document.body.appendChild(overlay);
  },

  async loadGame(slot) {
    try {
      this.godMode = false;
      this.char = await API.loadCharacter(slot);
      this.rng = this._makeRNG(this.char.seed || 12345);
      // Migrate old saves
      if (!this.char.unlockedLocations) this.char.unlockedLocations = [0, 1, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18];
      // Ensure free-exploration + geographic locations unlocked (migrate existing saves)
      [8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19].forEach(idx => {
        if (!this.char.unlockedLocations.includes(idx)) this.char.unlockedLocations.push(idx);
      });
      if (!this.char.visitedLocations) this.char.visitedLocations = [0];
      if (!this.char.destinoGemsFound) this.char.destinoGemsFound = [];
      if (!this.char.equipment) this.char.equipment = {};
      if (!this.char.inventory) this.char.inventory = [];
      if (!this.char.frammenti) this.char.frammenti = [];
      if (!this.char.alleanze) this.char.alleanze = [];
      // Strip removed skills from existing saves
      const _REMOVED_SKILLS = ['odio','testardaggine'];
      if (this.char.skills) this.char.skills = this.char.skills.filter(s => !_REMOVED_SKILLS.includes(s.toLowerCase()));
      if (this.char.traits) this.char.traits = this.char.traits.filter(s => !_REMOVED_SKILLS.includes(s.toLowerCase()));
      if (!this.char.questMajorStato) this.char.questMajorStato = { M1: 'attiva' };
      if (!this.char.onore) this.char.onore = { vinte: 0, fuggite: 0, rese: 0 };
      if (this.char.durata === undefined) this.char.durata = 0;
      this._recalcStats();
      clearLog('log-main');
      addLog('log-main', `BENVENUTO DI RITORNO, ${this.char.nome.toUpperCase()}!`, '#ffd700');
      this.showMainMenu();
    } catch (e) { alert('Errore caricamento: ' + e.message); }
  },

  async saveGame() {
    if (!this.char) return;
    try {
      const result = await API.saveCharacter(this.char);
      if (result && result.slot) this.char.saveSlot = result.slot;
      addLog('log-main', `SALVATO: ${this.char.nome}`, '#7f7');
    } catch (e) { addLog('log-main', 'ERRORE SALVATAGGIO: ' + e.message, '#f77'); }
  },

  // ── VIAGGIO ──────────────────────────────
  travelMenu() { this.showMap(); },

  travelToQuest(locIdx) {
    // Pre-select destination and start travel
    const sel = document.getElementById('sel-dest');
    if (sel) sel.value = locIdx;
    drawRoute(this.char.currentLocation, locIdx, this.data.locations);
    this.startTravel();
  },

  travelDirectTo(locIdx) {
    if (!this.char || !this.data) return;
    const from = this.data.locations[this.char.currentLocation];
    const to   = this.data.locations[locIdx];
    if (!to || !from) return;
    if (locIdx === this.char.currentLocation) { addLog('log-local', `Sei già a ${to.n}!`, '#888'); return; }
    // Check locked
    if (this.char.unlockedLocations && !this.char.unlockedLocations.includes(locIdx)) {
      addLog('log-local', `⚠ ${to.n} non è ancora sbloccata. Completa queste missioni per sbloccarla.`, '#f77');
      return;
    }
    const sel = document.getElementById('sel-dest');
    if (sel) sel.value = locIdx;
    this.startTravel();
  },

  selectDestination(idx, loc) {
    const sel = document.getElementById('sel-dest');
    if (sel) sel.value = idx;
    if (this.char) drawRoute(this.char.currentLocation, idx, this.data.locations);
  },

  startTravel() {
    const sel = document.getElementById('sel-dest');
    const destIdx = sel ? parseInt(sel.value) : NaN;
    if (isNaN(destIdx) || destIdx < 0) {
      addLog('log-map', 'SELEZIONA UNA DESTINAZIONE!', '#f77'); return;
    }
    const from = this.data.locations[this.char.currentLocation];
    const to   = this.data.locations[destIdx];
    if (!to) return;

    const dist = Math.round(Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2)));
    const steps = Math.max(3, Math.ceil(dist / 6));

    // Pre-schedule guaranteed encounters based on trip length
    const encCount = steps <= 4 ? 1 : steps <= 8 ? 2 : (this.rng() < 0.5 ? 2 : 3);
    const encounterSteps = [];
    for (let i = 0; i < encCount; i++) {
      const p = Math.max(1, Math.min(steps - 1, Math.round((steps * (i + 1)) / (encCount + 1))));
      if (!encounterSteps.includes(p)) encounterSteps.push(p);
    }

    this.char.travelDestination = destIdx;
    this.char.travelProgress = 0;
    this.char.travelDistance = steps;
    this.travelState = { active: true, destIdx, steps, progress: 0, status: 'travelling', encounterSteps };

    Screens.renderTravel(this._state(), this.travelState);
    showScreen('screen-travel');

    const btn = document.getElementById('travel-btn-continue');
    if (btn) btn.onclick = () => this._travelStep();
  },

  _travelStep() {
    if (!this.travelState || !this.travelState.active) return;

    this.char.travelProgress++;
    this.travelState.progress++;
    this.char.durata = (this.char.durata || 0) + 1;
    this.travelState.lastAction = 'travel';

    // Poison tick per travel step (1 step = 1 day)
    if (!this._poisonTick('log-travel')) return; // dead from poison

    const arrived = this.travelState.progress >= this.travelState.steps;
    const isEncounterStep = (this.travelState.encounterSteps || []).includes(this.travelState.progress);
    const roll = this.rng ? this.rng() : Math.random();

    let event = 'nothing';
    let eventMsg = '';

    if (arrived) {
      event = 'arrived';
      this.char.currentLocation = this.travelState.destIdx;
      if (!this.char.visitedLocations.includes(this.travelState.destIdx)) {
        this.char.visitedLocations.push(this.travelState.destIdx);
      }
      this.travelState.active = false;
      const loc = this.data.locations[this.char.currentLocation];
      eventMsg = `► ARRIVATO A ${(loc.n || '').toUpperCase()}!`;
      addLog('log-travel', eventMsg, '#ffd700');

      this._arrivedAtLocation = true;
      setTimeout(() => this.showLocation(), 800);
    } else if (isEncounterStep) {
      event = 'encounter';
      eventMsg = '⚔ INCONTRO NEMICO!';
      addLog('log-travel', eventMsg, '#cc3333');
      this._startRandomCombat();
      return;
    } else {
      event = 'nothing';
      // Rare (~5%): find Destino token
      if (this.rng() < 0.05 && !this.char.destinoEverFound && (this.char.destino || 0) < 1) {
        event = 'destino_find';
        this.char.destino = (this.char.destino || 0) + 1;
        this.char.destinoEverFound = true;
        eventMsg = '⭐ EVENTO RARO! Un antico talismano brilla tra le pietre. Il Destino ti sorride. (unico nella partita)';
        addLog('log-travel', eventMsg, '#ffd700');
        updateGlobalHUD(this.char);
      } else {
        const msgs = [
          'Il vento ulula tra le rocce. Nessun segno di pericolo.',
          'Tracce di lupo nella neve fresca. Procedi cauto.',
          'In lontananza, fumo. Qualcuno ha acceso un fuoco.',
          'Il cielo si scurisce. Una tempesta si avvicina da nord.',
          'Attraversi un guado ghiacciato. I piedi gelano.',
          'Un corvo ti segue da ore. Crom ti guarda.',
          'Rovine di un vecchio avamposto. Saccheggiato da anni.'
        ];
        eventMsg = msgs[Math.floor(this.rng() * msgs.length)];
        addLog('log-travel', eventMsg);
      }
    }

    this.travelState.status = event;
    this.travelState.message = eventMsg;
    Screens.renderTravel(this._state(), this.travelState);
  },

  campRest() {
    if (!this.travelState || !this.travelState.active) {
      addLog('log-travel', '⛺ Puoi accamparti solo durante il viaggio.', '#f77');
      return;
    }
    // Require at least 1 travel step before first rest, and alternate rest/travel
    if (!this.travelState.lastAction) {
      addLog('log-travel', '⛺ Cammina almeno un passo prima di accamparti.', '#f77');
      return;
    }
    if (this.travelState.lastAction === 'rest') {
      addLog('log-travel', '⛺ Hai già riposato. Avanza ancora prima di accamparti di nuovo.', '#f77');
      return;
    }
    const cos = (this.char.attributes && this.char.attributes.COS) || 9;
    this.char.durata = (this.char.durata || 0) + 0.5;
    // Heal FIRST
    const healAmt = Math.floor(cos / 3) + Math.floor((this.rng ? this.rng() : Math.random()) * 8) + 3;
    const prev = this.char.derived.hp;
    this.char.derived.hp = Math.min(this.char.derived.maxHp, prev + healAmt);
    const actual = this.char.derived.hp - prev;
    this.travelState.lastAction = 'rest';
    const eventMsg = `⛺ ACCAMPATO (½ giorno) — +${actual} HP. HP: ${this.char.derived.hp}/${this.char.derived.maxHp}`;
    addLog('log-travel', eventMsg, '#7f7');
    this.travelState.status = 'rest';
    this.travelState.message = eventMsg;
    // Poison tick AFTER healing
    if (!this._poisonTick('log-travel')) {
      Screens.renderTravel(this._state(), this.travelState);
      return;
    }
    updateGlobalHUD(this.char);
    Screens.renderTravel(this._state(), this.travelState);
  },

  // ── COMBATTIMENTO ────────────────────────

  // Damage helpers — extract physical+elemental calc for player and enemy attacks
  _calcPlayerDmg(p, e, furiaMult) {
    const baseDan = p.dan * furiaMult;
    const rawPhys = Math.floor(baseDan * 0.6) + Math.floor(this.rng() * Math.ceil(baseDan * 0.4 + 1)) + 1;
    const rdRed = Math.min(rawPhys, e.rd);
    const netPhys = rawPhys - rdRed;
    const equippedArma = this.char.equipment && this.char.equipment.arma;
    const weaponElem = equippedArma && equippedArma.elemDan;
    // lowercase→uppercase res key mapping
    const ELEM_RES = { fuoco:'FUO', freddo:'FRE', veleno:'VEL', acido:'ACI', magia:'MAG', fulmine:'FUL', incanto:'INC' };
    let netElem = 0;
    const elemParts = [];
    if (weaponElem) {
      for (const [eKey, val] of Object.entries(weaponElem)) {
        if (!val) continue;
        const rawE = Math.round(val * furiaMult);
        const resKey = ELEM_RES[eKey];
        const resVal = resKey ? ((e.baseRes || {})[resKey] || 0) : 0;
        const red = Math.round(rawE * resVal / 100);
        const net = Math.max(0, rawE - red);
        netElem += net;
        elemParts.push(red > 0 ? `${eKey}(${rawE}-${red}=${net})` : `${eKey}(${rawE}=${net})`);
      }
    }
    const total = netPhys + netElem;
    let logStr = `Fis(${rawPhys}-${rdRed}=${netPhys})`;
    if (elemParts.length) logStr += ` + ${elemParts.join('+')}`;
    logStr += ` = ${total}`;
    return { total, logStr };
  },

  _calcEnemyDmg(e, p, rdBonus) {
    const rawPhys = Math.floor(e.dan * 0.6) + Math.floor(this.rng() * Math.ceil(e.dan * 0.4 + 1)) + 1;
    const rdTotal = p.rd + rdBonus;
    const rdRed = Math.min(rawPhys, rdTotal);
    const netPhys = rawPhys - rdRed;
    // uppercase fixedElem → lowercase player resistance key
    const ELEM_RES = { FRE:'freddo', FUO:'fuoco', ACI:'acido', VEL:'veleno', MAG:'magia', FUL:'fulmine', INC:'incanto' };
    let netElem = 0;
    let elemStr = '';
    if (e.elemAttack && this.rng() < 0.5) {
      const { type, val } = e.elemAttack;
      const resKey = ELEM_RES[type];
      const playerRes = resKey ? ((this.char.resistances || {})[resKey] || 0) : 0;
      const red = Math.min(val, playerRes); // flat point reduction (not %)
      netElem = Math.max(0, val - red);
      elemStr = red > 0 ? ` + ${type}(${val}-${red}=${netElem})` : ` + ${type}(${val}=${netElem})`;
    }
    const total = netPhys + netElem;
    const logStr = `Fis(${rawPhys}-${rdRed}=${netPhys})${elemStr} = ${total}`;
    return { total, logStr };
  },

  _startRandomCombat(locBiome) {
    const biome = locBiome || (this.data.locations[this.char.currentLocation] || {}).biome || 'any';
    const enemyList = Array.isArray(this.data.enemies) ? this.data.enemies : (this.data.enemies.enemies || []);
    // Exclude questOnly enemies only — travel tier is always Normale (no Elite/Boss)
    const allRandom = enemyList.filter(e => !e.questOnly);
    let pool = biome === 'any'
      ? allRandom
      : allRandom.filter(e => (e.biome||[]).includes(biome) || (e.biome||[]).includes('any'));
    if (pool.length < 2) pool = allRandom;
    if (!pool.length) { this._travelStep(); return; }

    const base = pool[Math.floor(this.rng() * pool.length)];
    const tier = 'Normale'; // travel = no Elite/Boss; those belong in quests

    const enemy = JSON.parse(JSON.stringify(base));
    const enemyWeapon = this._pickEnemyWeapon(base.t, tier);
    const wc = enemyWeapon ? (enemyWeapon.comb || {}) : {};

    const eATT = Math.max(1, Math.floor(enemy.attr.DES / 5) + (enemy.armor?.def || 0) + (wc.att || 0));
    const eDAn = Math.max(1, Math.floor(enemy.attr.FOR / 3) + (wc.dan || 0));
    const eDEF = Math.max(0, Math.floor(enemy.attr.DES / 5) + (enemy.armor?.def || 0) + (wc.def || 0));
    const eRD  = Math.max(0, Math.floor(enemy.attr.RES / 5) + (enemy.armor?.rd || 0));
    const eHP  = Math.max(5, Math.floor(enemy.attr.COS * 1.4));

    // Derive elemental attack: fixedElem ability + weapon elem combined
    const elemVal = base.fixedElem ? Math.max(1, Math.floor(enemy.attr.INT / 3) + 1) : 0;
    let elemAttack = (base.fixedElem && elemVal > 0) ? { type: base.fixedElem, val: elemVal } : null;
    // Weapon elemental bonus (enemies.json weapons use elem:{type,val})
    const wElem = enemyWeapon && enemyWeapon.elem;
    if (wElem && wElem.type && wElem.val) {
      if (elemAttack && elemAttack.type === wElem.type) {
        elemAttack = { type: wElem.type, val: elemAttack.val + wElem.val };
      } else if (!elemAttack) {
        elemAttack = { type: wElem.type, val: wElem.val };
      }
      // different elem types: keep fixedElem as primary, note weapon elem separately
    }

    const initPlayer = (this.char.derived.ini || 0) >= Math.floor(enemy.attr.DES / 2);
    this.combatState = {
      active: true, turn: 1,
      initiativePlayer: initPlayer,
      enemy: { id: base.n, nome: base.n, tier, tipo: base.t, hp: eHP, maxHp: eHP, att: eATT, dan: eDAn, def: eDEF, rd: eRD, skills: base.skills || [], lore: base.lore || '', baseRes: base.baseRes || {}, elemAttack },
      player: { hp: this.char.derived.hp, maxHp: this.char.derived.maxHp,
        att: this.char.derived.att + ((this.char.sessionBuffs||{}).att||0),
        dan: this.char.derived.dan + ((this.char.sessionBuffs||{}).dan||0),
        def: this.char.derived.def + ((this.char.sessionBuffs||{}).def||0),
        rd:  this.char.derived.rd,
        ini: this.char.derived.ini + ((this.char.sessionBuffs||{}).ini||0),
        defending: !initPlayer }, // loser of initiative defends first turn
      log: [], result: null, loot: [], rawLoot: base.loot || [], enemyWeapon
    };

    this.combatState.log.push(`⚔ INCONTRO: ${base.n} [${tier}]`);
    if (enemyWeapon) {
      const wInfo = (wElem && wElem.type) ? ` [+${wElem.val} ${wElem.type}]` : '';
      this.combatState.log.push(`🗡 Porta: ${enemyWeapon.nome}${wInfo}`);
    }
    if (elemAttack) this.combatState.log.push(`⚡ Elem: ${elemAttack.type} val=${elemAttack.val}`);
    this.combatState.log.push(initPlayer ? '► HAI L\'INIZIATIVA!' : '► IL NEMICO ATTACCA PER PRIMO! Ti prepari a difendere. (DEF+3)');

    const _rb = document.getElementById('comb-result-box');
    if (_rb) { _rb.style.display = 'none'; _rb.innerHTML = ''; }
    const _ab = document.getElementById('comb-action-btns');
    if (_ab) _ab.style.display = '';

    Screens.renderCombat({ combatState: this.combatState, character: this.char });
    showScreen('screen-combat');

    if (!initPlayer) setTimeout(() => this._enemyTurn(), 600);
  },

  startRandomCombat() {
    if (!this.char) return;
    this._startRandomCombat();
  },

  toggleGodMode() {
    this.godMode = !this.godMode;
    const msg = this.godMode ? '🛡 GOD MODE ATTIVO — immune ai danni!' : '⚔ GOD MODE disattivato.';
    addLog('log-main', msg, this.godMode ? '#ffd700' : '#aaa');
    console.log(msg);
    return this.godMode;
  },

  async resetCurrentSave() {
    if (!this.char) { console.warn('Nessun personaggio caricato.'); return; }
    const nome = this.char.nome;
    try {
      await API.deleteCharacter(nome);
      console.log(`✓ Salvataggio "${nome}" eliminato.`);
    } catch (e) {
      console.warn('Errore eliminazione:', e.message);
    }
    this.char = null;
    this.combatState = null;
    this.godMode = false;
    location.reload();
  },

  async createGodChar(nome = 'CONAN_GOD') {
    // Delete existing save if any
    try { await API.deleteCharacter(nome); } catch(e) {}
    const seedNum = this._hashSeed(nome);
    this.rng = this._makeRNG(seedNum);
    const maxAttr = { FOR:18, DES:18, COS:18, RES:18, INT:18, FRT:18 };
    const baseRes = { fuoco:20, freddo:20, acido:20, veleno:20, magia:20, fulmine:20, incanto:20 };
    this.char = {
      nome, sesso:'M', eta:'adulto',
      razza:'cimmero', classe:'guerriero', sottoclasse:'berserker',
      background:'mercenario', dio:'crom', evento:'battaglia', condotta:'onore',
      seed: seedNum,
      attributes: { ...maxAttr },
      derived: {},
      baseResistances: { ...baseRes },
      resistances: { ...baseRes },
      skills: ['Furia', 'Forza Bruta', 'Resistenza', 'Riflessi'],
      competenze: ['Armi', 'Armature'],
      traits: [],
      equipment: {
        // Unique weapon equipped — 1H so scudo can be shown too
        arma:     { instanceId:'geq_arma',    id:'w_unique1',    nome:'Lama di Conan',             rar:'unique',  slot:'Arma',      tipo:'arma',     attr:{FOR:2,DES:1},          comb:{att:5,dan:14,def:2},  res:{magia:4},                        lore:'Taglia il destino stesso.' },
        armatura: { instanceId:'geq_arm',     id:'arm_unique1',  nome:'Pelle di Dragone Nero',     rar:'unique',  slot:'Torso',     tipo:'armatura', attr:{COS:2,RES:2},          comb:{rd:10,ini:0},         res:{fuoco:8,magia:5},                lore:'Immunita\' al fuoco.' },
        elmo:     { instanceId:'geq_elmo',    id:'e_unique1',    nome:'Elmo della Tempesta Nera',  rar:'unique',  slot:'Testa',     tipo:'elmo',     attr:{FOR:1,INT:1,DES:1},    comb:{att:1,def:1},         res:{fulmine:10,magia:4},             lore:'Rifiuta ogni maledizione. [YMIR]' },
        amuleto:  { instanceId:'geq_amul',    id:'a_unique1',    nome:'Occhio di Ibis',            rar:'unique',  slot:'Collo',     tipo:'amuleto',  attr:{INT:2,FRT:2},          comb:{ini:3},               res:{magia:8,incanto:6},              lore:'Rivela l\'invisibile. [MITRA]' },
        anello:   { instanceId:'geq_anello',  id:'an_unique1',   nome:'Anello del Re Immortale',   rar:'unique',  slot:'AnelloDX',  tipo:'anello',   attr:{FRT:3,INT:1},          comb:{def:2},               res:{magia:6,incanto:8},              lore:'Protegge dalla morte certa.' },
        bracciali:{ instanceId:'geq_bracc',   id:'b_unique1',    nome:'Catene Spezzate',           rar:'unique',  slot:'Bracciali', tipo:'bracciali',attr:{FOR:2,RES:2},          comb:{dan:3,def:-1},        res:{acido:4},                        lore:'Il metallo porta ira e resistenza.' },
        cintura:  { instanceId:'geq_cint',    id:'c_unique1',    nome:'Cintura delle Sabbie',      rar:'unique',  slot:'Cintura',   tipo:'cintura',  attr:{DES:2,RES:1},          comb:{ini:2},               res:{fuoco:5,acido:3},                lore:'Rende leggeri come il vento.' },
        stivali:  { instanceId:'geq_stiv',    id:'s_unique1',    nome:'Sandali di Set',            rar:'unique',  slot:'Stivali',   tipo:'stivali',  attr:{DES:2,INT:1},          comb:{ini:3,att:1},         res:{veleno:6},                       lore:'Grazia e velocita\' di serpente.' },
        scudo:    { instanceId:'geq_scudo',   id:'sc_unique1',   nome:'Vortice di Kull',           rar:'unique',  slot:'Scudo',     tipo:'scudo',    attr:{FRT:2,RES:1},          comb:{def:5,att:1},         res:{magia:6,incanto:4},              lore:'Devia ogni attacco.' }
      },
      inventory: [
        // Legendary weapons — 1H
        { instanceId:'gi_w5',   id:'w5',        nome:'Lama del Fato di Crom',       rar:'legend', slot:'Arma',      tipo:'arma',     attr:{FOR:1},        comb:{att:3,dan:12,def:-1}, res:{},            elemDan:{},         lore:'Spada di ferro nero. [CROM]' },
        { instanceId:'gi_w6',   id:'w6',        nome:'Spada della Fenice',          rar:'legend', slot:'Arma',      tipo:'arma',     attr:{FRT:1},        comb:{att:4,dan:10,def:2},  res:{},            elemDan:{fuoco:3},  lore:'Forgiata nel fuoco. Danno Fuoco +3.' },
        { instanceId:'gi_wu2',  id:'w_unique2', nome:'Falce di Nergal',             rar:'unique', slot:'Arma',      tipo:'arma',     attr:{INT:2,FRT:-1}, comb:{att:4,dan:11,def:-1}, res:{},            elemDan:{incanto:4},lore:'Colpisce l\'anima. Danno Incanto +4.' },
        // Legendary weapons — 2H
        { instanceId:'gi_a2m6', id:'a2m6',      nome:'Maglio di Ymir',              rar:'legend', slot:'Arma2M',    tipo:'arma2m',   attr:{FOR:2,COS:1},  comb:{att:0,dan:15,def:-2}, res:{},            elemDan:{freddo:4}, lore:'Ogni colpo porta tempesta. [YMIR]' },
        { instanceId:'gi_a2mu', id:'a2m_unique1',nome:'Alabarda del Drago Rosso',   rar:'unique', slot:'Arma2M',    tipo:'arma2m',   attr:{FOR:2,DES:1},  comb:{att:2,dan:13,def:1},  res:{},            elemDan:{fuoco:5},  lore:'Brucia all\'impatto. Danno Fuoco +5.' },
        { instanceId:'gi_mdes', id:'urlo_a3',   nome:'Martello del Destino',        rar:'unique', slot:'Arma2M',    tipo:'arma2m',   attr:{FOR:5,COS:2},  comb:{att:0,dan:10,def:-3}, res:{freddo:5},    elemDan:{freddo:5}, lore:'Forgiato nella Forgia Perduta. Ferisce Valthor.' },
        // Bow
        { instanceId:'gi_arcu', id:'arc_unique1',nome:'Arco della Stella Cadente', rar:'unique', slot:'Arco',      tipo:'arco',     attr:{DES:3},        comb:{att:4,dan:8,ini:2},   res:{},            elemDan:{magia:3},  lore:'Frecce come luce. Danno Magia +3.' },
        // Quest items
        { instanceId:'gi_ua1',  id:'urlo_a1',   nome:'Ascia dei Troll Reali',       rar:'legend', slot:'Arma2M',    tipo:'arma2m',   attr:{FOR:2},        comb:{att:-2,dan:8,def:-1}, res:{},            elemDan:{freddo:3}, lore:'Forgiata dai Troll Reali.' },
        { instanceId:'gi_ua4',  id:'urlo_a4',   nome:'Daga dell\'Ombra',            rar:'rare',   slot:'Arma',      tipo:'arma',     attr:{DES:2},        comb:{att:3,dan:3,def:1,ini:2},res:{},         elemDan:{veleno:4}, lore:'Sottratta al Mercante di Shadizar.' },
        { instanceId:'gi_ua5',  id:'urlo_a5',   nome:'Cuore di Vulcano',            rar:'legend', slot:'Arma',      tipo:'arma',     attr:{FOR:2,FRT:1},  comb:{att:2,dan:7,def:0},   res:{fuoco:4},     elemDan:{fuoco:5},  lore:'Brucia ciò che tocca.' },
        // Armor alternates
        { instanceId:'gi_arm7', id:'arm7',      nome:'Corazza d\'Ossa di Drago',    rar:'legend', slot:'Torso',     tipo:'armatura', attr:{COS:1},        comb:{rd:8,ini:-1},         res:{fuoco:4,freddo:2},             lore:'Resistenza soprannaturale.' },
        { instanceId:'gi_ut2',  id:'urlo_t2',   nome:'Piastre di Ghiaccio Eterno',  rar:'legend', slot:'Torso',     tipo:'armatura', attr:{COS:2,RES:2},  comb:{rd:8,ini:-5},         res:{freddo:10,magia:3},            lore:'Forgiata nel ghiaccio della Montagna.' },
        // Helm alternate
        { instanceId:'gi_e5',   id:'e5',        nome:'Corona di Xaltotun',          rar:'legend', slot:'Testa',     tipo:'elmo',     attr:{INT:2,FRT:1},  comb:{rd:1},                res:{magia:6},                     lore:'Nessun incanto può penetrare. [SET]' },
        // Neck alternate
        { instanceId:'gi_a4',   id:'a4',        nome:'Cuore di Ahriman',            rar:'legend', slot:'Collo',     tipo:'amuleto',  attr:{FRT:3},        comb:{},                    res:{magia:10},                    lore:'Assorbe ogni attacco magico. [MITRA]' },
        // Ring alternate
        { instanceId:'gi_an4',  id:'an4',       nome:'Anello Nero di Thoth-Amon',   rar:'legend', slot:'AnelloDX',  tipo:'anello',   attr:{INT:2},        comb:{dan:1},               res:{magia:8},                     lore:'Chi lo indossa comanda i serpenti. [SET]' },
        // Bracciali alternate
        { instanceId:'gi_b4',   id:'b4',        nome:'Morsa di Crom',               rar:'legend', slot:'Bracciali', tipo:'bracciali',attr:{FOR:2},        comb:{dan:2},               res:{},                            lore:'Chi li indossa non lascia la presa. [CROM]' },
        // Shield alternate
        { instanceId:'gi_sc4',  id:'sc4',       nome:'Scudo del Leone Aquiloniano', rar:'legend', slot:'Scudo',     tipo:'scudo',    attr:{INT:1,FRT:1},  comb:{def:4,att:-1},        res:{fuoco:2,magia:2},             lore:'Chi lo porta sente la responsabilità del trono.' },
        // All 12 Frammenti
        { instanceId:'gi_fr1',  id:'fr1',  nome:'Frammento 1 — L\'Urlo del Sangue', rar:'unique', slot:'Frammento', tipo:'frammento', attr:{FRT:3},                comb:{},            res:{freddo:5},  lore:'Una scheggia di ghiaccio vivo che urla.' },
        { instanceId:'gi_fr2',  id:'fr2',  nome:'Frammento 2 — Il Canto dei Clan',  rar:'unique', slot:'Frammento', tipo:'frammento', attr:{RES:3},                comb:{ini:2},       res:{},          lore:'Risuona con le voci dei clan di Gurth.' },
        { instanceId:'gi_fr3',  id:'fr3',  nome:'Frammento 3 — La Sposa Serpente',  rar:'unique', slot:'Frammento', tipo:'frammento', attr:{COS:4},                comb:{},            res:{acido:4},   lore:'Odora di palude e veleno dolce.' },
        { instanceId:'gi_fr4',  id:'fr4',  nome:'Frammento 4 — Il Cuore di Fuoco',  rar:'unique', slot:'Frammento', tipo:'frammento', attr:{FOR:3},                comb:{},            res:{fuoco:6},   lore:'Ancora caldo della lava.' },
        { instanceId:'gi_fr5',  id:'fr5',  nome:'Frammento 5 — Il Ghiaccio Rotto',  rar:'unique', slot:'Frammento', tipo:'frammento', attr:{FOR:1,DES:1,COS:1,RES:1,INT:1,FRT:1}, comb:{}, res:{freddo:3}, lore:'L\'anello di Elara, trasformato.' },
        { instanceId:'gi_fr6',  id:'fr6',  nome:'Frammento 6 — La Zanna del Troll', rar:'unique', slot:'Frammento', tipo:'frammento', attr:{FOR:4,COS:2},          comb:{},            res:{freddo:5},  lore:'Strappato al Re dei Troll.' },
        { instanceId:'gi_fr7',  id:'fr7',  nome:'Frammento 7 — L\'Ombra Rubata',    rar:'unique', slot:'Frammento', tipo:'frammento', attr:{DES:3,INT:1},          comb:{},            res:{veleno:4,magia:2}, lore:'Nascosto nel palazzo di Shadizar.' },
        { instanceId:'gi_fr8',  id:'fr8',  nome:'Frammento 8 — La Danza dei Morti', rar:'unique', slot:'Frammento', tipo:'frammento', attr:{FRT:4},                comb:{ini:3},       res:{magia:5},   lore:'Polvere Spettrale cristallizzata.' },
        { instanceId:'gi_fr9',  id:'fr9',  nome:'Frammento 9 — Il Tradimento',      rar:'unique', slot:'Frammento', tipo:'frammento', attr:{INT:3,FRT:2},          comb:{},            res:{magia:6},   lore:'Portava il Mistico Corrotto.' },
        { instanceId:'gi_fr10', id:'fr10', nome:'Frammento 10 — La Scalata',        rar:'unique', slot:'Frammento', tipo:'frammento', attr:{FOR:2,RES:2},          comb:{rd:2},        res:{freddo:8},  lore:'Trovato a metà Montagna Luminosa.' },
        { instanceId:'gi_fr11', id:'fr11', nome:'Frammento 11 — L\'Addio',          rar:'unique', slot:'Frammento', tipo:'frammento', attr:{COS:3,FRT:2},          comb:{},            res:{freddo:8,magia:4}, lore:'L\'ultimo prima della cima.' },
        { instanceId:'gi_fr12', id:'fr12', nome:'Frammento 12 — L\'Urlo Finale',    rar:'unique', slot:'Frammento', tipo:'frammento', attr:{FOR:6,DES:6,COS:6,RES:6,INT:6,FRT:6}, comb:{rd:10}, res:{freddo:20,magia:10}, lore:'La Corona di Ymir spezzata.' },
        // Potions
        { instanceId:'gi_p8',  id:'pot8', nome:'Elisir del Berserker',   rar:'rare',    tipo:'consumabile', effetto:{hp:50} },
        { instanceId:'gi_p8b', id:'pot8', nome:'Elisir del Berserker',   rar:'rare',    tipo:'consumabile', effetto:{hp:50} },
        { instanceId:'gi_p7',  id:'pot7', nome:'Filtro Antimagico',      rar:'rare',    tipo:'consumabile', effetto:{res:{magia:7},temp:true} },
      ],
      gold: 9999,
      destino: 10, destinoGemsFound: [],
      frammenti: [],
      alleanze: [],
      currentLocation: 0, visitedLocations: [0],
      unlockedLocations: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19],
      questMajorStato: { M1: 'attiva' },
      questMinorStato: {},
      activeQuest: 'M1',
      travelDestination: null, travelProgress: 0, travelDistance: 0,
      combatState: null, gameOver: false, ending: null,
      onore: { vinte: 0, fuggite: 0, rese: 0 },
      durata: 0,
      pbState: null,
      createdAt: new Date().toISOString()
    };
    this._recalcStats();
    this.godMode = true;
    try { await API.saveCharacter(this.char); } catch(e) { console.warn('Save failed:', e.message); }
    clearLog('log-main');
    addLog('log-main', `🛡 GOD MODE — ${nome} — TUTTI I POTERI SBLOCCATI!`, '#ffd700');
    this.showLocation();
    console.log('GOD CHAR creato. Game.toggleGodMode() per disattivare.');
  },

  combatAction(action) {
    if (!this.combatState || !this.combatState.active) return;

    const cs = this.combatState;
    const p = cs.player;
    const e = cs.enemy;

    if (action === 'attack') {
      const hitRoll = Math.floor(this.rng() * 20) + 1;
      const hit = hitRoll + p.att > e.def + 8;
      if (hit) {
        const furiaMult = (cs.playerNextTurn && cs.playerNextTurn.furiaDan) ? 2 : 1;
        if (furiaMult > 1) { cs.log.push(`🔥 FURIA SCATENATA!`); cs.playerNextTurn.furiaDan = false; }
        const { total, logStr } = this._calcPlayerDmg(p, e, furiaMult);
        const finalDmg = Math.max(1, total);
        e.hp -= finalDmg;
        const displayDmg = total < 1 ? logStr.replace(`= ${total}`, `= ${total}→1`) : logStr;
        cs.log.push(`✓ COLPITO! ${displayDmg}. ${e.nome} HP: ${Math.max(0, e.hp)}/${e.maxHp}`);
      } else {
        if (cs.playerNextTurn && cs.playerNextTurn.furiaDan) cs.playerNextTurn.furiaDan = false;
        cs.log.push(`✗ MANCATO! (dado: ${hitRoll})`);
      }
      p.defending = false;

    } else if (action === 'defend') {
      p.defending = true;
      cs.log.push(`🛡 POSIZIONE DIFENSIVA. DEF +3 questo turno.`);

    } else if (action.startsWith('skill:')) {
      const skillIdx = parseInt(action.split(':')[1]);
      const skill = this.char.skills ? this.char.skills[skillIdx] : null;
      if (cs.skillUsedThisTurn) {
        cs.log.push(`⚠ Abilità già usata questo turno!`);
      } else if (skill) {
        const sl = skill.toLowerCase();
        cs.playerNextTurn = cs.playerNextTurn || {};
        cs.enemyNextTurn = cs.enemyNextTurn || {};
        if (sl.includes('furia')) {
          cs.playerNextTurn.furiaDan = true;
          cs.skillUsedThisTurn = true;
          cs.log.push(`✨ FURIA — Prossimo attacco devastante (DAN×2)!`);
        } else if (sl.includes('intimidire')) {
          cs.enemyNextTurn.attPenalty = (cs.enemyNextTurn.attPenalty || 0) + 2;
          cs.enemyNextTurn.defPenalty = (cs.enemyNextTurn.defPenalty || 0) + 2;
          cs.skillUsedThisTurn = true;
          cs.log.push(`✨ INTIMIDIRE — Nemico spaventato! ATT-2 DEF-2 al suo turno.`);
        } else if (sl.includes('sopravvivenza')) {
          cs.playerNextTurn.defBonus = (cs.playerNextTurn.defBonus || 0) + 4;
          cs.skillUsedThisTurn = true;
          cs.log.push(`✨ SOPRAVVIVENZA — Guardia alta! DEF+4 turno prossimo.`);
        } else if (sl.includes('sopportazione')) {
          cs.playerNextTurn.rdBonus = (cs.playerNextTurn.rdBonus || 0) + 5;
          cs.skillUsedThisTurn = true;
          cs.log.push(`✨ SOPPORTAZIONE — Posizione difensiva! RD+5 turno prossimo.`);
        } else {
          // Generic combat skill fallback
          const dmg = Math.max(2, Math.floor(this.rng() * (p.dan + 3)) + 3 - e.rd);
          e.hp -= dmg;
          cs.skillUsedThisTurn = true;
          cs.log.push(`✨ ABILITÀ: ${skill}! Danno speciale: ${dmg}. ${e.nome} HP: ${Math.max(0,e.hp)}/${e.maxHp}`);
        }
      }
      document.getElementById('comb-skill-menu').style.display = 'none';

    } else if (action === 'flee') {
      // d20: must beat threshold = max(3, 5 + floor(enemy.att/2))
      const roll = Math.floor(this.rng() * 20) + 1;
      const threshold = Math.max(3, 5 + Math.floor(e.att / 2));
      if (roll > threshold) {
        cs.result = 'fled';
        cs.active = false;
        cs.log.push(`🏃 FUGA RIUSCITA! (🎲 ${roll} vs soglia ${threshold}) — Lasci il nemico alle spalle!`);
        if (this.char.onore) this.char.onore.fuggite = (this.char.onore.fuggite || 0) + 1;
      } else {
        cs.log.push(`🏃 FUGA FALLITA! (🎲 ${roll} vs soglia ${threshold}) — Il nemico ti insegue!`);
        const dmgFuga = Math.max(1, Math.floor(this.rng() * e.dan) + 1 - p.rd);
        p.hp -= dmgFuga;
        cs.log.push(`💥 Colpito durante la fuga: -${dmgFuga} HP! HP: ${Math.max(0,p.hp)}/${p.maxHp}`);
      }

    } else if (action === 'surrender') {
      // d10: 1-6 = accettata, 7-10 = rifiutata (attacco furioso)
      const roll = Math.floor(this.rng() * 10) + 1;
      if (roll <= 6) {
        // Resa accettata — cede oggetto o oro
        if (this.char.inventory && this.char.inventory.length > 0) {
          const lostIdx = Math.floor(this.rng() * this.char.inventory.length);
          const lost = this.char.inventory.splice(lostIdx, 1)[0];
          cs.surrenderLoss = `Il nemico prende: ${lost.nome}`;
          cs.log.push(`🏳 (🎲 ${roll}/10) RESA ACCETTATA! Il nemico prende: ${lost.nome}.`);
        } else {
          const goldLost = Math.min(this.char.gold, Math.floor(this.char.gold * 0.25) + 5);
          this.char.gold -= goldLost;
          cs.surrenderLoss = `Perdi ${goldLost} zecchini`;
          cs.log.push(`🏳 (🎲 ${roll}/10) RESA ACCETTATA! Perdi ${goldLost} zecchini.`);
        }
        cs.result = 'surrendered';
        cs.active = false;
        if (this.char.onore) this.char.onore.rese = (this.char.onore.rese || 0) + 1;
      } else {
        // Resa rifiutata — attacco furioso extra +3 danni
        const rawDmg = Math.floor(this.rng() * e.dan) + e.dan + 3;
        const finalDmg = Math.max(1, rawDmg - p.rd);
        p.hp -= finalDmg;
        cs.log.push(`🏳 (🎲 ${roll}/10) RESA RIFIUTATA! Attacco furioso: -${finalDmg} HP! HP: ${Math.max(0,p.hp)}/${p.maxHp}`);
      }
    }

    // Controlla se nemico è morto
    if (e.hp <= 0 && cs.active) {
      cs.result = 'victory';
      cs.active = false;
      cs.log.push(`☠ ${e.nome} SCONFITTO!`);
      if (this.char.onore) this.char.onore.vinte = (this.char.onore.vinte || 0) + 1;
      // Bottino oro (scalato per tier)
      const goldBase = e.tier === 'Boss' ? 80 : e.tier === 'Elite' ? 35 : 10;
      const goldGain = Math.floor(this.rng() * goldBase) + goldBase + 5;
      this.char.gold += goldGain;
      cs.loot.push(`${goldGain} Zecchini`);
      // Named loot drops (rawLoot): 40% Normal, 60% Elite, 80% Boss
      const dropChance = e.tier === 'Boss' ? 0.8 : e.tier === 'Elite' ? 0.6 : 0.4;
      (cs.rawLoot || []).forEach(lootName => {
        if (this.rng() < dropChance) {
          if (this.char.inventory.length >= 10) {
            cs.log.push(`📦 ${lootName} abbandonato — zaino pieno (10/10)!`);
          } else {
            const item = this._makeLootItem(lootName, e.tier);
            this.char.inventory.push(item);
            cs.loot.push(lootName);
            cs.log.push(`📦 TROVATO: ${lootName}!`);
          }
        }
      });

      // Weapon drop: enemy carries a real weapon from items.json
      // Only bosses drop rare weapons; Normale/Elite drop normal/special max
      const wepDrop = e.tier === 'Boss' ? 0.65 : e.tier === 'Elite' ? 0.45 : 0.25;
      if (cs.enemyWeapon && this.rng() < wepDrop && this.char.inventory.length < 10) {
        const wItem = { ...cs.enemyWeapon, instanceId: `w_${Date.now()}_${Math.floor(this.rng()*99999)}` };
        this.char.inventory.push(wItem);
        cs.loot.push(`🗡 ${cs.enemyWeapon.nome}`);
        cs.log.push(`🗡 ARMA NEMICA: ${cs.enemyWeapon.nome}!`);
      }

      // Legendary drop: 12% boss-quest, 7% Elite, 2% Normal
      const legChance = (cs.isBoss && cs.questId) ? 0.12 : e.tier === 'Elite' ? 0.07 : 0.02;
      if (this.rng() < legChance && this.char.inventory.length < 10) {
        const allI = this.data.items || {};
        const legPool = [
          ...(allI.Arma||[]), ...(allI.Arma2M||[]), ...(allI.Torso||[]), ...(allI.Arma_Urlo||[])
        ].filter(i => i.rar === 'legend' && i.id && !i.id.endsWith('_none'));
        if (legPool.length) {
          const leg = legPool[Math.floor(this.rng() * legPool.length)];
          const lItem = { ...leg, instanceId: `leg_${Date.now()}` };
          this.char.inventory.push(lItem);
          cs.loot.push(`✨ ${leg.nome} [LEGGENDARIO]`);
          cs.log.push(`✨ LEGGENDARIO TROVATO: ${leg.nome}!`);
        }
      }
      // Unique drop: 8% Elite, 2% Normal (boss-quest already handled via weapons/named loot)
      const uniChance = e.tier === 'Elite' ? 0.08 : e.tier === 'Boss' ? 0.0 : 0.02;
      if (uniChance > 0 && this.rng() < uniChance && this.char.inventory.length < 10) {
        const allI = this.data.items || {};
        const uniPool = [
          ...(allI.Arma||[]), ...(allI.Arma2M||[]), ...(allI.Torso||[]),
          ...(allI.Testa||[]), ...(allI.Collo||[]), ...(allI.AnelloDX||[])
        ].filter(i => i.rar === 'unique' && i.id && !i.id.endsWith('_none'));
        if (uniPool.length) {
          const uni = uniPool[Math.floor(this.rng() * uniPool.length)];
          const uItem = { ...uni, instanceId: `uni_${Date.now()}` };
          this.char.inventory.push(uItem);
          cs.loot.push(`💎 ${uni.nome} [UNICO]`);
          cs.log.push(`💎 UNICO TROVATO: ${uni.nome}!`);
        }
      }

      cs.log.push(`💰 Bottino: ${cs.loot.join(', ')}`);
    }

    // Turno nemico (se combat ancora attivo)
    if (cs.active) {
      this._enemyTurn();
    } else {
      // Aggiorna HP del personaggio
      this.char.derived.hp = p.hp;
    }

    Screens.updateCombat({ combatState: cs, character: this.char });
    if (cs.result) this._handleCombatResult(cs.result, cs.loot);
  },

  _enemyTurn() {
    const cs = this.combatState;
    if (!cs || !cs.active) return;
    const p = cs.player;
    const e = cs.enemy;

    // Apply player next-turn buffs (sopravvivenza/sopportazione)
    const pnt = cs.playerNextTurn || {};
    const defBonus = (p.defending ? 3 : 0) + (pnt.defBonus || 0);
    const rdBonus = pnt.rdBonus || 0;
    if (pnt.defBonus) cs.log.push(`🛡 Guardia alta! DEF+${pnt.defBonus}`);
    if (pnt.rdBonus) cs.log.push(`🛡 Riduzione danni! RD+${pnt.rdBonus}`);

    // Apply enemy next-turn penalties (intimidire)
    const ent = cs.enemyNextTurn || {};
    const eAttPenalty = ent.attPenalty || 0;
    const eDefPenalty = ent.defPenalty || 0;
    if (eAttPenalty || eDefPenalty) cs.log.push(`😨 ${e.nome} intimidito! ATT-${eAttPenalty} DEF-${eDefPenalty}`);

    // Abilità speciale nemico ogni 3 turni
    if (cs.turn % 3 === 0 && e.skills && e.skills.length > 0) {
      const skill = e.skills[Math.floor(this.rng() * e.skills.length)];
      const skillRdBonus = p.defending ? rdBonus + 3 : rdBonus;
      const { total, logStr } = this._calcEnemyDmg({ ...e, dan: Math.floor(e.dan * 1.5) }, p, skillRdBonus);
      const finalDmg = Math.max(0, total);
      p.hp -= finalDmg;
      cs.log.push(`👹 ${e.nome} usa ${skill}! ${logStr}. HP: ${Math.max(0,p.hp)}/${p.maxHp}`);
      // Poison DoT if VEL skill — saving throw vs resistance
      if (e.elemAttack && e.elemAttack.type === 'VEL' && finalDmg > 0 && !this.godMode) {
        const poisonDpd = this._calcPoisonDpd(e);
        const velRes = (this.char.resistances || {}).veleno || 0;
        const saveRoll = Math.floor(this.rng() * 20) + 1;
        const saveDC = 10 + Math.floor(e.elemAttack.val / 2);
        const saveBonus = Math.floor(velRes / 10);
        if (saveRoll + saveBonus >= saveDC) {
          cs.log.push(`🛡 Tiro salvezza VELENO riuscito! (${saveRoll}+${saveBonus} vs DC${saveDC})`);
        } else {
          if ((this.char.poisonDmgPerDay || 0) < poisonDpd) {
            this.char.poisonDmgPerDay = poisonDpd;
            cs.log.push(`☠ AVVELENATO! Perderai ${poisonDpd} HP/giorno. (dado:${saveRoll}+${saveBonus} vs DC${saveDC}) Acquista antidoto dalla Maga!`);
            updateGlobalHUD(this.char);
          } else {
            cs.log.push(`☠ Veleno già attivo (${this.char.poisonDmgPerDay} HP/g). Acquista antidoto! (dado:${saveRoll}+${saveBonus} vs DC${saveDC})`);
          }
        }
      }
    } else {
      const hitRoll = Math.floor(this.rng() * 20) + 1;
      const effAtt = Math.max(0, e.att - eAttPenalty);
      const effDef = p.def + defBonus;
      if (hitRoll + effAtt > effDef + 8) {
        const { total, logStr } = this._calcEnemyDmg(e, p, rdBonus);
        const finalDmg = Math.max(0, total);
        p.hp -= finalDmg;
        if (finalDmg === 0) {
          cs.log.push(`🛡 ${e.nome} attacca ma BLOCCATO! ${logStr}.`);
        } else {
          cs.log.push(`💥 ${e.nome} colpisce! ${logStr}. HP: ${Math.max(0,p.hp)}/${p.maxHp}`);
          // Poison DoT on VEL hit — saving throw vs resistance
          if (e.elemAttack && e.elemAttack.type === 'VEL' && !this.godMode) {
            const poisonDpd = this._calcPoisonDpd(e);
            const velRes = (this.char.resistances || {}).veleno || 0;
            const saveRoll = Math.floor(this.rng() * 20) + 1;
            const saveDC = 10 + Math.floor(e.elemAttack.val / 2);
            const saveBonus = Math.floor(velRes / 10);
            if (saveRoll + saveBonus >= saveDC) {
              cs.log.push(`🛡 Tiro salvezza VELENO riuscito! (${saveRoll}+${saveBonus} vs DC${saveDC})`);
            } else {
              if ((this.char.poisonDmgPerDay || 0) < poisonDpd) {
                this.char.poisonDmgPerDay = poisonDpd;
                cs.log.push(`☠ AVVELENATO! Perderai ${poisonDpd} HP/giorno. (dado:${saveRoll}+${saveBonus} vs DC${saveDC}) Acquista antidoto dalla Maga!`);
                updateGlobalHUD(this.char);
              } else {
                cs.log.push(`☠ Veleno già attivo (${this.char.poisonDmgPerDay} HP/g). Acquista antidoto! (dado:${saveRoll}+${saveBonus} vs DC${saveDC})`);
              }
            }
          }
        }
      } else {
        cs.log.push(`· ${e.nome} manca. (dado: ${hitRoll})`);
      }
    }

    // Clear per-turn buffs/debuffs
    cs.playerNextTurn = {};
    cs.enemyNextTurn = {};
    cs.skillUsedThisTurn = false;
    p.defending = false;
    cs.turn++;

    // GOD mode: player immune to damage
    if (this.godMode) p.hp = p.maxHp;

    // Controlla morte giocatore
    if (p.hp <= 0) {
      p.hp = 0;
      cs.result = 'death';
      cs.active = false;
      cs.log.push(`💀 SEI CADUTO IN BATTAGLIA!`);
    }

    this.char.derived.hp = p.hp;
    Screens.updateCombat({ combatState: cs, character: this.char });
    if (cs.result) this._handleCombatResult(cs.result, cs.loot);
  },

  _handleCombatResult(result, loot) {
    const box = document.getElementById('comb-result-box');
    if (!box) return;
    box.style.display = 'block';

    let html = '';
    if (result === 'victory') {
      const isBoss = this.combatState && this.combatState.isBoss && this.combatState.questId;
      if (isBoss) {
        const qId = this.combatState.questId;
        const qCh = this.combatState.questChoice || 1;
        const fragNum = qId.replace('M','');
        // Store for afterCombat() — don't auto-navigate yet
        this._pendingQuestComplete = { questId: qId, choice: qCh };
        html = `<div style="color:#ffd700;font-size:1.6em;margin-bottom:6px;letter-spacing:2px;">⚔ BOSS SCONFITTO!</div>
                <div style="color:#88ccff;font-size:12px;margin-bottom:4px;">❄ FRAMMENTO ${fragNum} DI YMIR OTTENUTO!</div>
                ${loot.length ? `<div style="color:#7f7;font-size:11px;margin-bottom:4px;">BOTTINO: ${loot.join(', ')}</div>` : ''}
                <div style="color:#888;font-size:10px;margin-bottom:8px;">Crom annuisce in silenzio.</div>
                <button class="btn-action" style="margin-top:6px;background:#1a3a00;border-color:#ffd700;color:#ffd700;" onclick="Game.afterCombat()">▶ TORNA ALLA LOCATION</button>`;
      } else {
        // Separate gold from item loot for clearer display
        const goldEntry = loot.find(l => l.includes('Zecchini'));
        const itemEntries = loot.filter(l => !l.includes('Zecchini'));
        const cs2 = this.combatState;
        const isMinor = cs2 && cs2.minorQuestId;
        html = `<div style="color:#ffd700;font-size:1.2em;margin-bottom:6px;letter-spacing:1px;">⚔ VITTORIA!</div>
                ${goldEntry ? `<div style="color:#ffd700;font-size:12px;margin-bottom:3px;">💰 ${goldEntry}</div>` : ''}
                ${itemEntries.length ? `<div style="color:#7f7;font-size:11px;margin-bottom:2px;">📦 ZAINO: ${itemEntries.join(', ')}</div><div style="color:#555;font-size:10px;margin-bottom:4px;">(clicca sugli oggetti per equipaggiarli)</div>` : ''}
                ${isMinor ? `<div style="color:#88ccff;font-size:11px;margin-bottom:4px;">📋 Missione completata — controlla il log per i bonus!</div>` : ''}
                <button class="btn-action" style="margin-top:8px;" onclick="Game.afterCombat()">▶ CONTINUA</button>`;
      }
    } else if (result === 'death') {
      const destCount = this.char ? (this.char.destino || 0) : 0;
      const hasDest = destCount > 0;
      const revHp = this.char ? Math.max(5, Math.floor((this.char.derived.maxHp || 20) * 0.3)) : 5;
      // Infrangibile: Cimmero ignora 1 KO per sessione (Bug #8)
      const hasInfrangibile = this.char &&
        !this.char.infrangibileUsed &&
        (this.char.traits || []).some(t => typeof t === 'string' && t.toLowerCase().includes('infrangibile'));
      if (hasInfrangibile) {
        this.char.infrangibileUsed = true;
        this.char.derived.hp = revHp;
        if (this.combatState && this.combatState.player) this.combatState.player.hp = revHp;
        updateGlobalHUD(this.char);
        html = `<div style="color:#ffd700;font-size:1.4em;margin-bottom:6px;">🗡 INFRANGIBILE!</div>
                <div style="color:#ccc;font-size:12px;">Lo spirito cimmero si rifiuta di cadere. Risorgi con ${revHp} HP.</div>
                <div style="color:#888;font-size:10px;margin-top:4px;">(tratto esaurito per questa sessione)</div>
                <button class="btn-action" style="margin-top:10px;" onclick="Game.afterCombat()">▶ CONTINUA</button>`;
      } else if (!hasDest) {
        html = `<div style="color:#f44;font-size:1.5em;margin-bottom:8px;">💀 SEI CADUTO!</div>
                <div style="color:#888;font-size:11px;">Crom ride del tuo fallimento...</div>
                <div style="color:#555;font-size:11px;margin-top:8px;">Nessun Destino rimasto. La sconfitta è accettata...</div>`;
        setTimeout(() => Game._handleDeath(), 2000);
      } else {
        html = `<div style="color:#f44;font-size:1.5em;margin-bottom:8px;">💀 SEI CADUTO!</div>
                <div style="color:#888;font-size:11px;">Crom ride del tuo fallimento...</div>
                <div style="color:#ffd700;font-size:12px;margin:8px 0 4px;">⭐ DESTINO: ${destCount} / 1</div>
                <button class="btn-action" style="margin-top:4px;background:#1a1400;border-color:#ffd700;color:#ffd700;" onclick="Game._riseFromDead()">⭐ USA DESTINO — Risorgi con ${revHp} HP</button><br>
                <button class="btn-back" style="margin-top:8px;" onclick="Game._handleDeath()">💀 ACCETTA SCONFITTA (−25% oro, −1 oggetto)</button>`;
      }
    } else if (result === 'fled') {
      const wasQuestBoss = this.combatState && this.combatState.isBoss && this.combatState.questId;
      // Clear pending quest state on flee — quest remains ACTIVE, not completed
      this._pendingQuestComplete = null;
      this._pendingQuestId = null;
      this._pendingQuestChoice = null;
      html = `<div style="color:#aaa;font-size:1.1em;margin-bottom:8px;">🏃 FUGGITO!</div>
              <div style="font-size:10px;color:#888;">Hai lasciato il nemico alle spalle.</div>
              ${wasQuestBoss ? `<div style="color:#ffaa44;font-size:10px;margin-top:4px;">⚠ Quest ancora ATTIVA — torna per affrontare il boss.</div>` : ''}
              <button class="btn-action" style="margin-top:10px;" onclick="Game.afterCombat()">▶ CONTINUA</button>`;
    } else if (result === 'surrendered') {
      const lossMsg = (this.combatState && this.combatState.surrenderLoss) || 'Risorse perdute';
      html = `<div style="color:#ff8800;font-size:1.1em;margin-bottom:8px;">🏳 RESA</div>
              <div style="font-size:11px;color:#ffaa44;margin-bottom:6px;">📦 ${lossMsg}</div>
              <button class="btn-action" style="margin-top:10px;" onclick="Game.afterCombat()">▶ CONTINUA</button>`;
    }
    box.innerHTML = html;
    const actBtns = document.getElementById('comb-action-btns');
    if (actBtns) actBtns.style.display = 'none';
  },

  _handleDeath() {
    const penalty = Math.floor((this.char.gold || 0) * 0.25);
    this.char.gold = Math.max(0, (this.char.gold || 0) - penalty);
    let lostItem = '';
    if (this.char.inventory && this.char.inventory.length > 0) {
      const idx = Math.floor(Math.random() * this.char.inventory.length);
      lostItem = this.char.inventory.splice(idx, 1)[0].nome;
    }
    this.char.derived.hp = Math.max(5, Math.floor((this.char.derived.maxHp || 20) * 0.25));
    this.combatState = null;
    this.travelState = null;
    this.char.travelDestination = null;
    addLog('log-main', `💀 SCONFITTO! -${penalty} ZEC${lostItem ? ', perso: '+lostItem : ''}. HP: ${this.char.derived.hp}/${this.char.derived.maxHp}`, '#ff4444');
    const dead = this.char;
    this.char = null; // skip confirm in goTitle
    try { API.saveCharacter(dead); } catch(e) {}
    this.goTitle();
  },

  _riseFromDead() {
    if (!this.char || (this.char.destino || 0) <= 0) return;
    this.char.destino--;
    const reviveHp = Math.max(5, Math.floor((this.char.derived.maxHp || 20) * 0.3));
    this.char.derived.hp = reviveHp;
    if (this.combatState && this.combatState.player) {
      this.combatState.player.hp = reviveHp;
    }
    updateGlobalHUD(this.char);
    addLog('log-main', `⭐ DESTINO SPESO! Risorgi con ${reviveHp} HP. Destino rimasto: ${this.char.destino}`, '#ffd700');
    this.afterCombat();
  },

  afterCombat() {
    const cs = this.combatState;
    this.combatState = null;
    // Clear per-combat potion resistance bonuses
    if (this.char && this.char.potionResistances) {
      this.char.potionResistances = {};
      this._recalcStats();
    }
    const pending = this._pendingQuestComplete;
    this._pendingQuestComplete = null;
    if (pending) {
      this.completeQuest(pending.questId, pending.choice);
      return; // completeQuest calls showLocation()
    }
    const minorQuestId = (cs && cs.minorQuestId && cs.result === 'victory') ? cs.minorQuestId : null;
    // Bug fix: reset minor quest stato on flee/surrender so player can retry
    if (cs && cs.minorQuestId && (cs.result === 'fled' || cs.result === 'surrendered')) {
      if (this.char.questMinorStato && this.char.questMinorStato[cs.minorQuestId] === 'accettata') {
        delete this.char.questMinorStato[cs.minorQuestId];
        addLog('log-local', `⚠ Missione non completata — puoi riprovare.`, '#ffaa44');
      }
    }
    if (this.char.travelDestination !== null && this.travelState && this.travelState.active) {
      // Return to travel screen — player presses AVANZA to continue (no auto-step to avoid instant re-encounter)
      Screens.renderTravel(this._state(), this.travelState);
      showScreen('screen-travel');
      if (minorQuestId) this._completeMinorQuest(minorQuestId);
    } else {
      if (minorQuestId) {
        // Mark complete BEFORE showLocation so bulletin board renders grey immediately
        this._pendingQuestLogs = [];
        this._completeMinorQuest(minorQuestId);
      }
      this.showLocation(); // clears log-local; board now renders with questMinorStato='completata'
      if (minorQuestId && this._pendingQuestLogs) {
        // Flush buffered reward logs to fresh log-local (after showLocation cleared it)
        this._pendingQuestLogs.forEach(([msg, col]) => addLog('log-local', msg, col));
        this._pendingQuestLogs = null;
      }
    }
  },

  showCombatSkills() {
    if (!this.char) return;
    const menu = document.getElementById('comb-skill-menu');
    if (!menu) return;
    if (menu.style.display === 'block' && menu.dataset.mode === 'skills') { menu.style.display = 'none'; return; }
    menu.dataset.mode = 'skills';
    const cs = this.combatState;

    if (cs && cs.skillUsedThisTurn) {
      menu.innerHTML = '<div style="color:#888;font-size:10px;padding:4px;">Abilità già usata questo turno.</div>';
      menu.style.display = 'block';
      return;
    }

    // Skill definitions — name includes (match with .includes on lowercase)
    const SKILL_DEFS = [
      { key: 'furia',          type:'ATK', label:'FURIA',          desc:'Turno prossimo: colpo devastante (DAN×2)',      color:'#ff7733' },
      { key: 'intimidire',     type:'ATK', label:'INTIMIDIRE',     desc:'Turno prossimo: nemico ATT-2 DEF-2',            color:'#ff5533' },
      { key: 'sopravvivenza',  type:'DEF', label:'SOPRAVVIVENZA',  desc:'Turno prossimo: guardia alta DEF+4',            color:'#33aaff' },
      { key: 'sopportazione',  type:'DEF', label:'SOPPORTAZIONE',  desc:'Turno prossimo: assorbi danni RD+5',            color:'#33aaff' },
      { key: 'colpo possente', type:'ATK', label:'COLPO POSSENTE', desc:'Attacco immediato: danno massimo garantito',    color:'#ff9944' },
      { key: 'colpo furtivo',  type:'ATK', label:'COLPO FURTIVO',  desc:'Attacco immediato: ignora DEF nemica',          color:'#ff7700' },
      { key: 'lama avvelenata',type:'ATK', label:'LAMA AVVELENATA',desc:'Attacco immediato: +veleno (2 turni)',          color:'#aaff33' },
      { key: 'dardo oscuro',   type:'ATK', label:'DARDO OSCURO',   desc:'Attacco immediato: danno magico +5',            color:'#aa44ff' },
      { key: 'maledizione',    type:'ATK', label:'MALEDIZIONE',    desc:'Turno prossimo: nemico ATT-3',                  color:'#cc33cc' },
      { key: 'evocazione',     type:'ATK', label:'EVOCAZIONE',     desc:'Attacco immediato: danno extra +4',             color:'#cc66ff' },
      { key: 'benedizione',    type:'DEF', label:'BENEDIZIONE',    desc:'Recupero immediato: +8 HP',                     color:'#ffcc33' },
      { key: 'guarigione',     type:'DEF', label:'GUARIGIONE',     desc:'Recupero immediato: +12 HP',                    color:'#33ff77' },
      { key: 'visione',        type:'ATK', label:'VISIONE',        desc:'Turno prossimo: vedi punti deboli +ATT+2',      color:'#ffff33' },
      { key: 'schivata',       type:'DEF', label:'SCHIVATA',       desc:'Turno prossimo: +50% chance schivata',          color:'#33aaff' },
      { key: 'scherma',        type:'ATK', label:'SCHERMA',        desc:'Attacco immediato: danno preciso +3',           color:'#ffaa33' },
      { key: 'combattimento',  type:'ATK', label:'COMBATTIMENTO',  desc:'Attacco immediato: danno extra +3',             color:'#ff7733' },
    ];
    // Skip: odio, testardaggine, non-combat
    const SKIP_KEYS = ['odio','testardaggine','scassinare','trappole','tracciamento','sopravvivenza della strada','erboristeria','cucina','navigazione','navigazione','astronomia','diplomatica','lingue','storia','acrobazia','equipaggio','valutazione','commercio','resistenza al freddo','arco composito','tattica','diplomazia'];

    const skills = this.char.skills || [];
    const combatSkills = skills
      .map((sk, i) => ({ sk, i, def: SKILL_DEFS.find(d => sk.toLowerCase().includes(d.key)) }))
      .filter(({ sk, def }) => def && !SKIP_KEYS.some(bad => sk.toLowerCase().includes(bad)));

    if (!combatSkills.length) {
      menu.innerHTML = '<div style="color:#888;font-size:10px;padding:4px;">NESSUNA ABILITÀ DI COMBATTIMENTO.</div>';
      menu.style.display = 'block';
      return;
    }

    menu.innerHTML = `<div style="font-size:10px;color:var(--c64-yellow);margin-bottom:4px;">ABILITÀ SPECIALI (1 per turno):</div>` +
      `<div style="display:flex;flex-wrap:wrap;gap:6px;">` +
      combatSkills.map(({ sk, i, def }) =>
        `<button class="enc-btn special" style="font-size:10px;color:${def.color};background:#0a0a16;border-color:${def.color};display:flex;flex-direction:column;align-items:center;min-width:110px;padding:6px 4px;" onclick="Game.combatAction('skill:${i}')">
          <span>${def.type==='ATK'?'⚔':'🛡'} ${def.label}</span>
          <span style="font-size:9px;color:#888;margin-top:3px;text-transform:none;font-weight:normal;">${def.desc}</span>
        </button>`
      ).join('') + `</div>`;
    menu.style.display = 'block';
  },

  // ── SHOP ─────────────────────────────────
  openShop(shopType) {
    if (!this.char || !this.data) return;
    const shopDef = this.data.shops[shopType];
    if (!shopDef) { addLog('log-local', `Negozio ${shopType} non trovato nei dati.`, '#f77'); return; }
    const overlay = document.getElementById('shop-' + shopType);
    if (!overlay) { addLog('log-local', `Overlay shop-${shopType} mancante nell'HTML.`, '#f77'); return; }

    const items = this._generateShopStock(shopType);
    const title = shopDef.nome || shopType.toUpperCase();
    const voice = shopDef.voce || '';
    const icons = { fabbro:'⚒', mistico:'📜', maga:'🔮' };

    const SHOP_IMGS = { fabbro: 'fabbro', mistico: 'mistico', maga: 'strega' };
    const shopImgName = SHOP_IMGS[shopType];
    const shopImgHtml = shopImgName
      ? `<img src="/imageLocations/${shopImgName}.png" alt="${shopType}" style="width:100%;height:420px;object-fit:cover;object-position:top;border:2px solid #555;display:block;border-radius:2px;" onerror="this.style.display='none'">`
      : '';

    const itemsHtml = items.map((item, idx) => {
      const rarCol = {normal:'#aaa',special:'#5599ff',rare:'#ddcc22',legend:'#44cc44',unique:'#ff4444'}[item.rar||'normal']||'#aaa';
      const slotTag = slotLabel(item);
      return `<div class="shop-item rar-${item.rar||'normal'}" onclick="Game.selectShopItem(${idx})">
        <div class="item-name" style="color:${rarCol}">${item.nome}${weaponHandsTag(item)}</div>
        ${slotTag ? `<div style="font-size:9px;color:#666;margin-bottom:2px;">${slotTag}</div>` : ''}
        <div class="item-price">${item.prezzo || 0} ZEC</div>
        <div class="item-effect" style="font-size:10px;color:#888;">${itemStatsText(item)||item.desc||''}</div>
      </div>`;
    }).join('');

    const sellHtml = (this.char.inventory||[]).filter(i=>i&&i.nome).map(i=>{
      const sellPrice = Math.max(1, Math.floor((i.prezzo||1)/2));
      const rarCol = {normal:'#aaa',special:'#5599ff',rare:'#ddcc22',legend:'#44cc44',unique:'#ff4444'}[i.rar||'normal']||'#aaa';
      return `<button data-iid="${(i.instanceId||i.nome).replace(/"/g,'&quot;')}" data-shop="${shopType}" onclick="Game.sellItem(this.dataset.iid,this.dataset.shop)" style="background:#1a1400;border:1px solid #444;color:${rarCol};font-size:10px;padding:3px 6px;cursor:pointer;">${i.nome} (+${sellPrice} ZEC)</button>`;
    }).join('') || '<span style="color:#555;font-size:10px;">Nessun oggetto vendibile.</span>';

    // Store context so selectShopItem can access by index
    this._shopCtx = { type: shopType, items };

    overlay.innerHTML = `
      <div class="shop-title">
        <span>${icons[shopType]||''} ${title}</span>
        <button class="btn-close-shop" onclick="Game.closeShop('${shopType}')">✕ CHIUDI</button>
      </div>
      <div style="display:grid;grid-template-columns:320px 1fr;gap:16px;align-items:start;">
        <!-- LEFT: NPC image -->
        <div style="position:sticky;top:20px;">
          ${shopImgHtml}
          <div style="font-size:10px;color:#888;text-align:center;margin-top:4px;font-style:italic;letter-spacing:1px;">${title}</div>
          <div style="font-style:italic;font-size:11px;color:#aaa;margin-top:8px;text-align:center;padding:0 4px;">"${voice}"</div>
        </div>
        <!-- RIGHT: items -->
        <div>
          <div style="font-size:11px;margin-bottom:8px;">💰 I TUOI ZECCHINI: <strong id="shop-gold-${shopType}" style="color:var(--c64-gold);">${this.char.gold}</strong></div>
          <div class="shop-grid">${itemsHtml}</div>
          <div id="shop-buy-bar-${shopType}" class="shop-buy-bar" style="display:none;"></div>
          <div id="shop-msg-${shopType}" style="font-size:11px;min-height:16px;margin-top:8px;color:#7f7;"></div>
          <div style="margin-top:12px;border-top:1px solid #333;padding-top:8px;">
            <div style="color:var(--c64-yellow);font-size:11px;margin-bottom:6px;">💰 VENDI OGGETTI (50% prezzo)</div>
            <div id="shop-sell-list-${shopType}" style="display:flex;flex-wrap:wrap;gap:4px;max-height:100px;overflow-y:auto;">${sellHtml}</div>
          </div>
        </div>
      </div>`;
    overlay.classList.add('open');
  },

  selectShopItem(idx) {
    if (!this._shopCtx) return;
    const { type, items } = this._shopCtx;
    const item = items[idx];
    if (!item) return;
    this._shopCtx.selected = item;

    const bar = document.getElementById(`shop-buy-bar-${type}`);
    if (!bar) return;
    const rarCol = {normal:'#aaa',special:'#5599ff',rare:'#ddcc22',legend:'#44cc44',unique:'#ff4444'}[item.rar||'normal']||'#aaa';
    bar.style.display = 'block';
    const slotTag2 = slotLabel(item);
    bar.innerHTML = `
      <div style="color:${rarCol};font-weight:bold;margin-bottom:2px;">${item.nome}${weaponHandsTag(item)}</div>
      ${slotTag2 ? `<div style="font-size:9px;color:#888;margin-bottom:4px;">${slotTag2}</div>` : ''}
      <div style="font-size:10px;color:#aaa;">${itemStatsText(item)||item.desc||''}</div>
      <div style="margin-top:8px;">
        <button class="btn-buy" onclick="Game.buySelectedItem()">
          💰 ACQUISTA (${item.prezzo || 0} ZEC)
        </button>
      </div>`;
  },

  buySelectedItem() {
    if (!this._shopCtx || !this._shopCtx.selected) return;
    const { type, selected } = this._shopCtx;
    const msgEl = document.getElementById(`shop-msg-${type}`);
    const price = selected.prezzo || 0;
    if (this.char.gold < price) {
      if (msgEl) { msgEl.textContent = '❌ ORO INSUFFICIENTE!'; msgEl.style.color = '#f77'; }
      return;
    }
    if ((this.char.inventory || []).length >= 10) {
      if (msgEl) { msgEl.textContent = '❌ ZAINO PIENO (10/10)!'; msgEl.style.color = '#f77'; }
      return;
    }
    this.char.gold -= price;
    const copy = { ...selected, instanceId: `${selected.id||selected.nome}_${Date.now()}` };
    this.char.inventory.push(copy);
    addLog('log-local', `Acquistato: ${selected.nome} (-${price} ZEC)`, '#7f7');
    // Remove bought item from shop cache so it can't be bought again
    if (this._shopStockCache && this._shopStockCache.stocks[type]) {
      this._shopStockCache.stocks[type] = this._shopStockCache.stocks[type].filter(i => i.id !== selected.id);
    }
    // Update gold display
    const goldEl = document.getElementById(`shop-gold-${type}`);
    if (goldEl) goldEl.textContent = this.char.gold;
    // Re-render shop grid without bought item
    const gridEl = document.querySelector(`#shop-${type} .shop-grid`);
    if (gridEl) {
      const remaining = (this._shopStockCache && this._shopStockCache.stocks[type]) || [];
      this._shopCtx.items = remaining;
      gridEl.innerHTML = remaining.map((item, idx) => {
        const rarCol = {normal:'#aaa',special:'#5599ff',rare:'#ddcc22',legend:'#44cc44',unique:'#ff4444'}[item.rar||'normal']||'#aaa';
        const slotTag = slotLabel(item);
        return `<div class="shop-item rar-${item.rar||'normal'}" onclick="Game.selectShopItem(${idx})">
          <div class="item-name" style="color:${rarCol}">${item.nome}${weaponHandsTag(item)}</div>
          ${slotTag ? `<div style="font-size:9px;color:#666;margin-bottom:2px;">${slotTag}</div>` : ''}
          <div class="item-price">${item.prezzo || 0} ZEC</div>
          <div class="item-effect" style="font-size:10px;color:#888;">${itemStatsText(item)||item.desc||''}</div>
        </div>`;
      }).join('') || '<div style="color:#555;font-size:11px;padding:8px;">ESAURITO</div>';
    }
    // Hide buy bar
    const bar = document.getElementById(`shop-buy-bar-${type}`);
    if (bar) bar.style.display = 'none';
    this._shopCtx.selected = null;
    updateGlobalHUD(this.char);
    // Show use/equip prompt in shop msg area
    if (msgEl) this._showBuyUsePrompt(copy, type, msgEl);
  },

  _showBuyUsePrompt(item, shopType, msgEl) {
    if (msgEl) msgEl.innerHTML = `<span style="color:#7f7;">✓ ${item.nome}${weaponHandsTag(item)} → ZAINO. Equipaggia dalla scheda.</span>`;
    // Refresh sell list so new item appears
    const sellList = shopType ? document.getElementById(`shop-sell-list-${shopType}`) : null;
    if (sellList) {
      const inv = this.char.inventory || [];
      sellList.innerHTML = inv.filter(i => i && i.nome).map(i => {
        const sellPrice = Math.max(1, Math.floor((i.prezzo || 1) / 2));
        const rarCol = {normal:'#aaa',special:'#5599ff',rare:'#ddcc22',legend:'#44cc44',unique:'#ff4444'}[i.rar||'normal']||'#aaa';
        return `<button data-iid="${(i.instanceId||i.nome).replace(/"/g,'&quot;')}" data-shop="${shopType}" onclick="Game.sellItem(this.dataset.iid,this.dataset.shop)" style="background:#1a1400;border:1px solid #444;color:${rarCol};font-size:10px;padding:3px 6px;cursor:pointer;">${i.nome} (+${sellPrice} ZEC)</button>`;
      }).join('') || '<span style="color:#555;font-size:10px;">Nessun oggetto vendibile.</span>';
    }
  },

  // Kept for compatibility but now wrapped through buySelectedItem
  buyItem(item, shopType) {
    this._shopCtx = this._shopCtx || { type: shopType, items: [] };
    this._shopCtx.selected = item;
    this._shopCtx.type = shopType;
    this.buySelectedItem();
  },

  sellItem(instanceOrNome, shopType) {
    if (!this.char) return;
    const idx = this.char.inventory.findIndex(i => (i.instanceId || i.nome) === instanceOrNome);
    if (idx < 0) return;
    const item = this.char.inventory[idx];
    const sellPrice = Math.max(1, Math.floor((item.prezzo || 1) / 2));
    this.char.inventory.splice(idx, 1);
    this.char.gold = (this.char.gold || 0) + sellPrice;
    const msgEl = document.getElementById(`shop-msg-${shopType}`);
    if (msgEl) { msgEl.textContent = `✓ VENDUTO: ${item.nome} (+${sellPrice} ZEC)`; msgEl.style.color = '#7f7'; }
    addLog('log-local', `Venduto: ${item.nome} (+${sellPrice} ZEC)`, '#7f7');
    // Refresh gold and sell list
    const goldEl = document.getElementById(`shop-gold-${shopType}`);
    if (goldEl) goldEl.textContent = this.char.gold;
    const sellList = document.getElementById(`shop-sell-list-${shopType}`);
    if (sellList) {
      const remaining = (this.char.inventory||[]).filter(i=>i&&i.nome);
      sellList.innerHTML = remaining.length ? remaining.map(i=>{
        const sp = Math.max(1, Math.floor((i.prezzo||1)/2));
        const rarCol = {normal:'#aaa',special:'#5599ff',rare:'#ddcc22',legend:'#44cc44',unique:'#ff4444'}[i.rar||'normal']||'#aaa';
        return `<button data-iid="${(i.instanceId||i.nome).replace(/"/g,'&quot;')}" data-shop="${shopType}" onclick="Game.sellItem(this.dataset.iid,this.dataset.shop)" style="background:#1a1400;border:1px solid #444;color:${rarCol};font-size:10px;padding:3px 6px;cursor:pointer;">${i.nome} (+${sp} ZEC)</button>`;
      }).join('') : '<span style="color:#555;font-size:10px;">Nessun oggetto vendibile.</span>';
    }
    updateGlobalHUD(this.char);
  },

  // ── SHOP GENERATION ──────────────────────
  _RARITY_BASE_PRICE: { normal:20, special:80, rare:220, legend:600, unique:1500 },

  _generateShopStock(shopType) {
    if (!this.data || !this.char) return [];
    const shopDef = this.data.shops[shopType];
    if (!shopDef) return [];
    // Fallback: static items (legacy) — shouldn't happen after refactor
    if (!shopDef.catalog) return shopDef.items || [];

    // Return cached stock for this location visit
    if (!this._shopStockCache) this._shopStockCache = { locIdx: this.char.currentLocation, stocks: {} };
    if (this._shopStockCache.locIdx !== this.char.currentLocation) {
      this._shopStockCache = { locIdx: this.char.currentLocation, stocks: {} };
    }
    if (this._shopStockCache.stocks[shopType]) return this._shopStockCache.stocks[shopType];

    const cat = shopDef.catalog;
    const allItems = this.data.items || {};
    const EXCL = new Set(['Nessuno','Nessuna','Nessun','Vuoto','Nessuna']);

    // Build pool from specified slots
    let pool = [];
    (cat.slots || []).forEach(slot => {
      (allItems[slot] || []).forEach(item => {
        if (!item.id || EXCL.has(item.nome) || item.rar === 'unique') return;
        pool.push(item);
      });
    });

    // Filter by allowed rarities
    const allowedRar = new Set(cat.rarities || ['normal']);
    pool = pool.filter(item => allowedRar.has(item.rar || 'normal'));
    if (!pool.length) return [];

    // Seeded mini-rng for shop (doesn't consume main game rng)
    const shopSeed = this._hashSeed(`shop_${shopType}_${this.char.currentLocation}_${this.char.seed||0}`);
    const srng = this._makeRNG(shopSeed);

    // Shuffle and pick countMin–countMax unique items
    const count = Math.floor(srng() * (cat.countMax - cat.countMin + 1)) + cat.countMin;
    const shuffled = [...pool].sort(() => srng() - 0.5);
    const usedIds = new Set();
    const picked = [];
    for (const item of shuffled) {
      if (picked.length >= count) break;
      if (usedIds.has(item.id)) continue;
      usedIds.add(item.id);
      const basePr = this._RARITY_BASE_PRICE[item.rar || 'normal'] || 20;
      const varFactor = 1 + (cat.priceVar || 0.2) * (srng() * 2 - 1);
      const prezzo = Math.max(5, Math.round(basePr * varFactor / 5) * 5);
      picked.push({ ...item, prezzo });
    }
    // Maga sempre vende antidoto se player è avvelenato
    if (shopType === 'maga' && (this.char.poisonDmgPerDay || 0) > 0) {
      picked.unshift({
        id: 'antidoto_maga', nome: 'Antidoto della Maga', rar: 'special', slot: null,
        tipo: 'consumabile', prezzo: 40,
        effetto: { curePoison: true, hp: 5 },
        desc: `Cura il veleno (${this.char.poisonDmgPerDay} HP/g) e recupera 5 HP.`,
        usableInCombat: false
      });
    }
    this._shopStockCache.stocks[shopType] = picked;
    return picked;
  },

  // Pick a weapon from items.json for an enemy based on type and tier
  _pickEnemyWeapon(enemyType, tier) {
    const allItems = this.data && this.data.items || {};
    const typeToSlots = { Umanoide:['Arma','Arma2M'], 'Non-Morto':['Arma'], Mitologico:['Arma2M'], Bestia:null, Elementale:null, Costrutto:null };
    const slots = typeToSlots[enemyType] || null;
    if (!slots) return null;
    const maxRarIdx = { normal:0, special:1, rare:2, legend:3 }[tier === 'Boss' ? 'rare' : tier === 'Elite' ? 'special' : 'normal'] || 0;
    const rarOrd = { normal:0, special:1, rare:2, legend:3, unique:4 };
    let pool = [];
    slots.forEach(slot => {
      (allItems[slot] || []).forEach(item => {
        if (!item.id || item.id.endsWith('_none') || (rarOrd[item.rar||'normal'] || 0) > maxRarIdx) return;
        pool.push(item);
      });
    });
    if (!pool.length) return null;
    return pool[Math.floor(this.rng() * pool.length)];
  },

  closeShop(shopType) {
    const overlay = document.getElementById('shop-' + shopType);
    if (overlay) overlay.classList.remove('open');
    this._shopCtx = null;
    Screens._renderSidebarInventory(this.char);
  },

  // ── QUEST ─────────────────────────────────
  checkQuestsAtLocation() {
    if (!this.char || !this.data) return;
    const locIdx = this.char.currentLocation;
    const loc = this.data.locations[locIdx];
    if (!loc) return;
    // Find any active major quest at this location (handles M9/M10 at same loc as earlier quests)
    const activeQuest = (this.data.quests.major || []).find(q =>
      q.locationIdx === locIdx && (this.char.questMajorStato || {})[q.id] === 'attiva'
    );
    if (activeQuest) {
      Screens.renderQuestAtLocation(this.char, activeQuest, loc);
      return;
    }
    // Fallback: check loc.questMajor for completed/locked state display
    const questId = loc.questMajor ? `M${loc.questMajor}` : null;
    if (!questId) { addLog('log-local', 'Nessuna quest principale in questo luogo.', '#888'); return; }
    const stato = (this.char.questMajorStato || {})[questId];
    if (stato === 'completata') {
      addLog('log-local', `✓ Quest principale di questo luogo già completata.`, '#7f7');
    } else {
      addLog('log-local', `■ Quest bloccata — completa prima le missioni precedenti.`, '#888');
    }
  },

  // Triggered when player chooses how to tackle the active quest
  iniziaQuestMajor(questId, choice) {
    if (!this.char) return;
    const dlg = document.getElementById('dialog-box');
    if (dlg) dlg.style.display = 'none';

    // Quests that trigger boss combat
    const QM_BOSSES = {
      M1:  { nome:'Spettro di Acheron',         hp:44,  att:6,  dan:9,  tier:'Boss', rd:1,  baseRes:{MAG:8,VEL:10},          elemAttack:{type:'MAG',val:3} },
      M3:  { nome:'Serpente delle Paludi',       hp:56,  att:8,  dan:10, tier:'Boss', rd:3,  baseRes:{ACI:8,VEL:8},           elemAttack:{type:'ACI',val:4} },
      M4:  { nome:'Golem di Magma',              hp:69,  att:9,  dan:11, tier:'Boss', rd:4,  baseRes:{FUO:10,FRE:-5},         elemAttack:{type:'FUO',val:5} },
      M4_Djinn: { nome:'Djinn della Tempesta',  hp:63,  att:9,  dan:10, tier:'Boss', rd:3,  baseRes:{FUL:12,FRE:3},          elemAttack:{type:'FUL',val:4} },
      M5:  { nome:'Golem di Ghiaccio',           hp:69,  att:9,  dan:11, tier:'Boss', rd:4,  baseRes:{FRE:8,FUO:-4},          elemAttack:{type:'FRE',val:4} },
      M6:  { nome:'Troll Reale di Ymir',         hp:88,  att:11, dan:14, tier:'Boss', rd:5,  baseRes:{FRE:12,FUO:-7,VEL:8},  elemAttack:{type:'FRE',val:6} },
      M7:  { nome:'Assassino di Shadizar',        hp:56,  att:9,  dan:10, tier:'Boss', rd:3,  baseRes:{VEL:8},                 elemAttack:{type:'VEL',val:4} },
      M8:  { nome:'Re Spettrale di Khorshemish', hp:75,  att:10, dan:13, tier:'Boss', rd:3,  baseRes:{MAG:6,VEL:6},           elemAttack:{type:'MAG',val:5} },
      M9:  { nome:'Mistico Corrotto',            hp:81,  att:11, dan:14, tier:'Boss', rd:4,  baseRes:{MAG:4},                 elemAttack:{type:'MAG',val:5} },
      M10: { nome:'Golem di Magma Primordiale',  hp:94,  att:13, dan:16, tier:'Boss', rd:6,  baseRes:{FUO:10,FRE:-5},         elemAttack:{type:'FUO',val:6} },
      M12: { nome:'Re Valthor il Gelido',        hp:113, att:15, dan:19, tier:'Boss', rd:8,  baseRes:{FRE:20,FUO:-10,MAG:8,VEL:10}, elemAttack:{type:'FRE',val:9} }
    };

    // M9 C1 (Perdona): no combat — grant ally and complete
    if (questId === 'M9' && choice === 1) {
      addLog('log-local', '🤝 Perdoni il Mistico. Rivela la via segreta sulla Montagna. Alleato guadagnato.', '#88ccff');
      addLog('log-local', '⚔ ALLEANZA: Mistico ora combatte al tuo fianco nel finale!', '#88ccff');
      this.completeQuest(questId, choice);
      return;
    }
    // M10 C2 (Aspetta): no combat — quest stays active
    if (questId === 'M10' && choice === 2) {
      addLog('log-local', '🔥 Aspetti. La Forgia brucia ancora. Torna quando sei pronto.', '#888');
      return;
    }

    const bossKey = (questId === 'M4' && choice === 2) ? 'M4_Djinn' : questId;
    const boss = QM_BOSSES[bossKey];
    if (boss) {
      // Choice modifiers
      boss._originalHp = boss.hp;  // store for HP bar display

      if (choice === 1 && questId === 'M1') {
        boss.hp -= 10; // Combatti con onore: ATT bonus handled via player ini
        addLog('log-local', '⚔ Sfidi lo Spettro di petto! +1 DEST se vinci.', '#ffd700');
      }
      if (choice === 1 && questId === 'M3') {
        boss.hp = Math.floor(boss.hp * 0.8); // Strega weakens the Serpent with magic
        addLog('log-local', '🐍 La Strega lancia un incantesimo: il Serpente e\' indebolito! HP -20%.', '#88ccff');
        addLog('log-local', '⚔ ALLEANZA STREGA: se vinci, la Strega sara\' tua alleata!', '#88ccff');
      }
      if (choice === 2 && questId === 'M3') {
        addLog('log-local', '⚔ Rifiuti la Strega. Combatti il Serpente da solo!', '#ffd700');
      }
      if (choice === 1 && questId === 'M5') {
        addLog('log-local', '❄ Alleanza Elara: lei ti protegge con scudi di ghiaccio. DEF +2 in battaglia.', '#88ccff');
      }
      if (choice === 2 && questId === 'M5') {
        addLog('log-local', '⚔ Rifiuti l\'alleanza. Entri nelle miniere da solo. Il Golem si sveglia!', '#ffd700');
      }
      if (choice === 1 && questId === 'M6') {
        boss.hp = Math.floor(boss.hp * 0.75); // Troll parley weakens him
        addLog('log-local', '🪓 Il Troll annuisce: "Dimostra che sei degno." Duello rituale — si batte meno feroce! HP -25%.', '#aaffaa');
        addLog('log-local', '⚔ ALLEANZA TROLL: se vinci, i Troll marciano con te!', '#aaffaa');
      }
      if (choice === 2 && questId === 'M6') {
        addLog('log-local', '⚔ Rifiuti il patto! Il Re dei Troll ruggisce: "ALLORA MUORI!" Si scatena feroce!', '#cc4444');
      }
      if (choice === 1 && questId === 'M7') {
        addLog('log-local', '⚔ Il Mercante chiama la sua guardia! Un assassino hyrkaniano salta dall\'ombra!', '#cc4444');
      }
      if (choice === 1 && questId === 'M8') {
        boss.hp = Math.floor(boss.hp * 0.8);
        addLog('log-local', '💃 Danzi con gli Spettri. Il Re Spettrale è disorientato! HP -20%.', '#aa88ff');
      }
      if (choice === 2 && questId === 'M8') {
        addLog('log-local', '⚔ Rifiuti la danza. Il Re Spettrale attacca con piena furia!', '#cc4444');
      }
      if (choice === 2 && questId === 'M9') {
        addLog('log-local', '⚔ Uccidi il Mistico corrotto. Paghi 2 Destino per questo sangue.', '#cc4444');
        this.char.destino = Math.max(0, (this.char.destino || 0) - 2);
        updateGlobalHUD(this.char);
      }
      if (choice === 1 && questId === 'M10') {
        addLog('log-local', '🔥 Ti avvicini alla Forgia! Il Golem Primordiale si sveglia a guardia!', '#cc4444');
      }
      if (choice === 1 && questId === 'M12') {
        addLog('log-local', '❄ Sconfiggi Re Valthor — poi distruggerai la Corona di Ymir. Prima, combatti!', '#88ccff');
      }
      if (choice === 2 && questId === 'M12') {
        addLog('log-local', '❄ Sconfiggi Re Valthor — poi indosserai la Corona. Prima, combatti!', '#ffd700');
      }
      if (choice === 2 && questId === 'M1') {
        // DES trick: 33% success chance
        const trickSuccess = this.rng() < 0.33;
        if (trickSuccess) {
          boss.hp = Math.floor(boss.hp * 0.45);
          boss.att -= 2;
          boss.dan = Math.max(1, boss.dan - 2);
          boss._desTrickMsg = `🎭 TRUCCO RIUSCITO! — Imboscata! Spettro indebolito: HP -55%, ATT -2, DAN -2.`;
          addLog('log-local', boss._desTrickMsg, '#aaffaa');
        } else {
          boss._desTrickMsg = `🎭 Trucco fallito. Lo Spettro ti ha visto arrivare!`;
          addLog('log-local', boss._desTrickMsg, '#cc4444');
        }
      }
      addLog('log-local', `⚔ BOSS: ${boss.nome} appare!`, '#cc4444');
      this._pendingQuestId = questId;
      this._pendingQuestChoice = choice;
      this._pendingBossTrickMsg = boss._desTrickMsg || null;
      this._startQuestBossCombat(boss);
      // Apply post-init combat bonuses
      if (questId === 'M5' && choice === 1 && this.combatState) {
        this.combatState.player.def += 2;
        this.combatState.log.push('❄ Elara: +2 DEF per tutta la battaglia.');
      }
    } else {
      // Dialog quests (M2, M7, M8, M11) — complete with narrative, no NPC re-open
      const _dlgBox = document.getElementById('dialog-box');
      if (_dlgBox) _dlgBox.style.display = 'none';
      const _dq = (this.data.quests.major || []).find(q => q.id === questId);
      const _ris = choice === 1 ? (_dq && (_dq.choice1Ris || _dq.choiceRis1)) : (_dq && (_dq.choice2Ris || _dq.choiceRis2));
      if (_ris) addLog('log-local', `► ${_ris}`, '#ffd700');
      setTimeout(() => this.completeQuest(questId, choice), 800);
    }
  },

  _startQuestBossCombat(boss) {
    const bInitPlayer = (this.char.derived.ini || 0) >= boss.att;
    this.combatState = {
      active: true, turn: 1,
      isBoss: true,
      questId: this._pendingQuestId,
      questChoice: this._pendingQuestChoice,
      initiativePlayer: bInitPlayer,
      enemy: {
        id: boss.nome, nome: boss.nome, tier: boss.tier, tipo: 'Boss',
        hp: boss.hp, maxHp: boss._originalHp || boss.hp,
        att: boss.att, dan: boss.dan, def: 1, rd: boss.rd || 2,
        baseRes: boss.baseRes || {},
        elemAttack: boss.elemAttack || null,
        skills: [], lore: ''
      },
      player: {
        hp: this.char.derived.hp, maxHp: this.char.derived.maxHp,
        att: this.char.derived.att + ((this.char.sessionBuffs||{}).att||0),
        dan: this.char.derived.dan + ((this.char.sessionBuffs||{}).dan||0),
        def: this.char.derived.def + ((this.char.sessionBuffs||{}).def||0),
        rd: this.char.derived.rd,
        ini: this.char.derived.ini + ((this.char.sessionBuffs||{}).ini||0),
        defending: !bInitPlayer, specialUsed: false
      },
      log: [], result: null, loot: []
    };
    this.combatState.log.push(`⚔ BOSS: ${boss.nome} [${boss.tier}]`);
    if (boss.elemAttack) this.combatState.log.push(`⚡ Attacchi elementali: ${boss.elemAttack.type} (${boss.elemAttack.val})`);
    if (this._pendingBossTrickMsg) {
      this.combatState.log.push(this._pendingBossTrickMsg);
      this._pendingBossTrickMsg = null;
    }
    this.combatState.log.push(bInitPlayer ? '► HAI L\'INIZIATIVA!' : '► IL BOSS ATTACCA PER PRIMO! Ti prepari a difendere. (DEF+3)');

    const _rb2 = document.getElementById('comb-result-box');
    if (_rb2) { _rb2.style.display = 'none'; _rb2.innerHTML = ''; }
    const _ab2 = document.getElementById('comb-action-btns');
    if (_ab2) _ab2.style.display = '';

    Screens.renderCombat({ combatState: this.combatState, character: this.char });
    showScreen('screen-combat');
    if (!bInitPlayer) setTimeout(() => this._enemyTurn(), 600);
  },

  acceptQuest(questId) {
    if (!this.char) return;
    this.char.questMajorStato[questId] = 'attiva';
    this.char.activeQuest = questId;
    addLog('log-local', `QUEST ACCETTATA: ${questId}`, '#ffd700');
    this.showLocation();
  },

  completeQuest(questId, choice) {
    if (!this.char || !this.data) return;
    const quest = this.data.quests.major.find(q => q.id === questId);
    if (!quest) return;

    this.char.questMajorStato[questId] = 'completata';
    const fragNum = parseInt(questId.replace('M',''));
    if (!this.char.frammenti.includes(fragNum)) this.char.frammenti.push(fragNum);

    // Sblocca nuove location
    if (quest.sblocca) {
      quest.sblocca.forEach(locName => {
        const locIdx = this.data.locations.findIndex(l => l.n === locName || l.n.includes(locName));
        if (locIdx >= 0 && !this.char.unlockedLocations.includes(locIdx)) {
          this.char.unlockedLocations.push(locIdx);
        }
      });
    }

    // Attiva prossima quest
    const nextQId = `M${fragNum + 1}`;
    if (!this.char.questMajorStato[nextQId]) {
      this.char.questMajorStato[nextQId] = 'attiva';
      this.char.activeQuest = nextQId;
    }

    // Record alliance based on quest choice
    const ALLIANCE_MAP = {
      M3: { 1: 'Strega delle Paludi' },
      M5: { 1: 'Principessa Elara' },
      M6: { 1: 'Re dei Troll' },
      M9: { 1: 'Mistico' }
    };
    const allianceGain = (ALLIANCE_MAP[questId] || {})[choice];
    if (allianceGain && !this.char.alleanze.includes(allianceGain)) {
      this.char.alleanze.push(allianceGain);
      addLog('log-local', `⚔ ALLEANZA: ${allianceGain} ora combatte al tuo fianco!`, '#88ccff');
    }

    addLog('log-local', `✓ QUEST COMPLETATA: ${quest.nome}!`, '#ffd700');
    addLog('log-local', `► RICOMPENSA: ${quest.ricompensa}`, '#7f7');

    // Quest-specific narrative logs
    if (questId === 'M7') {
      addLog('log-local', `💀 L'Assassino di Shadizar giace a terra. Il Mercante dell'Ombra è neutralizzato.`, '#cc4444');
      addLog('log-local', `❄ FRAMMENTO 7 DI YMIR recuperato dall'altare segreto del palazzo!`, '#88ccff');
      addLog('log-local', `🗺 KHORSHEMISH sbloccata. La pista di Valthor porta a est.`, '#ffd700');
    }
    if (questId === 'M8') {
      addLog('log-local', `👻 Il Re Spettrale si dissolve. La sua polvere spettrale cade sulle pietre di Khorshemish.`, '#aa88ff');
      addLog('log-local', `❄ FRAMMENTO 8 DI YMIR estratto dalla cripta sigillata!`, '#88ccff');
      addLog('log-local', `🗺 Gurth sbloccata. Il tradimento del Mistico aspetta.`, '#ffd700');
    }

    // Special item rewards
    if (questId === 'M10') {
      const martello = (this.data.enemies.weapons || []).find(w => w.id === 'w_martello_dest');
      if (martello && !this.char.inventory.find(i => i.id === 'w_martello_dest')) {
        const item = Object.assign({}, martello, {
          nome: martello.nome || martello.n || 'Martello del Destino',
          instanceId: `w_martello_dest_${Date.now()}`,
          slot: 'Arma', tipo: 'arma', rar: 'leggendario', lore: 'Il Martello forgiato per distruggere Re Valthor.'
        });
        this.char.inventory.push(item);
        addLog('log-local', `🔨 MARTELLO DEL DESTINO aggiunto all'inventario!`, '#ffd700');
      }
    }

    // Close any open dialog before navigating
    const _dlg = document.getElementById('dialog-box');
    if (_dlg) _dlg.style.display = 'none';

    // Check finale (tutti 12 frammenti)
    if (this.char.frammenti.length >= 12) {
      this._triggerEnding();
    }
    this.showLocation();
  },

  // ── NPC DIALOGO ───────────────────────────
  openNPCDialog(npcId) {
    if (!this.char || !this.data) return;
    const loc = this.data.locations[this.char.currentLocation];

    // Accept specific npcId or fall back to first NPC at location
    const id = npcId || (loc && loc.npcs && loc.npcs[0]);
    if (!id) { addLog('log-local', 'NESSUN NPC IN QUESTA LOCATION.', '#888'); return; }

    const npcData = this.data.npcs[id];
    if (!npcData) {
      // Boss / enemy posing as NPC — redirect to quest system
      addLog('log-local', `⚠ ${id} non risponde. Cerca la tua missione!`, '#cc8800');
      this.checkQuestsAtLocation();
      return;
    }

    const dialogKey = this._getDialogKey(id);
    const text = (npcData.dialoghi || {})[dialogKey] || (npcData.dialoghi || {}).intro || '...';

    Screens.renderDialog(npcData, text, this._getDialogChoices(id, npcData));
  },

  _locAction(type) {
    if (!this.char) return;
    if (type === 'riposo') {
      this.char.durata = (this.char.durata || 0) + 0.5;
      // Heal FIRST — rest always recovers some HP
      const heal = Math.floor(Math.random() * 8) + 8;
      const before = this.char.derived.hp;
      this.char.derived.hp = Math.min(this.char.derived.maxHp, before + heal);
      const gained = this.char.derived.hp - before;
      addLog('log-local', `🔥 RIPOSO (½ giorno): +${gained} HP. Durata: ${this.char.durata}g.`, '#7f7');
      if (this.char.derived.hp >= this.char.derived.maxHp) addLog('log-local', '💪 FORMA FISICA OTTIMALE!', '#ffd700');
      // Then poison tick (may reduce HP below recovery)
      if (!this._poisonTick('log-local')) return; // dead from poison
      updateGlobalHUD(this.char);
    }
  },

  _getDialogKey(npcId) {
    const questProg = Object.keys(this.char.questMajorStato).filter(k => this.char.questMajorStato[k] === 'completata').length;
    if (npcId === 'Mistico') {
      if (questProg >= 1 && this.char.questMajorStato['M2'] !== 'completata') return 'dopoM1';
      if (questProg >= 8) return 'avvertimento_tradimento';
      return 'intro';
    }
    return 'intro';
  },

  _getDialogChoices(npcId, npcData) {
    const locIdx = this.char.currentLocation;
    // Find active major quest at this location (covers M9/M10 sharing locs with M2/M4)
    const activeQuest = (this.data.quests.major || []).find(q =>
      q.locationIdx === locIdx && (this.char.questMajorStato || {})[q.id] === 'attiva'
    );
    const questId = activeQuest ? activeQuest.id : null;

    const choices = [{ id: 'close', text: '⏳ TORNA DOPO — rimanda la missione' }];
    if (activeQuest) {
      choices.unshift({ id: 'quest_start', text: `⚔ AFFRONTA LA MISSIONE: ${activeQuest.nome}` });
    }
    return choices;
  },

  makeDialogChoice(npcId, choiceId) {
    if (choiceId === 'close') {
      document.getElementById('dialog-box').style.display = 'none';
      addLog('log-local', '⏳ Missione in sospeso — torna quando sei pronto.', '#888');
      return;
    }
    if (choiceId === 'quest_start') {
      // Close NPC dialog and open quest choice screen
      document.getElementById('dialog-box').style.display = 'none';
      this.checkQuestsAtLocation();
      return;
    }
    if (choiceId.startsWith('quest_')) {
      const parts = choiceId.split('_');
      const questId = parts[1];
      const choice = parseInt(parts[2]);
      document.getElementById('dialog-box').style.display = 'none';
      this.iniziaQuestMajor(questId, choice);
    }
  },

  // ── EQUIPAGGIAMENTO ───────────────────────
  _is2H(item) {
    if (!item) return false;
    if (item.slot === 'Arma2M') return true;
    const n = (item.nome || '').toLowerCase();
    return n.includes('arco') || n.includes('balestra') || n.includes('due mani') ||
           n.includes('a due') || n.includes('ascia da guerra') || n.includes('2m') || n.includes('2 m');
  },

  equipFromInventory(instanceId) {
    if (!this.char) return;
    const itemIdx = this.char.inventory.findIndex(i => i.instanceId === instanceId);
    if (itemIdx < 0) return;
    const item = this.char.inventory[itemIdx];
    const slot = this._guessSlot(item);
    if (!slot) { addLog('log-local', 'Slot non determinabile.', '#f77'); return; }

    const eq = this.char.equipment;

    // Helper: send equipped item to inventory with optional log
    const _toInv = (eqItem, reason) => {
      if (!eqItem) return;
      this.char.inventory.push(eqItem);
      if (reason) addLog('log-local', `⚠ ${eqItem.nome} → inventario (${reason}).`, '#ffaa00');
    };

    if (slot === 'arma') {
      // ── ARMA (1M or 2H in single slot) ───────────────────────────────
      if (this._is2H(item)) {
        _toInv(eq.scudo, '2M incompatibile con scudo');
        eq.scudo = null;
      }
      _toInv(eq.arma, null);
      eq.arma = item;

    } else if (slot === 'scudo') {
      // ── SCUDO ─────────────────────────────────────────────────────────
      if (this._is2H(eq.arma)) {
        _toInv(eq.arma, '2M incompatibile con scudo');
        eq.arma = null;
      }
      _toInv(eq.scudo, null);
      eq.scudo = item;

    } else {
      // ── ALL OTHER SLOTS ───────────────────────────────────────────────
      _toInv(eq[slot], null);
      eq[slot] = item;
    }

    this.char.inventory.splice(itemIdx, 1);
    this._recalcStats();
    addLog('log-local', `✓ EQUIPAGGIATO: ${item.nome}`, '#7f7');
    Screens._renderSidebarInventory(this.char);
    updateGlobalHUD(this.char);
    const cs = document.getElementById('screen-character');
    if (cs && cs.classList.contains('active')) {
      Screens.renderCharSheet(this._state());
    }
  },

  _guessSlot(item) {
    const slotMap = {
      'Arma': 'arma', 'arma': 'arma', 'Arma1M': 'arma', 'Arma2M': 'arma', 'Arco': 'arma',
      'Torso': 'armatura', 'torso': 'armatura',
      'Testa': 'elmo', 'testa': 'elmo',
      'Scudo': 'scudo', 'scudo': 'scudo',
      'Collo': 'amuleto', 'collo': 'amuleto',
      'Dita': 'anello', 'AnelloDX': 'anello',
      'Bracciali': 'bracciali', 'bracciali': 'bracciali', 'Mani': 'bracciali',
      'Stivali': 'stivali', 'stivali': 'stivali', 'Piedi': 'stivali',
      'Cintura': 'cintura', 'cintura': 'cintura', 'Vita': 'cintura',
      'armatura': 'armatura', 'elmo': 'elmo', 'amuleto': 'amuleto', 'anello': 'anello'
    };
    return slotMap[item.slot] || this._guessSlotFromName(item.nome || '') || null;
  },

  _guessSlotFromName(nome) {
    const n = nome.toLowerCase();
    if (n.includes('arco') || n.includes('balestra')) return 'arma'; // bow = arma (2H logic via flag)
    if (n.includes('spada') || n.includes('ascia') || n.includes('daga') || n.includes('pugnale') ||
        n.includes('stiletto') || n.includes('lancia') || n.includes('bastone') || n.includes('martello') ||
        n.includes('zanna arg')) return 'arma';
    if (n.includes('scudo')) return 'scudo';
    if (n.includes('cotta') || n.includes('piastre') || n.includes('armatura') || n.includes('mantello') || n.includes('tunica')) return 'armatura';
    if (n.includes('elmo') || n.includes('casco')) return 'elmo';
    if (n.includes('anello') || n.includes('gemma')) return 'anello';
    if (n.includes('amuleto') || n.includes('collana') || n.includes('essenza')) return 'amuleto';
    if (n.includes('stivali')) return 'stivali';
    if (n.includes('bracciali') || n.includes('guanti')) return 'bracciali';
    if (n.includes('cintura')) return 'cintura';
    return null;
  },

  handleInventoryAction(instanceId) {
    if (!this.char) return;
    if (typeof GameTooltip !== 'undefined') GameTooltip.hide();
    const item = this.char.inventory.find(i => i.instanceId === instanceId);
    if (!item) return;

    if (item.tipo === 'consumabile' || item.tipo === 'consumabile_quest' || item.tipo === 'pozione') {
      this._useConsumable(item, instanceId);
      return;
    }

    const slot = this._guessSlot(item);
    if (!slot) {
      addLog('log-local', `${item.nome}: oggetto non equipaggiabile (materiale/loot).`, '#888');
      return;
    }

    // Auto-equip: old item in slot goes to inventory automatically
    this.equipFromInventory(instanceId);
  },

  _useConsumable(item, instanceId) {
    const eff = item.effetto || {};
    const logBox = (this.combatState && this.combatState.active) ? 'combat-log' : 'log-local';

    // In-combat check for maga potions
    if (item.usableInCombat === false && this.combatState && this.combatState.active) {
      addLog('log-local', `⚠ ${item.nome} non usabile in combattimento!`, '#f77');
      return;
    }

    // Antidote — cure poison DoT
    if (eff.curePoison) {
      const wasPoisoned = (this.char.poisonDmgPerDay || 0) > 0;
      this.char.poisonDmgPerDay = 0;
      addLog(logBox, wasPoisoned ? `🧪 ${item.nome}: VELENO CURATO! Il malessere svanisce.` : `🧪 ${item.nome}: non eri avvelenato.`, '#aaff33');
      updateGlobalHUD(this.char);
    }
    // Healing
    if (eff.hp) {
      const heal = eff.hp;
      if (this.combatState && this.combatState.active) {
        this.combatState.player.hp = Math.min(this.combatState.player.maxHp, this.combatState.player.hp + heal);
        this.char.derived.hp = this.combatState.player.hp;
        this.combatState.log.push(`🧪 ${item.nome}: +${heal} HP! HP: ${this.combatState.player.hp}/${this.combatState.player.maxHp}`);
        Screens.updateCombat({ combatState: this.combatState, character: this.char });
      } else {
        this.char.derived.hp = Math.min(this.char.derived.maxHp, this.char.derived.hp + heal);
        addLog('log-local', `🧪 ${item.nome}: +${heal} HP. HP: ${this.char.derived.hp}/${this.char.derived.maxHp}`, '#7f7');
      }
    }

    // Resistance bonus — persists through recalc via potionResistances
    if (eff.res) {
      if (!this.char.potionResistances) this.char.potionResistances = {};
      const resParts = [];
      for (const [k, v] of Object.entries(eff.res)) {
        this.char.potionResistances[k] = (this.char.potionResistances[k] || 0) + v;
        resParts.push(`+${v} Rid.${k.toUpperCase()}`);
      }
      if (resParts.length) {
        const resMsg = `🛡 ${item.nome}: ${resParts.join(', ')} — solo questo combattimento!`;
        addLog(logBox, resMsg, '#88ccff');
        if (this.combatState && this.combatState.active) {
          this.combatState.log.push(resMsg);
          Screens.updateCombat({ combatState: this.combatState, character: this.char });
        }
      }
      this._recalcStats();
    }

    // Temp combat buff — applies to active combat; potions with durata apply to next combat via scrollBonuses
    if (eff.comb && (eff.temp || item.tipo === 'pozione')) {
      if (this.combatState && this.combatState.active) {
        const p = this.combatState.player;
        const parts = [];
        if (eff.comb.att) { p.att = (p.att || 0) + eff.comb.att; parts.push(`+${eff.comb.att} ATT`); }
        if (eff.comb.dan) { p.dan = (p.dan || 0) + eff.comb.dan; parts.push(`+${eff.comb.dan} DAN`); }
        if (eff.comb.def) { p.def = (p.def || 0) + eff.comb.def; parts.push(`+${eff.comb.def} DEF`); }
        if (eff.comb.ini) { p.ini = (p.ini || 0) + eff.comb.ini; parts.push(`+${eff.comb.ini} INI`); }
        if (parts.length) {
          this.combatState.log.push(`🧪 ${item.nome}: ${parts.join(', ')} questo combattimento!`);
          Screens.updateCombat({ combatState: this.combatState, character: this.char });
        }
      } else {
        // Out of combat: store as session buff (lasts until next save/load or manually reset)
        if (!this.char.sessionBuffs) this.char.sessionBuffs = {};
        const sb = this.char.sessionBuffs;
        const parts = [];
        if (eff.comb.att) { sb.att = (sb.att || 0) + eff.comb.att; parts.push(`+${eff.comb.att} ATT`); }
        if (eff.comb.dan) { sb.dan = (sb.dan || 0) + eff.comb.dan; parts.push(`+${eff.comb.dan} DAN`); }
        if (eff.comb.def) { sb.def = (sb.def || 0) + eff.comb.def; parts.push(`+${eff.comb.def} DEF`); }
        if (eff.comb.ini) { sb.ini = (sb.ini || 0) + eff.comb.ini; parts.push(`+${eff.comb.ini} INI`); }
        if (parts.length) addLog('log-local', `🧪 ${item.nome}: ${parts.join(', ')} al prossimo combattimento!`, '#88ffcc');
        this._recalcStats();
      }
    }

    // Permanent comb bonus (via scrollBonuses)
    if (eff.comb && eff.permanent) {
      if (!this.char.scrollBonuses) this.char.scrollBonuses = {};
      const sb = this.char.scrollBonuses;
      const parts = [];
      if (eff.comb.att) { sb.att = (sb.att || 0) + eff.comb.att; parts.push(`+${eff.comb.att} ATT`); }
      if (eff.comb.dan) { sb.dan = (sb.dan || 0) + eff.comb.dan; parts.push(`+${eff.comb.dan} DAN`); }
      if (eff.comb.def) { sb.def = (sb.def || 0) + eff.comb.def; parts.push(`+${eff.comb.def} DEF`); }
      if (eff.comb.rd)  { sb.rd  = (sb.rd  || 0) + eff.comb.rd;  parts.push(`+${eff.comb.rd} RD`); }
      if (eff.comb.ini) { sb.ini = (sb.ini || 0) + eff.comb.ini; parts.push(`+${eff.comb.ini} INI`); }
      this._recalcStats();
      addLog('log-local', `📜 ${item.nome}: ${parts.join(', ')} PERMANENTE!`, '#ffd700');
    }

    // Permanent attr bonus
    if (eff.attr && eff.permanent) {
      const parts = [];
      for (const [k, v] of Object.entries(eff.attr)) {
        this.char.attributes[k] = (this.char.attributes[k] || 9) + v;
        parts.push(`+${v} ${k}`);
      }
      this._recalcStats();
      addLog('log-local', `📜 ${item.nome}: ${parts.join(', ')} PERMANENTE!`, '#ffd700');
    }

    // Rimuovi dall'inventario
    const idx = this.char.inventory.findIndex(i => i.instanceId === instanceId);
    if (idx >= 0) this.char.inventory.splice(idx, 1);
    // Refresh UI
    updateGlobalHUD(this.char);
    if (document.getElementById('screen-character') && document.getElementById('screen-character').classList.contains('active')) {
      Screens.renderCharSheet(this._state());
    }
    Screens._renderSidebarInventory(this.char);
  },

  showCombatPotions() {
    if (!this.char || !this.combatState || !this.combatState.active) return;
    const potions = (this.char.inventory || []).filter(i => i.tipo === 'consumabile' && i.usableInCombat === true);
    const menu = document.getElementById('comb-skill-menu');
    if (!menu) return;
    if (menu.style.display !== 'none' && menu.dataset.mode === 'potions') {
      menu.style.display = 'none';
      return;
    }
    menu.dataset.mode = 'potions';
    if (!potions.length) {
      menu.innerHTML = '<div style="color:#888;font-size:11px;padding:4px;">Nessuna pozione disponibile.</div>';
    } else {
      menu.innerHTML = potions.map(p => {
        const iid = (p.instanceId || '').replace(/"/g, '&quot;');
        return `<button class="btn-action" style="font-size:10px;margin:2px 0;" data-iid="${iid}" onclick="Game._usePotionInCombat(this.dataset.iid)">🧪 ${p.nome} — ${p.desc || ''}</button>`;
      }).join('');
    }
    menu.style.display = 'block';
  },

  _usePotionInCombat(instanceId) {
    const item = (this.char.inventory || []).find(i => i.instanceId === instanceId);
    if (!item) return;
    document.getElementById('comb-skill-menu').style.display = 'none';
    this._useConsumable(item, instanceId);
  },

  // ── FINALE ────────────────────────────────
  _triggerEnding() {
    const choices = this.char._endingChoices || {};
    let ending = 'liberation';
    if (choices.M9 === 'kill') ending = 'betrayal';
    else if (choices.M9 === 'forgive' && this.char.alleanze.includes('Elara')) ending = 'king';
    this.char.ending = ending;
    this.char.gameOver = true;
    Screens.renderEnding({ character: this.char });
    showScreen('screen-finale');
  },

  // ── UTILITY ───────────────────────────────
  _hashSeed(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
    return Math.abs(hash) || 12345;
  },

  _makeRNG(seed) {
    let s = seed >>> 0;
    return function() {
      s += 0x6D2B79F5;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  },

  _makeLootItem(nome, tier) {
    const rar = tier === 'Boss' ? 'rare' : tier === 'Elite' ? 'special' : 'normal';
    const prezzo = tier === 'Boss' ? 55 : tier === 'Elite' ? 30 : 15;
    const n = nome.toLowerCase();
    let slot = this._guessSlotFromName(nome);
    let comb = {}, attr = {}, tipo = slot ? 'equipment' : 'materiale';
    if (slot === 'arma') {
      comb = { att: rar==='rare'?2:rar==='special'?1:0, dan: rar==='rare'?3:rar==='special'?2:1 };
      if (n.includes('arco') || n.includes('balestra')) comb.ini = 2;
    } else if (slot === 'armatura') {
      comb = { def: rar==='rare'?2:1, rd: rar==='rare'?3:2 };
    } else if (slot === 'scudo') {
      comb = { def: 2, rd: 1 };
    } else if (slot === 'elmo') {
      comb = { def: 1, rd: 1 };
    } else if (slot === 'anello') {
      attr = { DES: 1 };
    } else if (slot === 'amuleto') {
      attr = { RES: 1 };
    } else if (slot === 'stivali') {
      comb = { ini: 1 };
    }
    return {
      nome, rar, tipo, slot: slot ? slot : null,
      comb: Object.keys(comb).length ? comb : null,
      attr: Object.keys(attr).length ? attr : null,
      effetto: {}, prezzo,
      instanceId: `loot_${Date.now()}_${Math.floor((this.rng ? this.rng() : Math.random())*99999)}`
    };
  },

  // ── MISSIONI SECONDARIE ───────────────────
  _getMinorQuestsForLocation(loc) {
    if (!this.data || !this.data.quests || !this.data.quests.minor || !this.char) return [];
    const locName = (loc.n || '').toLowerCase();
    const locBiome = (loc.biome || '').toLowerCase();
    const locType  = (loc.t || '');
    return this.data.quests.minor.filter(q => {
      if (q.stato === 'bloccata') return false;
      // Gate quests that require a major quest to be completed first
      if (q.prereqCompleted) {
        const prereqStato = (this.char.questMajorStato || {})[q.prereqCompleted];
        if (prereqStato !== 'completata') return false;
      }
      const bioma = (q.bioma || '').toLowerCase();
      if (bioma === 'any') return locType === 'city' || locType === 'village' || locType === 'camp';
      return bioma === locName || bioma === locBiome;
    });
  },

  _getRandomQuestsForLocation(loc) {
    if (!this.char) return [];
    const locIdx = this.char.currentLocation;
    const dayHash = Math.floor(Date.now() / (1000 * 60 * 60 * 24)); // changes daily
    const seed = (locIdx * 7919 + dayHash * 6271) >>> 0;
    const rng = () => { let s = seed ^ (s || 0x9e3779b9); s = ((s ^ (s >>> 16)) * 0x45d9f3b) >>> 0; s = ((s ^ (s >>> 16)) * 0x45d9f3b) >>> 0; return (s ^ (s >>> 16)) / 0x100000000; };
    // Seeded deterministic using simple hash
    const h = (n) => { let v = (seed + n * 2654435761) >>> 0; v = ((v ^ (v >>> 16)) * 0x45d9f3b) >>> 0; return (v ^ (v >>> 16)) / 0x100000000; };

    const locType = loc.t || 'village';
    const biome = loc.biome || 'foresta';
    const locName = loc.n || 'luogo';

    const HUNT_TARGETS = ['Lupi Selvatici','Banditi','Creature Oscure','Mostri della Palude','Predatori Alpini','Spiriti Maligni','Mercenari Rinnegati','Bestie Feroci'];
    const GATHER_TARGETS = ['Erbe Rare','Risorse Preziose','Reliquie Perdute','Rune Antiche','Materiali da Costruzione'];
    const REWARDS = [
      { nome:'Pozione di Forza', tipo:'consumabile', effetto:{ comb:{ dan:2 }, temp:true }, prezzo:25 },
      { nome:'Benda Medica', tipo:'consumabile', effetto:{ hp:15 }, prezzo:10 },
      { nome:'Amuleto della Fortuna', tipo:'accessorio', effetto:{ comb:{ att:1 } }, prezzo:40 },
      { nome:'Pietra Runica', tipo:'materiale', effetto:{}, prezzo:20 },
      { nome:'Elisir di Vitalità', tipo:'consumabile', effetto:{ hp:20 }, prezzo:35 },
    ];

    const numQuests = locType === 'city' ? 2 : 1;
    const quests = [];
    for (let i = 0; i < numQuests; i++) {
      const isHunt = h(i * 3 + 1) > 0.4;
      const tgtArr = isHunt ? HUNT_TARGETS : GATHER_TARGETS;
      const tgtIdx = Math.min(Math.floor(h(i * 3 + 2) * tgtArr.length), tgtArr.length - 1);
      const tgt = tgtArr[tgtIdx] || (isHunt ? 'Bestie Feroci' : 'Erbe Rare');
      const reward = REWARDS[Math.floor(h(i * 3 + 3) * REWARDS.length)];
      const goldReward = Math.floor(h(i * 3 + 4) * 20) + 15;
      quests.push({
        id: `rnd_${locIdx}_${dayHash}_${i}`,
        nome: isHunt ? `Caccia: ${tgt}` : `Raccolta: ${tgt}`,
        tipo: isHunt ? 'caccia' : 'raccolta',
        npc: 'Bacheca Avvisi',
        intro: isHunt ? `Caccia ${tgt} nei dintorni di ${locName}. Ricompensa garantita.` : `Raccogli ${tgt} nell\'area di ${locName}. Pagamento immediato.`,
        scelta1: isHunt ? '⚔ Accetta incarico' : '🎒 Accetta incarico',
        scelta2: '« Rifiuta',
        bioma: biome,
        _isRandom: true,
        _goldReward: goldReward,
        _itemReward: reward,
        _isHunt: isHunt,
      });
    }
    return quests;
  },

  _findQuest(questId) {
    const staticQ = this.data && (this.data.quests.minor || []).find(q => q.id === questId);
    if (staticQ) return staticQ;
    if (questId.startsWith('rnd_') && this.char) {
      const loc = (this.data && this.data.locations || [])[this.char.currentLocation];
      if (loc) return (this._getRandomQuestsForLocation(loc) || []).find(q => q.id === questId) || null;
    }
    return null;
  },

  showMinorQuest(questId) {
    if (!this.char || !this.data) return;
    const _stato = (this.char.questMinorStato || {})[questId];
    if (_stato === 'completata' || _stato === 'accettata') return;
    const quest = this._findQuest(questId);
    if (!quest) return;
    const box = document.getElementById('dialog-box');
    if (!box) return;
    box.style.display = 'block';
    const speaker = document.getElementById('dialog-speaker');
    const text = document.getElementById('dialog-text');
    const choices = document.getElementById('dialog-choices');
    if (speaker) speaker.textContent = `📋 ${quest.npc}`;
    if (text) text.textContent = quest.intro;
    if (choices) choices.innerHTML = `
      <button class="dialog-choice" onclick="Game.startMinorQuest('${questId}',1)">${quest.scelta1}</button>
      <button class="dialog-choice" style="background:#1a0a00;color:#888;" onclick="Game.startMinorQuest('${questId}',2)">${quest.scelta2}</button>
      <button class="dialog-choice" style="background:#1a0a00;color:#555;" onclick="document.getElementById('dialog-box').style.display='none'">« CHIUDI</button>`;
  },

  startMinorQuest(questId, choice) {
    if (!this.char || !this.data) return;
    const _sqStato = (this.char.questMinorStato || {})[questId];
    if (_sqStato === 'completata' || _sqStato === 'accettata') return;
    const quest = this._findQuest(questId);
    if (!quest) return;
    const box = document.getElementById('dialog-box');
    if (box) box.style.display = 'none';
    if (choice === 2) {
      addLog('log-local', quest.ris2 || 'Rifiuti l\'incarico.', '#888');
      return;
    }
    if (!this.char.questMinorStato) this.char.questMinorStato = {};
    this.char.questMinorStato[questId] = 'accettata';
    if (quest._isRandom) {
      this._pendingRandomQuest = questId;
      if (quest._isHunt) {
        // Hunt quest: combat — pick an enemy matching the biome or fallback
        const enemyList = Array.isArray(this.data.enemies) ? this.data.enemies : ((this.data.enemies && this.data.enemies.enemies) || []);
        if (!enemyList.length) {
          addLog('log-local', `⚠ Nessun nemico trovato per questa caccia.`, '#f77');
          return;
        }
        // Try to pick an enemy matching biome, excluding questLink bosses
        const biome = (quest.bioma || '').toLowerCase();
        const huntPool = enemyList.filter(e => !e.questLink);
        const matchedEnemy = huntPool.find(e => (e.biome || []).includes(biome))
          || huntPool[Math.floor(this.rng() * huntPool.length)]
          || enemyList[0];
        quest._forcedEnemyId = matchedEnemy.id;
        this._startMinorQuestCombat(quest);
      } else {
        // Gather quest: instant resolve (no combat)
        this.char.questMinorStato[questId] = 'completata';
        const gold = quest._goldReward || 15;
        this.char.gold = (this.char.gold || 0) + gold;
        let itemGained = null;
        if (quest._itemReward) {
          const item = Object.assign({}, quest._itemReward, { instanceId: `rnd_item_${Date.now()}` });
          if ((this.char.inventory || []).length < 10) {
            this.char.inventory = this.char.inventory || [];
            this.char.inventory.push(item);
            itemGained = item.nome;
          }
        }
        updateGlobalHUD(this.char);
        this.showLocation();
        // Log AFTER showLocation so they appear in the fresh log
        addLog('log-local', `✓ INCARICO COMPLETATO: ${quest.nome}!`, '#ffd700');
        addLog('log-local', `💰 +${gold} ZEC guadagnati`, '#ffd700');
        if (itemGained) addLog('log-local', `📦 TROVATO: ${itemGained}!`, '#7f7');
      }
    } else {
      this._startMinorQuestCombat(quest);
    }
  },

  _startMinorQuestCombat(quest) {
    const enemyList = Array.isArray(this.data.enemies) ? this.data.enemies : ((this.data.enemies && this.data.enemies.enemies) || []);
    const lookupId = quest._forcedEnemyId || quest.enemyId;
    const base = (lookupId ? enemyList.find(e => e.id === lookupId) : null) || enemyList[0];
    if (!base) { addLog('log-local', `⚠ Nemico non trovato!`, '#f77'); return; }
    const enemy = JSON.parse(JSON.stringify(base));
    // Minor quest enemies scaled to ~65% — challenging but beatable
    const eATT = Math.max(1, Math.floor(enemy.attr.DES / 6));
    const eDAN = Math.max(1, Math.floor(enemy.attr.FOR / 5));
    const eDEF = Math.max(1, Math.floor(enemy.attr.DES / 6));
    const eRD  = Math.max(0, Math.floor((enemy.armor && enemy.armor.rd || 0) * 0.5));
    const eHP  = Math.floor(enemy.attr.COS * 1.1);
    // Derive elemental attack — minor quest enemies use lower elem val
    const mElemVal = base.fixedElem ? Math.max(1, Math.floor(enemy.attr.INT / 4) + 1) : 0;
    const mElemAttack = (base.fixedElem && mElemVal > 0) ? { type: base.fixedElem, val: mElemVal } : null;
    const mInitPlayer = (this.char.derived.ini || 0) >= eATT;
    this.combatState = {
      active: true, turn: 1, isBoss: false,
      minorQuestId: quest.id,
      initiativePlayer: mInitPlayer,
      enemy: { id: base.id, nome: base.n, tier: 'Boss', tipo: base.t, hp: eHP, maxHp: eHP, att: eATT, dan: eDAN, def: eDEF, rd: eRD, baseRes: base.baseRes || {}, skills: base.skills || [], lore: base.lore || '', elemAttack: mElemAttack },
      player: { hp: this.char.derived.hp, maxHp: this.char.derived.maxHp, att: this.char.derived.att + ((this.char.sessionBuffs||{}).att||0), dan: this.char.derived.dan + ((this.char.sessionBuffs||{}).dan||0), def: this.char.derived.def + ((this.char.sessionBuffs||{}).def||0), rd: this.char.derived.rd, ini: this.char.derived.ini + ((this.char.sessionBuffs||{}).ini||0), defending: !mInitPlayer },
      log: [], result: null, loot: [], rawLoot: base.loot || []
    };
    this.combatState.log.push(`⚔ MISSIONE: ${quest.nome}`);
    this.combatState.log.push(`► Boss: ${base.n}`);
    if (mElemAttack) this.combatState.log.push(`⚡ Attacchi elementali: ${mElemAttack.type} (${mElemAttack.val})`);
    this.combatState.log.push(mInitPlayer ? '► HAI L\'INIZIATIVA!' : '► IL NEMICO ATTACCA PER PRIMO! Ti prepari a difendere. (DEF+3)');
    const _rb = document.getElementById('comb-result-box');
    if (_rb) { _rb.style.display = 'none'; _rb.innerHTML = ''; }
    const _ab = document.getElementById('comb-action-btns');
    if (_ab) _ab.style.display = '';
    Screens.renderCombat({ combatState: this.combatState, character: this.char });
    showScreen('screen-combat');
    if (!this.combatState.initiativePlayer) setTimeout(() => this._enemyTurn(), 600);
  },

  _completeMinorQuest(questId) {
    if (!this.char || !this.data) return;
    const quest = this._findQuest(questId);
    if (!quest) return;
    // Route logs: if _pendingQuestLogs buffer is active, push there (flushed after showLocation)
    const _log = (msg, col) => {
      if (Array.isArray(this._pendingQuestLogs)) this._pendingQuestLogs.push([msg, col]);
      else addLog('log-local', msg, col);
    };
    // Handle random quest completion
    if (quest._isRandom) {
      if (!this.char.questMinorStato) this.char.questMinorStato = {};
      this.char.questMinorStato[questId] = 'completata';
      const gold = quest._goldReward || 15;
      this.char.gold = (this.char.gold || 0) + gold;
      if (quest._itemReward && (this.char.inventory || []).length < 10) {
        this.char.inventory = this.char.inventory || [];
        this.char.inventory.push(Object.assign({}, quest._itemReward, { instanceId: `rnd_item_${Date.now()}` }));
        _log(`📦 TROVATO: ${quest._itemReward.nome}!`, '#7f7');
      }
      _log(`✓ INCARICO COMPLETATO: ${quest.nome}!`, '#ffd700');
      _log(`💰 +${gold} ZEC`, '#ffd700');
      updateGlobalHUD(this.char);
      return;
    }
    if (!this.char.questMinorStato) this.char.questMinorStato = {};
    this.char.questMinorStato[questId] = 'completata';
    const gold = quest.rewardGold1 || 0;
    const fate = 0; // destino earned via travel events only
    if (gold > 0) this.char.gold = (this.char.gold || 0) + gold;

    const bonusLines = [];

    // Stat bonuses (permanent attributes)
    if (quest.rewardAttr1) {
      for (const [k, v] of Object.entries(quest.rewardAttr1)) {
        if (this.char.attributes && this.char.attributes.hasOwnProperty(k)) {
          this.char.attributes[k] = Math.min(18, this.char.attributes[k] + v);
          bonusLines.push(`+${v} ${k}`);
          _log(`⬆ +${v} ${k} PERMANENTE`, '#88ccff');
        }
      }
      this._recalcStats();
    }
    // Max HP bonus (permanent) — stored in permHpBonus so _recalcStats stacks correctly (Bug #6)
    if (quest.rewardHp1) {
      const bonus = quest.rewardHp1;
      this.char.permHpBonus = (this.char.permHpBonus || 0) + bonus;
      this._recalcStats();
      this.char.derived.hp = Math.min(this.char.derived.maxHp, (this.char.derived.hp || 10) + bonus);
      bonusLines.push(`+${bonus} HP MAX`);
      _log(`⬆ +${bonus} HP MAX PERMANENTE`, '#88ccff');
    }

    _log(`✓ MISSIONE COMPLETATA: ${quest.nome}!`, '#ffd700');
    _log(quest.chiusura1 || quest.ris1 || '', '#7f7');
    if (gold > 0) _log(`💰 +${gold} ZEC`, '#ffd700');
    if (fate > 0) _log(`⭐ +${fate} DESTINO`, '#88ccff');

    updateGlobalHUD(this.char);

    // Floating bonus popup for permanent gains — hard to miss
    if (bonusLines.length > 0 || gold > 0 || fate > 0) {
      this._showBonusPopup(quest.nome, bonusLines, gold, fate);
    }
  },

  _showBonusPopup(questNome, bonusLines, gold, fate) {
    const existing = document.getElementById('bonus-popup');
    if (existing) existing.remove();
    const popup = document.createElement('div');
    popup.id = 'bonus-popup';
    popup.style.cssText = [
      'position:fixed','top:50%','left:50%',
      'transform:translate(-50%,-50%)',
      'background:#0a1a00','border:2px solid #ffd700',
      'color:#ffd700','font-family:monospace','font-size:13px',
      'padding:20px 28px','z-index:9500','text-align:center',
      'min-width:260px','cursor:pointer',
      'box-shadow:0 0 20px #ffd70066'
    ].join(';');
    const lines = [
      `<div style="font-size:16px;letter-spacing:2px;margin-bottom:10px;">✓ MISSIONE COMPLETATA</div>`,
      `<div style="font-size:11px;color:#aaa;margin-bottom:12px;">${questNome}</div>`,
      ...bonusLines.map(l => `<div style="color:#88ccff;margin-bottom:4px;">⬆ ${l} PERMANENTE</div>`),
      gold > 0 ? `<div style="color:#ffd700;margin-bottom:4px;">💰 +${gold} ZEC</div>` : '',
      fate > 0 ? `<div style="color:#88ccff;margin-bottom:4px;">⭐ +${fate} DESTINO</div>` : '',
      `<div style="font-size:10px;color:#555;margin-top:12px;">[ CLICCA PER CHIUDERE ]</div>`
    ].join('');
    popup.innerHTML = lines;
    document.body.appendChild(popup);
    const dismiss = () => { popup.remove(); document.removeEventListener('keydown', dismiss); };
    popup.addEventListener('click', dismiss);
    document.addEventListener('keydown', dismiss);
    setTimeout(() => { if (document.getElementById('bonus-popup')) dismiss(); }, 5000);
  },

  _applyBonuses(attrs, bonuses) {
    if (!bonuses) return;
    const keyMap = { CHA:'FRT', WIS:'RES', DEX:'DES', STR:'FOR', CON:'COS' };
    for (const [k, v] of Object.entries(bonuses)) {
      const key = keyMap[k] || k;
      if (attrs.hasOwnProperty(key)) attrs[key] += v;
    }
  },

  // Shared poison tick — call on any time-advancing action
  _poisonTick(logId) {
    const pdmg = this.char && (this.char.poisonDmgPerDay || 0);
    if (!pdmg) return true; // not poisoned — silent
    this.char.derived.hp = Math.max(0, (this.char.derived.hp || 0) - pdmg);
    addLog(logId, `☠ VELENO: -${pdmg} HP! HP: ${this.char.derived.hp}/${this.char.derived.maxHp} — Acquista antidoto dalla Maga.`, '#aaff33');
    updateGlobalHUD(this.char);
    if (this.char.derived.hp <= 0) {
      this.char.poisonDmgPerDay = 0;
      addLog(logId, `💀 IL VELENO TI HA UCCISO!`, '#ff4444');
      setTimeout(() => this._handleDeath(), 1800);
      return false; // dead
    }
    return true; // alive
  },

  // Calc poison DoT per day based on elem attack, tier, and enemy type
  _calcPoisonDpd(e) {
    if (!e || !e.elemAttack || e.elemAttack.type !== 'VEL') return 0;
    const tierMult = e.tier === 'Boss' ? 3 : e.tier === 'Elite' ? 2 : 1;
    const TYPE_MULT = { Bestia: 1.5, Mitologico: 2.0, Umanoide: 1.0, 'Non-Morto': 1.2, Elementale: 1.3, Costrutto: 0.5 };
    const typeMult = TYPE_MULT[e.tipo] || 1.0;
    return Math.max(1, Math.ceil(e.elemAttack.val / 3 * tierMult * typeMult));
  }
};

// ── BOOT ──────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => { GameTooltip.init(); Game.init(); });
