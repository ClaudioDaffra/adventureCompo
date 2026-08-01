const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/imageLocations', express.static(path.join(__dirname, 'imageLocations')));
app.use(express.static('public'));
app.use(bodyParser.json());

function readData(name) {
    try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', name), 'utf8'));
    } catch (e) {
        console.error(`Error reading ${name}:`, e.message);
        return {};
    }
}

// ── Tutti i dati di gioco in una chiamata ──────────────────────────
app.get('/api/data', (req, res) => {
    try {
        const data = {
            races:       readData('races.json'),
            classes:     readData('classes.json'),
            gods:        readData('gods.json'),
            backgrounds: readData('backgrounds.json'),
            events:      readData('events.json'),
            codes:       readData('codes.json'),
            items:       readData('items.json'),
            names:       readData('names.json'),
            enemies:     readData('enemies.json'),
            forgia:      readData('forgia.json'),
            locations:   readData('locations.json'),
            quests:      readData('quests.json'),
            npcs:        readData('npcs.json'),
            shops:       readData('shops.json')
        };
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Lista personaggi salvati ───────────────────────────────────────
app.get('/api/characters', (req, res) => {
    const charDir = path.join(__dirname, 'characters');
    if (!fs.existsSync(charDir)) fs.mkdirSync(charDir);
    const files = fs.readdirSync(charDir).filter(f => f.endsWith('.json'));
    const list = files.map(f => {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(charDir, f), 'utf8'));
            return {
                slot: f.replace('.json', ''),
                nome: data.nome || '?',
                razza: data.razza || '?',
                classe: data.classe || '?',
                frammenti: (data.frammenti || []).length,
                gold: data.gold || 0,
                savedAt: data.savedAt || null
            };
        } catch (e) { return { slot: f.replace('.json',''), nome: f.replace('.json','') }; }
    });
    res.json(list);
});

// ── Carica personaggio ─────────────────────────────────────────────
app.get('/api/character/:name', (req, res) => {
    const name = req.params.name;
    const filePath = path.join(__dirname, 'characters', `${name}.json`);
    if (fs.existsSync(filePath)) {
        try {
            res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
        } catch(e) { res.status(500).json({ error: 'File corrotto' }); }
    } else {
        res.status(404).json({ error: 'Personaggio non trovato' });
    }
});

// ── Salva personaggio ──────────────────────────────────────────────
app.post('/api/save-character', (req, res) => {
    try {
        const character = req.body;
        if (!character.nome) return res.status(400).json({ error: 'Nome richiesto' });

        const charDir = path.join(__dirname, 'characters');
        if (!fs.existsSync(charDir)) fs.mkdirSync(charDir);

        let safeName;
        if (character.saveSlot) {
            // Already assigned a slot — always overwrite own file
            safeName = character.saveSlot;
        } else {
            safeName = character.nome.replace(/[^a-z0-9àèéìòù]/gi, '_').toLowerCase();
            const candidate = path.join(charDir, `${safeName}.json`);
            if (fs.existsSync(candidate)) {
                try {
                    const existing = JSON.parse(fs.readFileSync(candidate, 'utf8'));
                    const sameChar = existing.id === character.id || existing.createdAt === character.createdAt;
                    if (!sameChar) {
                        // Different character with same name → find free slot (conan_2, conan_3, …)
                        let n = 2;
                        while (fs.existsSync(path.join(charDir, `${safeName}_${n}.json`))) n++;
                        safeName = `${safeName}_${n}`;
                    }
                } catch (_) { /* file corrupt — overwrite */ }
            }
        }

        character.savedAt = new Date().toISOString();
        character.saveSlot = safeName;
        const filePath = path.join(charDir, `${safeName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(character, null, 2));

        console.log(`  ✓ Salvato: ${character.nome} → ${path.basename(filePath)}`);
        res.json({ success: true, slot: safeName });
    } catch (e) {
        console.error('Errore salvataggio:', e);
        res.status(500).json({ error: e.message });
    }
});

// ── Elimina personaggio ────────────────────────────────────────────
app.delete('/api/character/:name', (req, res) => {
    const name = req.params.name;
    const filePath = path.join(__dirname, 'characters', `${name}.json`);
    if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); res.json({ success: true }); }
        catch(e) { res.status(500).json({ error: 'Eliminazione fallita' }); }
    } else { res.status(404).json({ error: 'Non trovato' }); }
});

const server = app.listen(PORT, () => {
    console.log(`\n  ❄  CONAN II - L'URLO DI YMIR`);
    console.log(`  ❄  Cimmeria Server running on http://localhost:${PORT}`);
    console.log(`  ❄  Press Ctrl+C to stop\n`);
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`\n  ✗  Porta ${PORT} occupata. Chiudi il processo precedente e riprova.\n`);
        process.exit(1);
    } else { throw e; }
});
