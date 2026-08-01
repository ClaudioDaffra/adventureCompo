const { v4: uuidv4 } = require('uuid');
const { createRNG, seedFromString } = require('./seed');
const path = require('path');
const fs = require('fs');

function loadData(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../../data', name + '.json'), 'utf8'));
}

const AGE_BONUSES = {
  "18": { DES: 1, FRT: -1 },
  "24": { FOR: 1, INT: -1 },
  "34": { RES: 1, FRT: -1 },
  "45": { INT: 1, FOR: -1 },
  "55": { FRT: 1, DES: -1 }
};

function createCharacter(data) {
  const races = loadData('races');
  const classes = loadData('classes');
  const gods = loadData('gods');
  const backgrounds = loadData('backgrounds');

  const raceData = races.find(r => r.id === data.razza);
  const classData = classes.find(c => c.id === data.classe);
  const subclassData = classData ? classData.sottoclassi.find(s => s.id === data.sottoclasse) : null;
  const godData = gods.find(g => g.id === data.dio);
  const bgData = backgrounds.find(b => b.id === data.background);

  if (!raceData || !classData || !godData || !bgData) {
    throw new Error('Dati personaggio non validi');
  }

  // Base attributes
  const base = { FOR: 8, DES: 8, COS: 8, RES: 8, INT: 8, FRT: 8 };

  // Apply point buy from form
  const attrs = data.attributes || {};
  const finalAttrs = { ...base };
  for (const k of Object.keys(base)) {
    if (attrs[k] !== undefined) {
      finalAttrs[k] = parseInt(attrs[k]) || base[k];
    }
  }

  // Apply race bonuses/maluses
  if (raceData.bonuses) {
    for (const [k, v] of Object.entries(raceData.bonuses)) {
      const key = k === 'CHA' ? 'FRT' : k === 'WIS' ? 'RES' : k;
      finalAttrs[key] = (finalAttrs[key] || 8) + v;
    }
  }
  if (raceData.maluses) {
    for (const [k, v] of Object.entries(raceData.maluses)) {
      const key = k === 'CHA' ? 'FRT' : k === 'WIS' ? 'RES' : k;
      finalAttrs[key] = (finalAttrs[key] || 8) + v;
    }
  }

  // Apply class bonuses
  if (classData.bonuses) {
    for (const [k, v] of Object.entries(classData.bonuses)) {
      const key = k === 'CHA' ? 'FRT' : k === 'WIS' ? 'RES' : k;
      finalAttrs[key] = (finalAttrs[key] || 8) + v;
    }
  }

  // Apply subclass bonus
  if (subclassData && subclassData.bonus) {
    for (const [k, v] of Object.entries(subclassData.bonus)) {
      const key = k === 'CHA' ? 'FRT' : k === 'WIS' ? 'RES' : k === 'DEX' ? 'DES' : k;
      finalAttrs[key] = (finalAttrs[key] || 8) + v;
    }
  }

  // Apply god bonus
  if (godData.bonus) {
    for (const [k, v] of Object.entries(godData.bonus)) {
      const key = k === 'CHA' ? 'FRT' : k === 'WIS' ? 'RES' : k;
      finalAttrs[key] = (finalAttrs[key] || 8) + v;
    }
  }

  // Apply background bonus
  if (bgData.bonus) {
    for (const [k, v] of Object.entries(bgData.bonus)) {
      const key = k === 'CHA' ? 'FRT' : k === 'WIS' ? 'RES' : k;
      finalAttrs[key] = (finalAttrs[key] || 8) + v;
    }
  }

  // Apply age bonuses
  const etaBonus = AGE_BONUSES[String(data.eta)] || {};
  for (const [k, v] of Object.entries(etaBonus)) {
    finalAttrs[k] = (finalAttrs[k] || 8) + v;
  }

  // Clamp attributes
  for (const k of Object.keys(finalAttrs)) {
    finalAttrs[k] = Math.max(4, Math.min(20, finalAttrs[k]));
  }

  // Collect skills and traits
  const skills = [...(raceData.skills || [])];
  if (subclassData) skills.push(...(subclassData.skills || []));
  const traits = [];
  if (subclassData) traits.push(subclassData.trait);
  if (godData.trait) traits.push(godData.trait);
  if (bgData.trait) traits.push(bgData.trait);

  // Elemental resistances from race
  const resistances = {
    fuoco: 0, freddo: 0, acido: 0, veleno: 0, magia: 0, fulmine: 0, incanto: 0
  };
  if (raceData.res) {
    for (const [k, v] of Object.entries(raceData.res)) {
      if (resistances.hasOwnProperty(k)) resistances[k] += v;
    }
  }

  // Gold
  const seedNum = data.seed ? seedFromString(String(data.seed)) : Math.floor(Math.random() * 99999);
  const rng = createRNG(seedNum);
  const baseGold = 10 + Math.floor(rng() * 20);
  const gold = baseGold + (bgData.gold_mod || 0);

  // Initial fate (destino)
  let destino = 0;

  const character = {
    id: uuidv4(),
    nome: data.nome || 'Conan',
    sesso: data.sesso || 'maschio',
    eta: parseInt(data.eta) || 34,
    razza: data.razza,
    classe: data.classe,
    sottoclasse: data.sottoclasse,
    background: data.background,
    dio: data.dio,
    evento: data.evento || '',
    condotta: data.condotta || '',
    seed: seedNum,
    storia: data.storia || '',
    attributes: finalAttrs,
    derived: {},
    resistances,
    skills,
    traits,
    equipment: {
      elmo: null, armatura: null, bracciali: null, cintura: null,
      amuleto: null, anello: null, arma: null, arma2: null, stivali: null, scudo: null
    },
    inventory: [],
    gold: Math.max(0, gold),
    destino,
    frammenti: [],
    alleanze: [],
    currentLocation: 0,
    visitedLocations: [0],
    travelDestination: null,
    travelProgress: 0,
    travelDistance: 0,
    questMajorStato: {},
    questMinorStato: {},
    activeQuest: null,
    combatState: null,
    gameOver: false,
    ending: null,
    createdAt: new Date().toISOString()
  };

  // Calculate derived stats
  character.derived = calcDerivedStats(character);

  return character;
}

function calcDerivedStats(char) {
  const a = char.attributes;
  const eq = char.equipment || {};

  // Base combat stats
  let hp = a.COS * 2;
  let energia = a.RES * 2;
  let att = Math.floor(a.DES / 4);
  let dan = Math.floor(a.FOR / 3);
  let def = Math.floor(a.DES / 4);
  let rd = Math.floor(a.RES / 5);
  let ini = Math.floor(a.DES / 2);

  // Add class HP bonus
  const classes = loadData('classes');
  const classData = classes.find(c => c.id === char.classe);
  if (classData) {
    const sub = classData.sottoclassi.find(s => s.id === char.sottoclasse);
    if (sub) {
      hp += sub.hpBonus || 0;
      if (sub.combBonus) {
        att += sub.combBonus.att || 0;
        dan += sub.combBonus.dan || 0;
        def += sub.combBonus.def || 0;
        rd  += sub.combBonus.rd || 0;
        ini += sub.combBonus.ini || 0;
      }
    }
  }

  // Equipment bonuses
  const slots = Object.values(eq);
  for (const item of slots) {
    if (!item) continue;
    const c = item.comb || {};
    att += c.att || 0;
    dan += c.dan || 0;
    def += c.def || 0;
    rd  += c.rd || 0;
    ini += c.ini || 0;
    hp  += c.hp || 0;
    energia += c.energia || 0;
  }

  return {
    hp: Math.max(1, hp),
    maxHp: Math.max(1, hp),
    energia: Math.max(0, energia),
    maxEnergia: Math.max(0, energia),
    att: Math.max(0, att),
    dan: Math.max(1, dan),
    def: Math.max(0, def),
    rd: Math.max(0, rd),
    ini: Math.max(0, ini)
  };
}

function applyEquipment(char, item, slot) {
  if (!char.equipment) char.equipment = {};
  char.equipment[slot] = item;
  char.derived = calcDerivedStats(char);
  return char;
}

function removeEquipment(char, slot) {
  if (char.equipment && char.equipment[slot]) {
    char.inventory = char.inventory || [];
    char.inventory.push(char.equipment[slot]);
    char.equipment[slot] = null;
    char.derived = calcDerivedStats(char);
  }
  return char;
}

function addToInventory(char, item) {
  char.inventory = char.inventory || [];
  char.inventory.push({ ...item, instanceId: uuidv4() });
  return char;
}

function removeFromInventory(char, instanceId) {
  char.inventory = (char.inventory || []).filter(i => i.instanceId !== instanceId);
  return char;
}

module.exports = {
  createCharacter,
  calcDerivedStats,
  applyEquipment,
  removeEquipment,
  addToInventory,
  removeFromInventory,
  AGE_BONUSES
};
