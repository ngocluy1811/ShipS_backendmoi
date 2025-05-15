const express = require('express');
const axios = require('axios');
const router = express.Router();

const VIETMAP_API_KEY = process.env.VIETMAP_API_KEY || '7f9ef35866466886ebd24ba5091eda803732c8c76cde1b4a';

// Proxy Autocomplete
router.get('/autocomplete', async (req, res) => {
  try {
    const { text } = req.query;
    if (!text) {
      return res.status(400).json({ error: 'Text parameter is required.' });
    }
    const response = await axios.get('https://maps.vietmap.vn/api/autocomplete/v3', {
      params: {
        apikey: VIETMAP_API_KEY,
        text,
      }
    });
    res.json(response.data);
  } catch (err) {
    console.error('VietMap Autocomplete error:', err.response?.data || err.message);
    res.status(500).json({ error: 'VietMap Autocomplete error', detail: err.response?.data || err.message });
  }
});

// Proxy Place
router.get('/place', async (req, res) => {
  try {
    const { refid } = req.query;
    if (!refid) {
      return res.status(400).json({ error: 'Refid parameter is required.' });
    }
    const response = await axios.get('https://maps.vietmap.vn/api/place/v3', {
      params: {
        apikey: VIETMAP_API_KEY,
        refid,
      }
    });
    res.json(response.data);
  } catch (err) {
    console.error('VietMap Place error:', err.message);
    res.status(500).json({ error: 'VietMap Place error', detail: err.message });
  }
});

module.exports = router; 