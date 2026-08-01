// ══════════════════════════════════════════════
// API CLIENT — CONAN II L'URLO DI YMIR
// Architettura thick-client: logica nel browser,
// server gestisce dati e salvataggi.
// ══════════════════════════════════════════════

const API = {

  // Carica tutti i dati di gioco in una sola chiamata
  async loadGameData() {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('Impossibile caricare i dati di gioco.');
    return res.json();
  },

  // Lista personaggi salvati
  async listCharacters() {
    const res = await fetch('/api/characters');
    if (!res.ok) return [];
    return res.json();
  },

  // Carica personaggio da file
  async loadCharacter(slot) {
    const res = await fetch(`/api/character/${encodeURIComponent(slot)}`);
    if (!res.ok) throw new Error(`Personaggio "${slot}" non trovato.`);
    return res.json();
  },

  // Salva personaggio (tutto lo stato di gioco nel file)
  async saveCharacter(characterData) {
    const res = await fetch('/api/save-character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(characterData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Errore sconosciuto' }));
      throw new Error(err.error || 'Salvataggio fallito');
    }
    return res.json();
  },

  // Elimina personaggio
  async deleteCharacter(slot) {
    const res = await fetch(`/api/character/${encodeURIComponent(slot)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Eliminazione fallita');
    return res.json();
  }
};
