const fs = require('fs');
const path = require('path');

const SAVES_DIR = path.join(__dirname, '../../saves');

function ensureSavesDir() {
  if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR, { recursive: true });
  }
}

function saveGame(character, slot) {
  ensureSavesDir();
  const filename = path.join(SAVES_DIR, `${slot}.json`);
  const saveData = {
    slot,
    savedAt: new Date().toISOString(),
    characterName: character.nome,
    razza: character.razza,
    classe: character.classe,
    gold: character.gold,
    frammenti: character.frammenti,
    location: character.currentLocation,
    character
  };
  fs.writeFileSync(filename, JSON.stringify(saveData, null, 2), 'utf8');
  return { saved: true, slot, filename };
}

function loadGame(slot) {
  ensureSavesDir();
  const filename = path.join(SAVES_DIR, `${slot}.json`);
  if (!fs.existsSync(filename)) {
    return null;
  }
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  return data.character || data;
}

function listSaves() {
  ensureSavesDir();
  const files = fs.readdirSync(SAVES_DIR).filter(f => f.endsWith('.json'));
  const saves = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(SAVES_DIR, file), 'utf8'));
      saves.push({
        slot: data.slot || file.replace('.json', ''),
        savedAt: data.savedAt,
        characterName: data.characterName || 'Sconosciuto',
        razza: data.razza || '',
        classe: data.classe || '',
        gold: data.gold || 0,
        frammenti: data.frammenti ? data.frammenti.length : 0,
        location: data.location
      });
    } catch (e) {
      // skip invalid files
    }
  }
  return saves.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
}

function deleteSave(slot) {
  ensureSavesDir();
  const filename = path.join(SAVES_DIR, `${slot}.json`);
  if (fs.existsSync(filename)) {
    fs.unlinkSync(filename);
    return { deleted: true, slot };
  }
  return { error: 'Salvataggio non trovato.' };
}

module.exports = { saveGame, loadGame, listSaves, deleteSave };
