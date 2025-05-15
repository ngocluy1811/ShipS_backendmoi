const express = require('express');
const axios = require('axios');
const router = express.Router();

const VIETMAP_API_KEY = process.env.VIETMAP_API_KEY || 'YOUR_KEY_HERE';

router.get('/autocomplete', async (req, res) => {
  try {
    const { text } = req.query;
    const response = await axios.get('https://maps.vietmap.vn/api/autocomplete/v3', {
      params: {
        apikey: VIETMAP_API_KEY,
        text,
      }
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'VietMap Autocomplete error', detail: err.message });
  }
});

module.exports = router;
