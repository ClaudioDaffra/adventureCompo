const express = require('express');
const router = express.Router();
const { listSaves, deleteSave, loadGame } = require('../engine/save');

// GET /api/saves
router.get('/', (req, res) => {
  const saves = listSaves();
  res.json({ ok: true, saves });
});

// DELETE /api/saves/:slot
router.delete('/:slot', (req, res) => {
  const result = deleteSave(req.params.slot);
  if (result.error) return res.status(404).json(result);
  res.json({ ok: true, result });
});

module.exports = router;
