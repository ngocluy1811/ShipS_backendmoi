const express = require('express');
const router = express.Router();
const axios = require('axios');

// Get place details from Vietmap API
router.get('/place-details', async (req, res) => {
    try {
        const { place_id } = req.query;
        if (!place_id) {
            return res.status(400).json({ error: 'Place ID is required' });
        }

        const response = await axios.get(`https://maps.vietmap.vn/api/place/details/json`, {
            params: {
                place_id,
                key: process.env.VIETMAP_API_KEY
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching place details:', error);
        res.status(500).json({ error: 'Failed to fetch place details' });
    }
});

// Search places using Vietmap API
router.get('/search', async (req, res) => {
    try {
        const { query, location } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const response = await axios.get(`https://maps.vietmap.vn/api/place/textsearch/json`, {
            params: {
                query,
                location,
                key: process.env.VIETMAP_API_KEY
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error searching places:', error);
        res.status(500).json({ error: 'Failed to search places' });
    }
});

// Get directions using Vietmap API
router.get('/directions', async (req, res) => {
    try {
        const { origin, destination } = req.query;
        if (!origin || !destination) {
            return res.status(400).json({ error: 'Origin and destination are required' });
        }

        const response = await axios.get(`https://maps.vietmap.vn/api/directions/json`, {
            params: {
                origin,
                destination,
                key: process.env.VIETMAP_API_KEY
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error getting directions:', error);
        res.status(500).json({ error: 'Failed to get directions' });
    }
});

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