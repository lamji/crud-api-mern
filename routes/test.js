const express = require('express');
const router = express.Router();

// Simple test route
router.post('/test', (req, res) => {
  res.json({ success: true, message: 'Test route works' });
});

module.exports = router;
