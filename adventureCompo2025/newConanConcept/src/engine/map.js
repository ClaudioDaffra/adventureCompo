const path = require('path');
const fs = require('fs');

function loadData(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../../data', name + '.json'), 'utf8'));
}

function getLocations(character) {
  const locs = loadData('locations');
  return locs.map(loc => ({
    ...loc,
    unlocked: !loc.locked || (character.visitedLocations || []).includes(loc.id) ||
              isUnlocked(loc, character)
  }));
}

function isUnlocked(location, character) {
  if (!location.locked) return true;
  if ((character.visitedLocations || []).includes(location.id)) return true;

  // Check quest unlock logic
  const quests = loadData('quests');
  const majorQuests = quests.major;

  // Each major quest unlocks specific locations
  const unlockMap = {
    'Gurth': 'M1',
    'Paludi Oscure': 'M2',
    'Terre Vulcaniche': 'M3',
    'Koppar': 'M4',
    'Zuarir': 'M4',
    'Foreste Oscure': 'M5',
    'Shadizar': 'M6',
    'Khorshemish': 'M7',
    'Montagna Luminosa': 'M10'
  };

  const requiredQuest = unlockMap[location.n];
  if (requiredQuest) {
    const questState = (character.questMajorStato || {})[requiredQuest];
    return questState === 'completata';
  }

  return false;
}

function unlockLocation(character, locationName) {
  const locs = loadData('locations');
  const loc = locs.find(l => l.n === locationName || l.id === locationName);
  if (loc && !character.visitedLocations.includes(loc.id)) {
    // Just add it to the known locations - actual unlock happens via quest completion
    character.visitedLocations = character.visitedLocations || [];
  }
  return character;
}

function calcRoute(fromIdx, toIdx, locations) {
  const from = locations[fromIdx];
  const to = locations[toIdx];
  if (!from || !to) return null;
  const dist = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
  const steps = Math.ceil(dist / 10);
  return { distance: dist, steps, from: from.n, to: to.n };
}

module.exports = { getLocations, isUnlocked, unlockLocation, calcRoute };
