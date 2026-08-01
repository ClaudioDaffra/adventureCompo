const path = require('path');
const fs = require('fs');

function loadData(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../../data', name + '.json'), 'utf8'));
}

function getActiveQuests(character) {
  const quests = loadData('quests');
  const majorState = character.questMajorStato || {};
  const minorState = character.questMinorStato || {};

  const major = quests.major.map(q => ({
    ...q,
    stato: majorState[q.id] || q.stato
  }));

  const minor = quests.minor.map(q => ({
    ...q,
    stato: minorState[q.id] || q.stato
  }));

  return { major, minor };
}

function getQuestForLocation(locationIdx) {
  const locs = loadData('locations');
  const quests = loadData('quests');
  const loc = locs[locationIdx];
  if (!loc) return null;

  const major = quests.major.find(q => q.locationIdx === locationIdx);
  const minor = quests.minor.filter(q => q.bioma === loc.n);

  return { major: major || null, minor };
}

function startQuest(character, questId) {
  const quests = loadData('quests');
  const major = quests.major.find(q => q.id === questId);
  const minor = quests.minor.find(q => q.id === questId);
  const quest = major || minor;

  if (!quest) return { error: 'Quest non trovata.' };

  if (major) {
    if (!character.questMajorStato) character.questMajorStato = {};
    const current = character.questMajorStato[questId];
    if (current === 'completata') return { error: 'Quest gia\' completata.' };
    character.questMajorStato[questId] = 'attiva';
    character.activeQuest = questId;
  } else {
    if (!character.questMinorStato) character.questMinorStato = {};
    if (character.questMinorStato[questId] === 'completata') return { error: 'Quest gia\' completata.' };
    character.questMinorStato[questId] = 'attiva';
  }

  return { started: true, quest, message: `Quest avviata: ${quest.nome}` };
}

function completeQuest(character, questId, choice) {
  const quests = loadData('quests');
  const major = quests.major.find(q => q.id === questId);
  const minor = quests.minor.find(q => q.id === questId);
  const quest = major || minor;

  if (!quest) return { error: 'Quest non trovata.' };

  const locs = loadData('locations');
  const rewards = [];
  let message = '';

  if (major) {
    if (!character.questMajorStato) character.questMajorStato = {};
    character.questMajorStato[questId] = 'completata';

    // Give gold reward
    if (quest.rewardGold) {
      character.gold = (character.gold || 0) + quest.rewardGold;
      rewards.push(`+${quest.rewardGold} Zecchini`);
    }

    // Give fragment reward
    if (quest.rewardFrag && !character.frammenti.includes(quest.rewardFrag)) {
      character.frammenti.push(quest.rewardFrag);
      rewards.push(`Frammento ${quest.rewardFrag} dell'Urlo`);
    }

    // Special choice effects
    if (questId === 'M9') {
      if (choice === 1) {
        // Pardoned the Mistico - gain ally
        if (!character.alleanze.includes('Mistico')) {
          character.alleanze.push('Mistico');
        }
        message = 'Hai perdonato il Mistico. Ora e\' tuo alleato per la Montagna.';
      } else {
        character.destino = Math.max(0, (character.destino || 0) - 2);
        message = 'Hai ucciso il Mistico. -2 Destino.';
      }
    } else if (questId === 'M12') {
      // Ending
      if (choice === 1) {
        character.ending = 'liberation';
        character.gameOver = true;
        message = 'FINALE A: Cimmeria e\' libera! Il ghiaccio si scioglie.';
      } else if (choice === 2) {
        character.ending = 'king';
        character.gameOver = true;
        message = 'FINALE B: Sei il nuovo Re di Cimmeria! La Corona di Ymir e\' tua.';
      } else {
        character.ending = 'betrayal';
        character.gameOver = true;
        message = 'FINALE C: Ti sei unito a Valthor. Cimmeria soffre sotto il ghiaccio eterno.';
      }
    }

    // Unlock locations
    if (quest.sblocca) {
      for (const locName of quest.sblocca) {
        const loc = locs.find(l => l.n === locName || l.n.includes(locName));
        if (loc && !character.visitedLocations.includes(loc.id)) {
          // Mark as accessible (not locked)
          if (!character.unlockedLocations) character.unlockedLocations = [];
          if (!character.unlockedLocations.includes(loc.id)) {
            character.unlockedLocations.push(loc.id);
            rewards.push(`Sblocca: ${loc.n}`);
          }
        }
      }
    }

    // Chain next major quest
    const nextNum = major.num + 1;
    const nextQuest = quests.major.find(q => q.num === nextNum);
    if (nextQuest && !character.questMajorStato[nextQuest.id]) {
      character.questMajorStato[nextQuest.id] = 'disponibile';
    }

    if (!message) {
      message = choice === 1 ? quest.choice1Ris : quest.choice2Ris;
    }

    return {
      completed: true,
      quest,
      choice,
      rewards,
      message: message || quest.ricompensa
    };
  } else {
    // Minor quest
    if (!character.questMinorStato) character.questMinorStato = {};
    character.questMinorStato[questId] = 'completata';

    const rewardGold = choice === 1 ? quest.rewardGold1 : quest.rewardGold2;
    const rewardFate = choice === 1 ? quest.rewardFate1 : quest.rewardFate2;

    if (rewardGold) {
      character.gold = (character.gold || 0) + rewardGold;
      rewards.push(`+${rewardGold} Zecchini`);
    }
    if (rewardFate) {
      character.destino = Math.max(0, (character.destino || 0) + rewardFate);
      if (rewardFate > 0) rewards.push(`+${rewardFate} Destino`);
      else rewards.push(`${rewardFate} Destino`);
    }

    message = choice === 1 ? quest.chiusura1 : quest.chiusura2;

    return {
      completed: true,
      quest,
      choice,
      rewards,
      message
    };
  }
}

function checkQuestTriggers(character, locationIdx) {
  const quests = loadData('quests');
  const triggered = [];

  // Check major quests for this location
  const locationQuest = quests.major.find(q => q.locationIdx === locationIdx);
  if (locationQuest) {
    const state = (character.questMajorStato || {})[locationQuest.id];
    if (!state || state === 'disponibile') {
      triggered.push(locationQuest);
    }
  }

  return triggered;
}

module.exports = {
  getActiveQuests,
  getQuestForLocation,
  startQuest,
  completeQuest,
  checkQuestTriggers
};
