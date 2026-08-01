const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

function loadData(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../../data', name + '.json'), 'utf8'));
}

function getShopInventory(locationType, shopType) {
  const shops = loadData('shops');
  const shopData = shops[shopType];
  if (!shopData) return { error: 'Negozio non trovato.' };
  return shopData;
}

function buyItem(character, itemId, shopType) {
  const shops = loadData('shops');
  const shopData = shops[shopType];
  if (!shopData) return { error: 'Negozio non trovato.' };

  const item = shopData.items.find(i => i.id === itemId);
  if (!item) return { error: 'Oggetto non trovato in questo negozio.' };

  if (character.gold < item.prezzo) {
    return { error: `Non hai abbastanza zecchini. Necessari: ${item.prezzo}, Hai: ${character.gold}` };
  }

  character.gold -= item.prezzo;
  const inventoryItem = { ...item, instanceId: uuidv4() };
  character.inventory = character.inventory || [];
  character.inventory.push(inventoryItem);

  return {
    bought: true,
    item: inventoryItem,
    goldSpent: item.prezzo,
    goldRemaining: character.gold,
    message: `Acquistato: ${item.nome} per ${item.prezzo} zecchini.`
  };
}

function sellItem(character, instanceId) {
  character.inventory = character.inventory || [];
  const idx = character.inventory.findIndex(i => i.instanceId === instanceId);
  if (idx === -1) return { error: 'Oggetto non trovato nell\'inventario.' };

  const item = character.inventory[idx];
  const sellPrice = Math.floor((item.prezzo || 10) * 0.5);
  character.gold += sellPrice;
  character.inventory.splice(idx, 1);

  return {
    sold: true,
    item,
    goldGained: sellPrice,
    goldTotal: character.gold,
    message: `Venduto: ${item.nome} per ${sellPrice} zecchini.`
  };
}

function equipItem(character, instanceId, slot) {
  character.inventory = character.inventory || [];
  character.equipment = character.equipment || {};

  const idx = character.inventory.findIndex(i => i.instanceId === instanceId);
  if (idx === -1) return { error: 'Oggetto non trovato nell\'inventario.' };

  const item = character.inventory[idx];

  // Unequip current item in slot if any
  if (character.equipment[slot]) {
    character.inventory.push(character.equipment[slot]);
  }

  // Equip new item
  character.equipment[slot] = item;
  character.inventory.splice(idx, 1);

  // Recalculate derived stats
  const { calcDerivedStats } = require('./character');
  character.derived = calcDerivedStats(character);

  return {
    equipped: true,
    item,
    slot,
    message: `${item.nome} equipaggiato nello slot ${slot}.`
  };
}

function useConsumable(character, instanceId) {
  character.inventory = character.inventory || [];
  const idx = character.inventory.findIndex(i => i.instanceId === instanceId);
  if (idx === -1) return { error: 'Oggetto non trovato.' };

  const item = character.inventory[idx];
  const effects = [];

  if (item.uso === 'hp' && item.effVal) {
    const healed = Math.min(item.effVal, character.derived.maxHp - (character.derived.hp || character.derived.maxHp));
    character.derived = character.derived || {};
    character.derived.hp = Math.min(character.derived.maxHp, (character.derived.hp || character.derived.maxHp) + item.effVal);
    effects.push(`+${item.effVal} HP`);
  }

  if (item.uso === 'res' && item.res) {
    character.resistances = character.resistances || {};
    for (const [k, v] of Object.entries(item.res)) {
      character.resistances[k] = (character.resistances[k] || 0) + v;
      effects.push(`+${v} Rid. ${k}`);
    }
  }

  if (item.uso === 'comb' && item.comb) {
    character.derived = character.derived || {};
    for (const [k, v] of Object.entries(item.comb)) {
      character.derived[k] = (character.derived[k] || 0) + v;
      effects.push(`+${v} ${k.toUpperCase()}`);
    }
  }

  if (item.uso === 'fate' && item.fateMod) {
    character.destino = (character.destino || 0) + item.fateMod;
    effects.push(`+${item.fateMod} Destino`);
  }

  // Remove from inventory (consumable used)
  character.inventory.splice(idx, 1);

  return {
    used: true,
    item,
    effects,
    message: `${item.nome} usato. Effetti: ${effects.join(', ')}`
  };
}

module.exports = { getShopInventory, buyItem, sellItem, equipItem, useConsumable };
