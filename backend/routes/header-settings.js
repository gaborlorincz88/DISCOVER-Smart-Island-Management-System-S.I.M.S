const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'header-settings.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readSettings() {
  ensureDataDir();
  if (!fs.existsSync(SETTINGS_FILE)) {
    return getDefaultSettings();
  }
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read header settings, using defaults:', e);
    return getDefaultSettings();
  }
}

function writeSettings(settings) {
  ensureDataDir();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

function getDefaultSettings() {
  const baseButtons = [
    { key: 'explorer', label: 'EXPLORER' },
    { key: 'events', label: 'EVENTS' },
    { key: 'excursions', label: 'EXCURSIONS' },
    { key: 'contact', label: 'CONTACT US' },
    { key: 'trips', label: 'MY TRIPS' }
  ];
  const baseStyle = {
    fontFamily: 'Special Gothic Expanded One, system-ui, sans-serif',
    fontWeight: 700,
    fontSize: 13.6,
    letterSpacing: 0.05,
    uppercase: true,
    color: '#ff6b35',
    bg: 'transparent',
    shadow: '0 2px 4px rgba(0,0,0,0.5)',
    borderColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    radius: 8,
    selectedBg: 'rgba(255, 107, 53, 0.25)',
    selectedBorderColor: 'rgba(251, 146, 60, 0.5)',
    selectedShadow: '0 0 0 rgba(0,0,0,0)'
  };
  const base = {
    header: { bg: '#1f2937', gradient: null, blur: 0, shadow: '0 10px 20px rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.2)' },
    logo: { url: '/logo.png', width: 40, height: 40, alt: 'Discover Gozo' },
    buttons: baseButtons.map(b => ({ ...b, ...baseStyle })),
    overrides: {
      trips: { color: '#40e0d0', selectedBg: 'rgba(64, 224, 208, 0.25)', selectedBorderColor: 'rgba(34, 211, 238, 0.5)' }
    },
    sidebar: { cardBg: 'rgb(255, 255, 255)', sidebarBg: 'rgb(241, 245, 249)' },
    burgerMenu: { color: '#ffffff', size: 24, strokeWidth: 2, bg: 'transparent', padding: 8, borderRadius: 4 }
  };
  const baseDark = {
    header: { bg: '#1f2937', gradient: null, blur: 0, shadow: '0 10px 20px rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.2)' },
    logo: { url: '/logo.png', width: 40, height: 40, alt: 'Discover Gozo' },
    buttons: baseButtons.map(b => ({ ...b, ...baseStyle })),
    overrides: {
      trips: { color: '#40e0d0', selectedBg: 'rgba(64, 224, 208, 0.25)', selectedBorderColor: 'rgba(34, 211, 238, 0.5)' }
    },
    sidebar: { cardBg: 'rgb(30, 41, 59)', sidebarBg: 'rgb(0, 0, 0)' },
    burgerMenu: { color: '#ffffff', size: 24, strokeWidth: 2, bg: 'transparent', padding: 8, borderRadius: 4 }
  };
  return {
    updatedAt: new Date().toISOString(),
    light: {
      mobile: base,
      desktop: base
    },
    dark: {
      mobile: baseDark,
      desktop: baseDark
    }
  };
}

// GET settings
router.get('/header', (req, res) => {
  const settings = readSettings();
  res.json(settings);
});

// PUT settings
router.put('/header', express.json({ limit: '1mb' }), (req, res) => {
  const incoming = req.body || {};
  // Basic validation
  if (typeof incoming !== 'object' || !incoming) {
    return res.status(400).json({ error: 'Invalid settings payload' });
  }
  incoming.updatedAt = new Date().toISOString();
  try {
    writeSettings(incoming);
    res.json(incoming);
  } catch (e) {
    console.error('Failed to save header settings:', e);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;


