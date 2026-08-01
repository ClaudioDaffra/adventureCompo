const { createRNG } = require('./seed');
const path = require('path');
const fs = require('fs');

function loadData(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../../data', name + '.json'), 'utf8'));
}

function rollDice(sides, rng) {
  return Math.floor(rng() * sides) + 1;
}

function calcHit(attValue, defValue, rng) {
  const roll = rollDice(20, rng);
  return (roll + attValue) > defValue;
}

function calcDamage(danValue, rng) {
  const variance = Math.floor(rng() * 4) - 1; // -1 to +2
  return Math.max(1, danValue + variance);
}

function getTierMultipliers(tier) {
  if (tier === 'Elite') return { attr: 1, hp: 10, dan: 1, rd: 0, att: 0 };
  if (tier === 'Boss')  return { attr: 2, hp: 20, dan: 1, rd: 0, att: 1 };
  return { attr: 0, hp: 0, dan: 0, rd: 0, att: 0 };
}

function generateEnemy(biome, tier, questFilter, rng) {
  const enemyDb = loadData('enemies');
  const weaponsDb = enemyDb.weapons;
  const armorsDb = enemyDb.armors;
  let pool = enemyDb.enemies;

  if (biome && biome !== 'any') {
    const biomePool = pool.filter(e => e.biome.includes(biome));
    if (biomePool.length > 0) pool = biomePool;
  }

  if (questFilter) {
    const questPool = pool.filter(e => e.questLink === questFilter);
    if (questPool.length > 0) pool = questPool;
  }

  const idx = Math.floor(rng() * pool.length);
  const baseEnemy = JSON.parse(JSON.stringify(pool[idx]));
  const mods = getTierMultipliers(tier || 'Normale');

  // Apply tier attribute bonuses
  for (const k in baseEnemy.attr) {
    baseEnemy.attr[k] += mods.attr;
  }

  const attr = baseEnemy.attr;
  let finalStats = {
    hp: (attr.COS * 2) + mods.hp,
    att: Math.floor(attr.DES / 4) + mods.att,
    dan: Math.floor(attr.FOR / 3) + mods.dan,
    def: Math.floor(attr.DES / 4) + (baseEnemy.armor.def || 0),
    rd:  Math.floor(attr.RES / 5) + (baseEnemy.armor.rd || 0) + mods.rd,
    ini: Math.floor(attr.DES / 2),
    elemDan: null
  };

  let loot = [];
  let weaponName = null, armorName = null;

  if (!baseEnemy.isMonster) {
    const w = weaponsDb[Math.floor(rng() * weaponsDb.length)];
    const a = armorsDb[Math.floor(rng() * armorsDb.length)];
    finalStats.att += w.att || 0;
    finalStats.dan += w.dan || 0;
    finalStats.def += w.def || 0;
    finalStats.rd  += a.rd || 0;
    finalStats.ini += a.ini || 0;
    if (w.elem) finalStats.elemDan = `${w.elem.type} +${w.elem.val}`;
    else if (baseEnemy.fixedElem) finalStats.elemDan = `${baseEnemy.fixedElem} +${mods.dan > 0 ? mods.dan + 1 : 2}`;
    weaponName = w.n;
    armorName = a.n;
    loot.push(w.n, a.n);
    loot.push(`${Math.floor(rng() * 10) + (tier === 'Boss' ? 50 : 5)} Zecchini`);
  } else {
    if (baseEnemy.fixedElem) {
      finalStats.elemDan = `${baseEnemy.fixedElem} +${Math.floor(attr.FRT / 4) + mods.dan}`;
    }
    loot = [...baseEnemy.loot];
    if (tier === 'Elite') loot.push('Gemma Grezza (Valore: 20 Zecchini)');
    if (tier === 'Boss') loot.push('Frammento dell\'Urlo');
  }

  return {
    id: baseEnemy.id,
    nome: baseEnemy.n,
    tipo: baseEnemy.t,
    isMonster: baseEnemy.isMonster,
    tier: tier || 'Normale',
    biome,
    ...finalStats,
    maxHp: finalStats.hp,
    attr: baseEnemy.attr,
    skills: baseEnemy.skills || [],
    baseRes: baseEnemy.baseRes || {},
    loot,
    lore: baseEnemy.lore || '',
    weaponName,
    armorName,
    questLink: baseEnemy.questLink || null,
    defending: false,
    statusEffects: []
  };
}

function initCombat(character, enemy, seedVal) {
  const rng = createRNG(seedVal || Math.floor(Math.random() * 99999));

  // Determine initiative
  const playerIni = character.derived.ini + rollDice(10, rng);
  const enemyIni = enemy.ini + rollDice(10, rng);
  const initiativePlayer = playerIni >= enemyIni;

  return {
    active: true,
    turn: 1,
    initiativePlayer,
    seed: seedVal,
    rngState: null, // managed per-call
    player: {
      hp: character.derived.maxHp,
      maxHp: character.derived.maxHp,
      att: character.derived.att,
      dan: character.derived.dan,
      def: character.derived.def,
      rd: character.derived.rd,
      ini: character.derived.ini,
      energia: character.derived.maxEnergia,
      maxEnergia: character.derived.maxEnergia,
      defending: false,
      skills: character.skills || [],
      resistances: character.resistances || {}
    },
    enemy: { ...enemy, hp: enemy.hp, maxHp: enemy.maxHp || enemy.hp },
    log: [
      initiativePlayer
        ? '*** HAI L\'INIZIATIVA! ***'
        : `*** ${enemy.nome} ATTACCA PER PRIMO! ***`
    ],
    result: null,
    loot: []
  };
}

function processTurn(combatState, action, character) {
  const cs = JSON.parse(JSON.stringify(combatState));
  const rng = createRNG((cs.seed || 12345) + cs.turn * 1337);
  const logEntry = [];

  cs.player.defending = false;

  if (!cs.active) return cs;

  // Player action
  if (action === 'attack') {
    const hit = calcHit(cs.player.att, cs.enemy.def, rng);
    if (hit) {
      let dmg = calcDamage(cs.player.dan, rng);
      dmg = Math.max(1, dmg - cs.enemy.rd);
      cs.enemy.hp -= dmg;
      logEntry.push(`HAI COLPITO! Danno: ${dmg}`);
    } else {
      logEntry.push(`MANCATO! ${cs.enemy.nome} schiva.`);
    }
  } else if (action === 'defend') {
    cs.player.defending = true;
    cs.player.def += 3;
    logEntry.push('Ti metti in posizione difensiva. DEF +3 questo turno.');
  } else if (action === 'skill') {
    // Use a skill - deal bonus damage
    const skillDmg = Math.floor(cs.player.dan * 1.5) + rollDice(6, rng);
    const skillDmgFinal = Math.max(1, skillDmg - cs.enemy.rd);
    cs.enemy.hp -= skillDmgFinal;
    logEntry.push(`ABILITA' SPECIALE! Danno potenziato: ${skillDmgFinal}`);
    if (cs.player.energia > 0) cs.player.energia -= 2;
  } else if (action === 'flee') {
    const fleChance = rng();
    if (fleChance > 0.4) {
      cs.active = false;
      cs.result = 'fled';
      cs.log.push('SEI FUGGITO!');
      return cs;
    } else {
      logEntry.push('FUGA FALLITA! Sei ancora in combattimento.');
    }
  } else if (action === 'surrender') {
    cs.active = false;
    cs.result = 'surrendered';
    cs.log.push('HAI CEDUTO. Perdi oro e onore.');
    return cs;
  }

  // Check enemy death
  if (cs.enemy.hp <= 0) {
    cs.enemy.hp = 0;
    cs.active = false;
    cs.result = 'victory';
    cs.loot = cs.enemy.loot || [];
    const goldFound = Math.floor(rng() * 30) + 10;
    cs.goldReward = goldFound;
    logEntry.push(`${cs.enemy.nome} E' SCONFITTO!`);
    logEntry.push(`Bottino: ${cs.loot.join(', ')}`);
    logEntry.push(`Oro trovato: ${goldFound} Zecchini`);
    cs.log.push(...logEntry);
    return cs;
  }

  // Enemy turn
  if (cs.enemy.hp > 0) {
    if (rng() < 0.15 && cs.enemy.skills && cs.enemy.skills.length > 0) {
      // Special skill
      const skill = cs.enemy.skills[Math.floor(rng() * cs.enemy.skills.length)];
      const skillDmg = Math.floor(cs.enemy.dan * 1.5) + rollDice(4, rng);
      const playerRD = cs.player.defending ? cs.player.rd + 3 : cs.player.rd;
      const finalDmg = Math.max(1, skillDmg - playerRD);
      cs.player.hp -= finalDmg;
      logEntry.push(`${cs.enemy.nome} usa ${skill}! Danno: ${finalDmg}`);
    } else {
      const enemyHit = calcHit(cs.enemy.att, cs.player.def, rng);
      if (enemyHit) {
        let eDmg = calcDamage(cs.enemy.dan, rng);
        const playerRD = cs.player.defending ? cs.player.rd + 3 : cs.player.rd;
        eDmg = Math.max(1, eDmg - playerRD);

        // Apply elemental damage if any
        if (cs.enemy.elemDan) {
          const parts = cs.enemy.elemDan.match(/(\w+)\s*\+(\d+)/);
          if (parts) {
            const elemType = parts[1].toLowerCase();
            const elemVal = parseInt(parts[2]);
            const elemMap = { 'fre': 'freddo', 'fuo': 'fuoco', 'vel': 'veleno', 'aci': 'acido', 'mag': 'magia', 'ful': 'fulmine' };
            const resistKey = elemMap[elemType.substring(0, 3)] || elemType;
            const resist = (cs.player.resistances || {})[resistKey] || 0;
            const elemDmg = Math.max(0, elemVal - resist);
            eDmg += elemDmg;
          }
        }

        cs.player.hp -= eDmg;
        logEntry.push(`${cs.enemy.nome} colpisce! Danno: ${eDmg}`);
      } else {
        logEntry.push(`${cs.enemy.nome} manca!`);
      }
    }
  }

  // Reset defending bonus
  if (cs.player.defending) {
    cs.player.def -= 3;
    cs.player.defending = false;
  }

  // Check player death
  if (cs.player.hp <= 0) {
    cs.player.hp = 0;
    cs.active = false;
    cs.result = 'death';
    logEntry.push('SEI CADUTO IN BATTAGLIA!');
  }

  cs.turn++;
  cs.log.push(...logEntry);

  return cs;
}

module.exports = {
  rollDice,
  calcHit,
  calcDamage,
  generateEnemy,
  initCombat,
  processTurn,
  getTierMultipliers
};
