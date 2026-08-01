const express = require('express');
const router = express.Router();
const { createCharacter, calcDerivedStats } = require('../engine/character');
const { initCombat, processTurn, generateEnemy } = require('../engine/combat');
const { startTravel, travelStep } = require('../engine/travel');
const { getLocations, isUnlocked } = require('../engine/map');
const { getActiveQuests, getQuestForLocation, startQuest, completeQuest, checkQuestTriggers } = require('../engine/quest');
const { getShopInventory, buyItem, sellItem, equipItem, useConsumable } = require('../engine/shop');
const { saveGame, loadGame } = require('../engine/save');
const { createRNG } = require('../engine/seed');
const path = require('path');
const fs = require('fs');

function loadData(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../../data', name + '.json'), 'utf8'));
}

function getState(req) {
  return req.session.gameState || null;
}

function setState(req, state) {
  req.session.gameState = state;
}

// POST /api/game/new
router.post('/new', (req, res) => {
  try {
    const character = createCharacter(req.body);
    const state = {
      character,
      mode: 'map',
      combatState: null,
      travelState: null,
      currentShop: null,
      currentNpc: null,
      lastMessage: `Benvenuto, ${character.nome}! La tua avventura inizia a Venarium.`
    };
    setState(req, state);
    res.json({ ok: true, state });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/game/load
router.post('/load', (req, res) => {
  const { slot } = req.body;
  const character = loadGame(slot);
  if (!character) return res.status(404).json({ error: 'Salvataggio non trovato.' });
  const state = {
    character,
    mode: 'map',
    combatState: null,
    travelState: null,
    currentShop: null,
    currentNpc: null,
    lastMessage: `Benvenuto di ritorno, ${character.nome}!`
  };
  setState(req, state);
  res.json({ ok: true, state });
});

// GET /api/game/state
router.get('/state', (req, res) => {
  const state = getState(req);
  if (!state) return res.status(404).json({ error: 'Nessuna partita in corso.' });
  // Attach locations with unlock status
  const locations = getLocations(state.character);
  res.json({ ...state, locations });
});

// POST /api/game/travel/start
router.post('/travel/start', (req, res) => {
  const state = getState(req);
  if (!state) return res.status(404).json({ error: 'Nessuna partita in corso.' });
  const { destIdx } = req.body;
  const locations = getLocations(state.character);

  const result = startTravel(state.character, parseInt(destIdx), locations);
  if (result.error) return res.status(400).json(result);

  state.mode = 'travel';
  state.lastMessage = result.message;
  setState(req, state);
  res.json({ ok: true, result, state });
});

// POST /api/game/travel/step
router.post('/travel/step', (req, res) => {
  const state = getState(req);
  if (!state) return res.status(404).json({ error: 'Nessuna partita in corso.' });

  const char = state.character;
  const rng = createRNG((char.seed || 12345) + Date.now() % 99999);
  const locations = getLocations(char);

  const result = travelStep(char, rng, locations);

  if (result.event === 'rest') {
    char.derived = char.derived || {};
    char.derived.hp = Math.min(char.derived.maxHp || 20, (char.derived.hp || char.derived.maxHp || 20) + result.heal);
  }

  if (result.event === 'gold') {
    char.gold = (char.gold || 0) + result.gold;
  }

  if (result.event === 'encounter') {
    // Initialize combat
    const combatState = initCombat(char, result.enemy, (char.seed || 12345) + Date.now() % 9999);
    state.combatState = combatState;
    state.mode = 'combat';
  }

  if (result.event === 'arrived') {
    state.mode = 'location';
    state.lastMessage = result.message;
    // Check quest triggers
    const triggers = checkQuestTriggers(char, char.currentLocation);
    if (triggers.length > 0) {
      state.questTriggers = triggers;
    }
  } else {
    state.lastMessage = result.message;
  }

  setState(req, state);
  res.json({ ok: true, result, state });
});

// POST /api/game/combat/action
router.post('/combat/action', (req, res) => {
  const state = getState(req);
  if (!state || !state.combatState) return res.status(400).json({ error: 'Nessun combattimento attivo.' });
  const { action, skillId } = req.body;

  const newCombatState = processTurn(state.combatState, action, state.character);
  state.combatState = newCombatState;

  // Sync player HP back to character
  state.character.derived = state.character.derived || {};
  state.character.derived.hp = newCombatState.player.hp;

  if (!newCombatState.active) {
    if (newCombatState.result === 'victory') {
      state.character.gold = (state.character.gold || 0) + (newCombatState.goldReward || 0);
      state.mode = state.character.travelDestination !== null ? 'travel' : 'location';
    } else if (newCombatState.result === 'death') {
      state.mode = 'dead';
      state.character.gameOver = true;
    } else {
      state.mode = state.character.travelDestination !== null ? 'travel' : 'location';
    }
  }

  setState(req, state);
  res.json({ ok: true, combatState: newCombatState, state });
});

// POST /api/game/shop/buy
router.post('/shop/buy', (req, res) => {
  const state = getState(req);
  if (!state) return res.status(404).json({ error: 'Nessuna partita in corso.' });
  const { itemId, shopType } = req.body;

  const result = buyItem(state.character, itemId, shopType);
  if (result.error) return res.status(400).json(result);

  setState(req, state);
  res.json({ ok: true, result, state });
});

// POST /api/game/shop/sell
router.post('/shop/sell', (req, res) => {
  const state = getState(req);
  if (!state) return res.status(404).json({ error: 'Nessuna partita in corso.' });
  const { instanceId } = req.body;

  const result = sellItem(state.character, instanceId);
  if (result.error) return res.status(400).json(result);

  setState(req, state);
  res.json({ ok: true, result, state });
});

// POST /api/game/shop/use
router.post('/shop/use', (req, res) => {
  const state = getState(req);
  if (!state) return res.status(404).json({ error: 'Nessuna partita in corso.' });
  const { instanceId } = req.body;

  const result = useConsumable(state.character, instanceId);
  if (result.error) return res.status(400).json(result);

  setState(req, state);
  res.json({ ok: true, result, state });
});

// POST /api/game/quest/choice
router.post('/quest/choice', (req, res) => {
  const state = getState(req);
  if (!state) return res.status(404).json({ error: 'Nessuna partita in corso.' });
  const { questId, choice } = req.body;

  // Start quest if not started
  startQuest(state.character, questId);
  const result = completeQuest(state.character, questId, parseInt(choice));
  if (result.error) return res.status(400).json(result);

  if (state.character.gameOver) {
    state.mode = 'ending';
  }

  setState(req, state);
  res.json({ ok: true, result, state });
});

// POST /api/game/dialog/choice
router.post('/dialog/choice', (req, res) => {
  const state = getState(req);
  if (!state) return res.status(404).json({ error: 'Nessuna partita in corso.' });
  const { npcId, choiceId } = req.body;

  const npcs = loadData('npcs');
  const npc = npcs[npcId];
  if (!npc) return res.status(404).json({ error: 'NPC non trovato.' });

  const choice = npc.choices.find(c => c.id === choiceId);
  let dialogText = null;
  let questAction = null;

  if (choice) {
    if (choice.nextDialogo && npc.dialoghi[choice.nextDialogo]) {
      dialogText = npc.dialoghi[choice.nextDialogo];
    }
    if (choice.questAction) {
      questAction = choice.questAction;
    }
  }

  state.currentNpc = { npcId, currentDialog: choice ? choice.nextDialogo : null };
  setState(req, state);

  res.json({ ok: true, npc, dialogText, questAction, choice, state });
});

// POST /api/game/save
router.post('/save', (req, res) => {
  const state = getState(req);
  if (!state) return res.status(404).json({ error: 'Nessuna partita in corso.' });
  const { slot } = req.body;
  const slotName = slot || `save_${Date.now()}`;

  const result = saveGame(state.character, slotName);
  res.json({ ok: true, result });
});

// POST /api/game/equip
router.post('/equip', (req, res) => {
  const state = getState(req);
  if (!state) return res.status(404).json({ error: 'Nessuna partita in corso.' });
  const { instanceId, slot } = req.body;

  const result = equipItem(state.character, instanceId, slot);
  if (result.error) return res.status(400).json(result);

  setState(req, state);
  res.json({ ok: true, result, state });
});

// POST /api/game/unequip
router.post('/unequip', (req, res) => {
  const state = getState(req);
  if (!state) return res.status(404).json({ error: 'Nessuna partita in corso.' });
  const { slot } = req.body;

  const { removeEquipment } = require('../engine/character');
  removeEquipment(state.character, slot);

  setState(req, state);
  res.json({ ok: true, state });
});

// POST /api/game/location/enter
router.post('/location/enter', (req, res) => {
  const state = getState(req);
  if (!state) return res.status(404).json({ error: 'Nessuna partita in corso.' });

  const locations = getLocations(state.character);
  const loc = locations[state.character.currentLocation];
  const npcs = loadData('npcs');

  // Collect NPCs at this location
  const locationNpcs = (loc.npcs || []).map(nid => npcs[nid]).filter(Boolean);

  state.mode = 'location';
  setState(req, state);

  res.json({ ok: true, location: loc, npcs: locationNpcs, state });
});

// POST /api/game/combat/start
router.post('/combat/start', (req, res) => {
  const state = getState(req);
  if (!state) return res.status(404).json({ error: 'Nessuna partita in corso.' });
  const { enemyId, tier } = req.body;

  const locations = getLocations(state.character);
  const loc = locations[state.character.currentLocation];
  const rng = createRNG((state.character.seed || 12345) + Date.now() % 99999);
  const enemy = generateEnemy(loc ? loc.biome : 'any', tier || 'Normale', null, rng);

  const combatState = initCombat(state.character, enemy, (state.character.seed || 12345) + Date.now() % 9999);
  state.combatState = combatState;
  state.mode = 'combat';

  setState(req, state);
  res.json({ ok: true, combatState, state });
});

// GET /api/game/shop/:shopType
router.get('/shop/:shopType', (req, res) => {
  const state = getState(req);
  if (!state) return res.status(404).json({ error: 'Nessuna partita in corso.' });
  const shopData = getShopInventory(null, req.params.shopType);
  res.json({ ok: true, shop: shopData });
});

module.exports = router;
