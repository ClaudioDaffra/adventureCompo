const { generateEnemy } = require('./combat');

function calcDistance(loc1, loc2) {
  return Math.abs(loc1.x - loc2.x) + Math.abs(loc1.y - loc2.y);
}

function startTravel(character, destIdx, locations) {
  if (destIdx === character.currentLocation) {
    return { error: 'Sei gia\' in questa localita\'.' };
  }
  const dest = locations[destIdx];
  if (!dest) return { error: 'Destinazione non valida.' };
  if (dest.locked) {
    return { error: `${dest.n} e\' ancora bloccata. Completa le quest richieste.` };
  }

  const from = locations[character.currentLocation];
  const dist = calcDistance(from, dest);
  const steps = Math.ceil(dist / 10);

  character.travelDestination = destIdx;
  character.travelProgress = 0;
  character.travelDistance = steps;

  return {
    started: true,
    from: from.n,
    to: dest.n,
    distance: dist,
    steps,
    message: `Partenza da ${from.n} verso ${dest.n}. ${steps} tappe di viaggio.`
  };
}

function travelStep(character, rng, locations) {
  if (character.travelDestination === null || character.travelDestination === undefined) {
    return { event: 'nothing', message: 'Nessun viaggio in corso.' };
  }

  character.travelProgress = (character.travelProgress || 0) + 1;
  const dest = locations[character.travelDestination];

  // Check arrival
  if (character.travelProgress >= character.travelDistance) {
    const arrived = character.travelDestination;
    character.currentLocation = arrived;
    if (!character.visitedLocations.includes(arrived)) {
      character.visitedLocations.push(arrived);
    }
    character.travelDestination = null;
    character.travelProgress = 0;
    character.travelDistance = 0;
    return {
      event: 'arrived',
      location: dest,
      message: `Sei arrivato a ${dest.n}!`
    };
  }

  // Random events during travel
  const roll = rng();
  const currentLoc = locations[character.currentLocation] || locations[0];

  if (roll < 0.30) {
    // Enemy encounter
    const biome = currentLoc.biome || 'any';
    const tier = rng() < 0.15 ? 'Elite' : 'Normale';
    const enemy = generateEnemy(biome, tier, null, rng);
    return {
      event: 'encounter',
      enemy,
      progress: character.travelProgress,
      total: character.travelDistance,
      message: `Incontro! ${enemy.nome} ti blocca il cammino!`
    };
  } else if (roll < 0.50) {
    // Rest event - heal some HP
    const healAmt = Math.floor(rng() * 12) + 6;
    return {
      event: 'rest',
      heal: healAmt,
      progress: character.travelProgress,
      total: character.travelDistance,
      message: `Ti accampi per la notte. Recuperi ${healAmt} HP.`
    };
  } else if (roll < 0.60) {
    // Find gold
    const goldFound = Math.floor(rng() * 15) + 5;
    return {
      event: 'gold',
      gold: goldFound,
      progress: character.travelProgress,
      total: character.travelDistance,
      message: `Trovi ${goldFound} zecchini tra le rovine.`
    };
  } else {
    // Nothing
    const msgs = [
      'Il vento sibila tra le rocce. Nulla di interessante.',
      'Un\'aquila sorvola in cerchi. Il viaggio continua.',
      'La pista e\' silenziosa. Prosegui.',
      'Neve fresca copre le tracce. Cammini in silenzio.',
      'Le stelle guidano il tuo cammino.'
    ];
    const msg = msgs[Math.floor(rng() * msgs.length)];
    return {
      event: 'nothing',
      progress: character.travelProgress,
      total: character.travelDistance,
      message: msg
    };
  }
}

function calcRoute(fromIdx, toIdx, locations) {
  const from = locations[fromIdx];
  const to = locations[toIdx];
  if (!from || !to) return null;
  const dist = calcDistance(from, to);
  const steps = Math.ceil(dist / 10);
  return { distance: dist, steps, from: from.n, to: to.n };
}

module.exports = { startTravel, travelStep, calcRoute, calcDistance };
