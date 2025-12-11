document.addEventListener('DOMContentLoaded', () => {
  initHeaderEditor().catch(err => console.error(err));
});

// Helper function to convert rgb/rgba to hex (must be defined before initHeaderEditor)
function rgbToHex(val) {
  if (!val) return '#000000';
  if (val.startsWith('#')) return val;
  // crude conversion for rgb(a) - handles both rgb() and rgba()
  const m = val.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return '#000000';
  const r = Number(m[1]).toString(16).padStart(2,'0');
  const g = Number(m[2]).toString(16).padStart(2,'0');
  const b = Number(m[3]).toString(16).padStart(2,'0');
  return `#${r}${g}${b}`;
}

async function initHeaderEditor() {
  const themeSel = document.getElementById('theme-select');
  const bpSel = document.getElementById('bp-select');
  const headerBg = document.getElementById('header-bg');
  const headerBorder = document.getElementById('header-border');
  const headerShadow = document.getElementById('header-shadow');
  const headerShadowPreset = document.getElementById('header-shadow-preset');
  const headerBgAdv = document.getElementById('header-bg-adv');
  const logoUrl = document.getElementById('logo-url');
  const logoW = document.getElementById('logo-w');
  const logoH = document.getElementById('logo-h');
  const logoAlt = document.getElementById('logo-alt');
  const buttonsEditor = document.getElementById('buttons-editor');
  const saveBtn = document.getElementById('save-btn');
  const reloadBtn = document.getElementById('reload-btn');
  const previewSelected = document.getElementById('preview-selected');
  const logoUploadBtn = document.getElementById('logo-upload-btn');
  const logoFileInput = document.getElementById('logo-file-input');
  const logoGalleryBtn = document.getElementById('logo-gallery-btn');
  const galleryModal = document.getElementById('gallery-modal');
  const galleryClose = document.getElementById('gallery-close');
  const galleryGrid = document.getElementById('gallery-grid');
  const sidebarCardBg = document.getElementById('sidebar-card-bg');
  const sidebarBg = document.getElementById('sidebar-bg');
  const burgerColor = document.getElementById('burger-color');
  const burgerSize = document.getElementById('burger-size');
  const burgerStrokeWidth = document.getElementById('burger-stroke-width');
  const burgerBg = document.getElementById('burger-bg');
  const burgerBgTransparent = document.getElementById('burger-bg-transparent');
  const burgerPadding = document.getElementById('burger-padding');
  const burgerRadius = document.getElementById('burger-radius');
  
  const previewHeader = document.getElementById('preview-header');
  const previewLogo = document.getElementById('preview-logo');
  const previewButtons = document.getElementById('preview-buttons');
  const previewBurger = document.getElementById('preview-burger');
  const burgerMenuSection = document.getElementById('burger-menu-section');
  const burgerMenuEditor = document.getElementById('burger-menu-editor');
  
  let settings = ensureDefaults(await fetchSettings());
  
  function ctx() {
    return settings[themeSel.value][bpSel.value];
  }
  
  function renderButtonsEditor() {
    const c = ctx();
    const overrides = c.overrides || {};
    const keysOrder = ['explorer','events','excursions','contact','trips'];
    // ensure keys order
    const list = keysOrder
      .map(k => c.buttons.find(b => b.key === k))
      .filter(Boolean);
    buttonsEditor.innerHTML = '';
    list.forEach((btn, idx) => {
      const ov = overrides[btn.key] || {};
      const el = document.createElement('details');
      el.className = 'button-editor';
      el.innerHTML = `
        <summary><i class="fas fa-toggle-on"></i> <span style="min-width:90px;display:inline-block;text-transform:uppercase;">${btn.key}</span>
          <span class="chip">${btn.label}</span>
          <span class="chip small-label">${btn.fontSize}px</span>
        </summary>
        <div class="editor-body">
          <div class="input-row"><label>Label</label><input data-k="${btn.key}" data-f="label" type="text" value="${btn.label}" /></div>
          <div class="input-row"><label>Font Family</label>
            <div style="width:100%;position:relative;">
              <div class="font-selector-wrapper" data-k="${btn.key}">
                <input type="text" class="font-search-input" placeholder="🔍 Search fonts..." style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.3);color:#fff;margin-bottom:4px;font-size:13px;" />
                <select data-k="${btn.key}" data-f="fontFamilyPreset" class="font-family-select" style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.3);color:#fff;font-size:13px;max-height:200px;overflow-y:auto;">
                  <option value="">Loading fonts...</option>
                </select>
                <div style="margin-top:4px;font-size:11px;opacity:0.7;color:#fff;">Or enter custom font family:</div>
                <input data-k="${btn.key}" data-f="fontFamily" type="text" value="${btn.fontFamily || ''}" placeholder="e.g., Arial, Helvetica, sans-serif" style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.3);color:#fff;margin-top:4px;font-size:13px;" />
              </div>
            </div>
          </div>
          <div class="input-row"><label>Selected Effect: Blur</label><input data-k="${btn.key}" data-f="selectedBlur" type="number" min="0" max="20" step="0.5" value="${ov.selectedBlur !== undefined ? ov.selectedBlur : (btn.selectedBlur !== undefined ? btn.selectedBlur : 8)}" /></div>
          <div class="input-row"><label>Selected Effect: Shadow Color</label><input data-k="${btn.key}" data-f="selectedShadowColor" type="color" value="${ov.selectedShadowColor || btn.selectedShadowColor || '#ff6b35'}" /></div>
          <div class="input-row"><label>Selected Effect: Shadow Intensity</label><input data-k="${btn.key}" data-f="selectedShadowIntensity" type="number" min="0" max="1" step="0.1" value="${ov.selectedShadowIntensity !== undefined ? ov.selectedShadowIntensity : (btn.selectedShadowIntensity !== undefined ? btn.selectedShadowIntensity : 0.3)}" /></div>
          <div class="input-row"><label>Font Weight</label>
            <select data-k="${btn.key}" data-f="fontWeight">
              <option value="400" ${Number(btn.fontWeight)===400?'selected':''}>400</option>
              <option value="500" ${Number(btn.fontWeight)===500?'selected':''}>500</option>
              <option value="600" ${Number(btn.fontWeight)===600?'selected':''}>600</option>
              <option value="700" ${Number(btn.fontWeight)===700?'selected':''}>700</option>
              <option value="800" ${Number(btn.fontWeight)===800?'selected':''}>800</option>
            </select>
          </div>
          <div class="input-row"><label>Font Size (px)</label><input data-k="${btn.key}" data-f="fontSize" type="number" min="8" max="48" step="0.1" value="${btn.fontSize}" /></div>
          <div class="input-row"><label>Letter Spacing (em)</label><input data-k="${btn.key}" data-f="letterSpacing" type="number" min="-0.05" max="0.3" step="0.01" value="${btn.letterSpacing||0.05}" /></div>
          <div class="input-row"><label>Uppercase</label><input data-k="${btn.key}" data-f="uppercase" type="checkbox" ${btn.uppercase!==false?'checked':''} /></div>
          <div class="input-row"><label>Text Color</label><input data-k="${btn.key}" data-f="color" type="color" value="${rgbToHex((ov.color||btn.color)||'#ffffff')}" /></div>
          <div class="input-row"><label>BG</label><input data-k="${btn.key}" data-f="bg" type="color" value="${rgbToHex((ov.bg||btn.bg)||'#000000')}" /></div>
          <div class="input-row"><label>Border Color</label><input data-k="${btn.key}" data-f="borderColor" type="color" value="${rgbToHex((ov.borderColor||btn.borderColor)||'#3b3b3b')}" /></div>
          <div class="input-row"><label>Selected BG</label><input data-k="${btn.key}" data-f="selectedBg" type="color" value="${rgbToHex((ov.selectedBg||btn.selectedBg)||'#000000')}" /></div>
          <div class="input-row"><label>Selected Border</label><input data-k="${btn.key}" data-f="selectedBorderColor" type="color" value="${rgbToHex((ov.selectedBorderColor||btn.selectedBorderColor)||'#3b3b3b')}" /></div>
        </div>
      `;
      buttonsEditor.appendChild(el);
    });
    const handleChange = (e) => {
      const key = e.target.getAttribute('data-k');
      const field = e.target.getAttribute('data-f');
      if (!key || !field) return;
      const c = ctx();
      const idx = c.buttons.findIndex(b => b.key === key);
      if (['label','fontFamily'].includes(field)) {
        c.buttons[idx][field] = e.target.value;
      } else if (field === 'fontFamilyPreset') {
        if (e.target.value) {
          const fontValue = e.target.value;
          c.buttons[idx].fontFamily = fontValue;
          const paired = buttonsEditor.querySelector(`input[data-k="${key}"][data-f="fontFamily"]`);
          if (paired) paired.value = fontValue;
          loadGoogleFontIfNeeded(c);
          renderPreview(); // Force preview update
        }
      } else if (field === 'fontFamily') {
        // Custom font family input
        c.buttons[idx].fontFamily = e.target.value;
        loadGoogleFontIfNeeded(c);
        renderPreview(); // Force preview update
      } else if (field === 'fontWeight') {
        c.buttons[idx].fontWeight = Number(e.target.value);
      } else if (field === 'fontSize' || field === 'letterSpacing') {
        c.buttons[idx][field] = Number(e.target.value);
      } else if (field === 'uppercase') {
        c.buttons[idx].uppercase = e.target.checked;
      } else if (field === 'selectedBlur' || field === 'selectedShadowIntensity') {
        // Store in base button config, not overrides
        c.buttons[idx][field] = Number(e.target.value);
      } else if (field === 'selectedShadowColor') {
        // Store in base button config, not overrides
        c.buttons[idx][field] = e.target.value;
      } else {
        c.overrides = c.overrides || {};
        c.overrides[key] = c.overrides[key] || {};
        c.overrides[key][field] = e.target.value;
      }
      renderPreview();
    };
    // Use event delegation for dynamically added elements (including font selectors)
    buttonsEditor.addEventListener('input', (e) => {
      if (e.target.matches('input[data-k], select[data-k]')) {
        handleChange(e);
      }
    });
    buttonsEditor.addEventListener('change', (e) => {
      if (e.target.matches('input[data-k], select[data-k]')) {
        handleChange(e);
      }
    });
  }
  
  function syncForm() {
    const c = ctx();
    const isMobile = bpSel.value === 'mobile';
    
    // Show/hide burger menu editor based on breakpoint
    if (burgerMenuSection) burgerMenuSection.style.display = isMobile ? 'block' : 'none';
    if (burgerMenuEditor) burgerMenuEditor.style.display = isMobile ? 'block' : 'none';
    
    headerBg.value = rgbToHex(c.header.bg || '#1f2937');
    if (headerBgAdv) headerBgAdv.value = c.header.gradient || '';
    headerBorder.value = rgbToHex(c.header.borderColor || '#3b3b3b');
    headerShadow.value = c.header.shadow || '';
    if (sidebarCardBg) sidebarCardBg.value = rgbToHex(c.sidebar?.cardBg || (themeSel.value === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)'));
    if (sidebarBg) sidebarBg.value = rgbToHex(c.sidebar?.sidebarBg || (themeSel.value === 'dark' ? 'rgb(0, 0, 0)' : 'rgb(241, 245, 249)'));
    if (burgerColor) burgerColor.value = rgbToHex(c.burgerMenu?.color || '#ffffff');
    if (burgerSize) burgerSize.value = c.burgerMenu?.size || 24;
    if (burgerStrokeWidth) burgerStrokeWidth.value = c.burgerMenu?.strokeWidth || 2;
    if (burgerBg) {
      const bg = c.burgerMenu?.bg;
      if (bg === 'transparent' || !bg) {
        burgerBg.value = '#000000'; // Use black as placeholder for transparent
      } else {
        burgerBg.value = rgbToHex(bg);
      }
    }
    if (burgerPadding) burgerPadding.value = c.burgerMenu?.padding || 8;
    if (burgerRadius) burgerRadius.value = c.burgerMenu?.borderRadius || 4;
    logoUrl.value = c.logo.url || '/logo.png';
    logoW.value = c.logo.width || 40;
    logoH.value = c.logo.height || 40;
    logoAlt.value = c.logo.alt || 'Discover Gozo';
    renderButtonsEditor();
    renderPreview();
    // Re-initialize font selectors after re-rendering
    setTimeout(() => {
      initFontSelectors(settings, themeSel, bpSel);
      const c = ctx();
      loadGoogleFontIfNeeded(c);
    }, 150);
  }
  
  function renderPreview() {
    const c = ctx();
    const isMobile = bpSel.value === 'mobile';
    
    // header styles
    previewHeader.style.background = c.header.gradient || c.header.bg || '#1f2937';
    previewHeader.style.boxShadow = c.header.shadow || '';
    previewHeader.style.borderColor = c.header.borderColor || 'rgba(255,255,255,0.1)';
    previewHeader.style.borderBottom = '1px solid ' + (c.header.borderColor || 'rgba(255,255,255,0.1)');
    
    // burger menu preview (only show on mobile)
    if (previewBurger) {
      if (isMobile && c.burgerMenu) {
        previewBurger.style.display = 'block';
        const burger = c.burgerMenu;
        previewBurger.innerHTML = '';
        const burgerBtn = document.createElement('button');
        burgerBtn.style.padding = `${burger.padding || 8}px`;
        burgerBtn.style.backgroundColor = burger.bg === 'transparent' ? 'transparent' : (burger.bg || 'transparent');
        burgerBtn.style.borderRadius = `${burger.borderRadius || 4}px`;
        burgerBtn.style.border = 'none';
        burgerBtn.style.cursor = 'pointer';
        const burgerSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        burgerSvg.setAttribute('fill', 'none');
        burgerSvg.setAttribute('viewBox', '0 0 24 24');
        burgerSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        burgerSvg.style.width = `${burger.size || 24}px`;
        burgerSvg.style.height = `${burger.size || 24}px`;
        const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path1.setAttribute('stroke-linecap', 'round');
        path1.setAttribute('stroke-linejoin', 'round');
        path1.setAttribute('stroke', burger.color || '#ffffff');
        path1.setAttribute('stroke-width', String(burger.strokeWidth || 2));
        path1.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');
        burgerSvg.appendChild(path1);
        burgerBtn.appendChild(burgerSvg);
        previewBurger.appendChild(burgerBtn);
      } else {
        previewBurger.style.display = 'none';
      }
    }
    
    // logo
    previewLogo.src = c.logo.url || '/logo.png';
    previewLogo.alt = c.logo.alt || 'Discover Gozo';
    previewLogo.style.width = (c.logo.width || 40) + 'px';
    previewLogo.style.height = (c.logo.height || 40) + 'px';
    // buttons
    previewButtons.innerHTML = '';
    const order = ['explorer','events','excursions','contact','trips'];
    order.forEach(k => {
      const base = c.buttons.find(b => b.key === k);
      if (!base) return;
      const ov = (c.overrides && c.overrides[k]) || {};
      const btn = document.createElement('button');
      btn.className = 'preview-btn';
      const labelText = base.label || k.toUpperCase();
      btn.textContent = base.uppercase===false ? labelText : labelText.toUpperCase();
      btn.style.fontFamily = (ov.fontFamily || base.fontFamily || 'system-ui, sans-serif');
      btn.style.fontWeight = String(base.fontWeight || 700);
      btn.style.fontSize = (base.fontSize || 13.6) + 'px';
      btn.style.letterSpacing = (typeof base.letterSpacing === 'number' ? base.letterSpacing : 0.05) + 'em';
      btn.style.color = ov.color || base.color || '#ffffff';
      const isSelected = previewSelected && previewSelected.value && previewSelected.value === k;
      btn.style.background = isSelected ? (ov.selectedBg || base.selectedBg || ov.bg || base.bg || 'transparent') : (ov.bg || base.bg || 'transparent');
      btn.style.borderColor = isSelected ? (ov.selectedBorderColor || base.selectedBorderColor || ov.borderColor || base.borderColor || 'rgba(255,255,255,0.15)') : (ov.borderColor || base.borderColor || 'rgba(255,255,255,0.15)');
      btn.style.textShadow = base.shadow || '0 2px 4px rgba(0,0,0,0.5)';
      if (isSelected) {
        // Check overrides first, then base config
        const blur = ov.selectedBlur !== undefined ? ov.selectedBlur : (base.selectedBlur !== undefined ? base.selectedBlur : 8);
        const shadowColor = ov.selectedShadowColor || base.selectedShadowColor || '#ff6b35';
        const shadowIntensity = ov.selectedShadowIntensity !== undefined ? ov.selectedShadowIntensity : (base.selectedShadowIntensity !== undefined ? base.selectedShadowIntensity : 0.3);
        const rgb = hexToRgb(shadowColor);
        btn.style.backdropFilter = `blur(${blur}px)`;
        btn.style.boxShadow = `0 4px 12px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${shadowIntensity})`;
        btn.style.border = '1px solid rgba(255,255,255,0.25)';
      }
      previewButtons.appendChild(btn);
    });
    // auth button on the right
    const authEl = document.getElementById('preview-auth');
    if (authEl) {
      authEl.textContent = (Math.random() > 0.5) ? 'LOGIN' : 'LOGOUT';
      authEl.innerHTML = `<i class="fas fa-user"></i> ${authEl.textContent}`;
      // Reset font to default for auth button (don't inherit from menu buttons)
      authEl.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      authEl.style.fontWeight = '600';
    }
  }
  
  themeSel.addEventListener('change', () => {
    syncForm();
    // Update burger editor visibility
    const isMobile = bpSel.value === 'mobile';
    if (burgerMenuSection) burgerMenuSection.style.display = isMobile ? 'block' : 'none';
    if (burgerMenuEditor) burgerMenuEditor.style.display = isMobile ? 'block' : 'none';
  });
  bpSel.addEventListener('change', () => {
    syncForm();
    // Update burger editor visibility
    const isMobile = bpSel.value === 'mobile';
    if (burgerMenuSection) burgerMenuSection.style.display = isMobile ? 'block' : 'none';
    if (burgerMenuEditor) burgerMenuEditor.style.display = isMobile ? 'block' : 'none';
  });
  if (previewSelected) previewSelected.addEventListener('change', renderPreview);
  if (headerShadowPreset) headerShadowPreset.addEventListener('change', () => {
    const c = ctx();
    if (headerShadowPreset.value && !headerShadow.value) {
      c.header.shadow = headerShadowPreset.value;
      headerShadow.value = c.header.shadow;
      renderPreview();
    }
  });
  [headerBg, headerBgAdv, headerBorder, headerShadow, logoUrl, logoW, logoH, logoAlt].forEach(inp => inp && inp.addEventListener('input', () => {
    const c = ctx();
    c.header.bg = headerBg.value;
    if (headerBgAdv) c.header.gradient = headerBgAdv.value || null;
    c.header.borderColor = headerBorder.value;
    c.header.shadow = headerShadow.value;
    c.logo.url = logoUrl.value;
    c.logo.width = Number(logoW.value) || 40;
    c.logo.height = Number(logoH.value) || 40;
    c.logo.alt = logoAlt.value || 'Discover Gozo';
    renderPreview();
  }));
  
  // Helper to convert hex to rgb
  function hexToRgbString(hex) {
    if (!hex) return 'rgb(0, 0, 0)';
    if (hex.startsWith('rgb')) return hex;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return 'rgb(0, 0, 0)';
    return `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})`;
  }
  
  // Sidebar color inputs
  if (sidebarCardBg) {
    sidebarCardBg.addEventListener('input', () => {
      const c = ctx();
      if (!c.sidebar) c.sidebar = {};
      // Convert hex to rgb for consistency with defaults
      c.sidebar.cardBg = hexToRgbString(sidebarCardBg.value);
      renderPreview();
    });
  }
  if (sidebarBg) {
    sidebarBg.addEventListener('input', () => {
      const c = ctx();
      if (!c.sidebar) c.sidebar = {};
      // Convert hex to rgb for consistency with defaults
      c.sidebar.sidebarBg = hexToRgbString(sidebarBg.value);
      renderPreview();
    });
  }
  
  // Burger menu inputs
  if (burgerColor) {
    burgerColor.addEventListener('input', () => {
      const c = ctx();
      if (!c.burgerMenu) c.burgerMenu = {};
      c.burgerMenu.color = burgerColor.value;
      renderPreview();
    });
  }
  if (burgerSize) {
    burgerSize.addEventListener('input', () => {
      const c = ctx();
      if (!c.burgerMenu) c.burgerMenu = {};
      c.burgerMenu.size = Number(burgerSize.value) || 24;
      renderPreview();
    });
  }
  if (burgerStrokeWidth) {
    burgerStrokeWidth.addEventListener('input', () => {
      const c = ctx();
      if (!c.burgerMenu) c.burgerMenu = {};
      c.burgerMenu.strokeWidth = Number(burgerStrokeWidth.value) || 2;
      renderPreview();
    });
  }
  if (burgerBg) {
    burgerBg.addEventListener('input', () => {
      const c = ctx();
      if (!c.burgerMenu) c.burgerMenu = {};
      // Allow transparent or convert hex to rgb
      if (burgerBg.value === '#000000') {
        c.burgerMenu.bg = 'transparent';
      } else {
        c.burgerMenu.bg = hexToRgbString(burgerBg.value);
      }
      renderPreview();
    });
  }
  if (burgerPadding) {
    burgerPadding.addEventListener('input', () => {
      const c = ctx();
      if (!c.burgerMenu) c.burgerMenu = {};
      c.burgerMenu.padding = Number(burgerPadding.value) || 8;
      renderPreview();
    });
  }
  if (burgerRadius) {
    burgerRadius.addEventListener('input', () => {
      const c = ctx();
      if (!c.burgerMenu) c.burgerMenu = {};
      c.burgerMenu.borderRadius = Number(burgerRadius.value) || 4;
      renderPreview();
    });
  }
  if (burgerBgTransparent) {
    burgerBgTransparent.addEventListener('click', () => {
      const c = ctx();
      if (!c.burgerMenu) c.burgerMenu = {};
      c.burgerMenu.bg = 'transparent';
      if (burgerBg) burgerBg.value = '#000000';
      renderPreview();
    });
  }
  
  // ===== PAGE BACKGROUND EDITOR =====
  console.log('🎨 [PAGE BG] Initializing Page Background Editor...');
  
  const editorsContainer = document.getElementById('page-background-editors');
  if (!editorsContainer) {
    console.error('❌ [PAGE BG] Container not found! Looking for #page-background-editors');
    console.error('❌ [PAGE BG] Available elements:', document.querySelectorAll('[id*="page"], [id*="background"]'));
    return;
  }
  
  console.log('✅ [PAGE BG] Container found:', editorsContainer);
  
  const pages = ['explorer', 'events', 'excursions', 'contact', 'trips'];
  const themes = ['light', 'dark'];
  
  // Ensure pageBackgrounds exists
  if (!settings.pageBackgrounds) {
    settings.pageBackgrounds = {};
  }
  
  // Get config for a specific page/theme
  function getPageBgConfig(page, theme) {
    const key = `${page}_${theme}`;
    if (!settings.pageBackgrounds[key]) {
      settings.pageBackgrounds[key] = {
        type: 'gradient',
        direction: 'to bottom right',
        stops: [
          { color: '#ffffff', position: 0 },
          { color: '#a5f3fc', position: 50 },
          { color: '#fecaaf', position: 100 }
        ]
      };
    }
    const config = settings.pageBackgrounds[key];
    if (config.type === 'gradient' && (!config.stops || !Array.isArray(config.stops) || config.stops.length === 0)) {
      config.stops = [
        { color: '#ffffff', position: 0 },
        { color: '#a5f3fc', position: 50 },
        { color: '#fecaaf', position: 100 }
      ];
    }
    return config;
  }
  
  // Generate CSS from config
  function generateCSS(config) {
    if (config.type === 'solid') {
      return config.color || '#ffffff';
    }
    if (config.custom && config.custom.trim()) {
      return config.custom.trim();
    }
    const stops = config.stops || [];
    if (stops.length === 0) return '';
    const stopStrings = stops.map(s => {
      let color = s.color || '#ffffff';
      if (!color.startsWith('#') && !color.startsWith('rgb') && !color.startsWith('rgba')) {
        color = color.includes(',') ? `rgb(${color})` : `#${color}`;
      }
      return `${color} ${s.position || 0}%`;
    });
    if (config.direction === 'radial') {
      return `radial-gradient(circle, ${stopStrings.join(', ')})`;
    }
    return `linear-gradient(${config.direction || 'to bottom right'}, ${stopStrings.join(', ')})`;
  }
  
  // Render editor for one page/theme
  function renderEditor(page, theme) {
    const config = getPageBgConfig(page, theme);
    const key = `${page}_${theme}`;
    const pageName = page.charAt(0).toUpperCase() + page.slice(1);
    const themeName = theme.charAt(0).toUpperCase() + theme.slice(1);
    
    const editorDiv = document.createElement('div');
    editorDiv.className = `page-bg-editor-${key}`;
    editorDiv.style.cssText = 'background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px;';
    
    editorDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; cursor: pointer;" class="editor-toggle">
        <h3 style="margin: 0; color: #fff; font-size: 18px;">
          <i class="fas fa-${page === 'explorer' ? 'map' : page === 'events' ? 'calendar-alt' : page === 'excursions' ? 'route' : page === 'contact' ? 'envelope' : 'suitcase'}"></i> ${pageName} - <i class="fas fa-${theme === 'dark' ? 'moon' : 'sun'}"></i> ${themeName} Theme
        </h3>
        <span class="toggle-text" style="color: rgba(255,255,255,0.7); user-select: none;">Collapse <i class="fas fa-chevron-up"></i></span>
      </div>
      
      <div class="editor-content" style="display: block !important;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
          <!-- Left: Controls -->
          <div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 8px; color: rgba(255,255,255,0.9); font-weight: 500;"><i class="fas fa-sliders-h"></i> Background Type</label>
              <select class="bg-type-select" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: #fff; font-size: 14px;">
                <option value="solid" ${config.type === 'solid' ? 'selected' : ''}>Solid Color</option>
                <option value="gradient" ${config.type === 'gradient' ? 'selected' : ''}>Gradient</option>
              </select>
            </div>
            
            <!-- Solid Color Editor -->
            <div class="solid-color-editor" style="display: ${config.type === 'solid' ? 'block' : 'none'}; margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 8px; color: rgba(255,255,255,0.9); font-weight: 500;"><i class="fas fa-tint"></i> Color</label>
              <div style="display: flex; align-items: center; gap: 12px;">
                <input type="color" class="color-picker" value="${config.color || '#ffffff'}" 
                       style="width: 70px; height: 50px; border: 2px solid rgba(255,255,255,0.2); border-radius: 8px; cursor: pointer;" />
                <input type="text" class="color-text" value="${config.color || '#ffffff'}" 
                       style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: #fff; font-size: 14px; font-family: monospace;" />
              </div>
            </div>
            
            <!-- Gradient Editor -->
            <div class="gradient-editor" style="display: ${config.type === 'gradient' ? 'block' : 'none'};">
              <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 8px; color: rgba(255,255,255,0.9); font-weight: 500;"><i class="fas fa-arrows-alt"></i> Direction</label>
                <select class="gradient-direction" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: #fff; font-size: 14px;">
                  <option value="to right" ${config.direction === 'to right' ? 'selected' : ''}>To Right (→)</option>
                  <option value="to left" ${config.direction === 'to left' ? 'selected' : ''}>To Left (←)</option>
                  <option value="to bottom" ${config.direction === 'to bottom' ? 'selected' : ''}>To Bottom (↓)</option>
                  <option value="to top" ${config.direction === 'to top' ? 'selected' : ''}>To Top (↑)</option>
                  <option value="to bottom right" ${config.direction === 'to bottom right' ? 'selected' : ''}>To Bottom Right (↘)</option>
                  <option value="to bottom left" ${config.direction === 'to bottom left' ? 'selected' : ''}>To Bottom Left (↙)</option>
                  <option value="to top right" ${config.direction === 'to top right' ? 'selected' : ''}>To Top Right (↗)</option>
                  <option value="to top left" ${config.direction === 'to top left' ? 'selected' : ''}>To Top Left (↖)</option>
                  <option value="radial" ${config.direction === 'radial' ? 'selected' : ''}>Radial (Circle)</option>
                </select>
              </div>
              
              <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 8px; color: rgba(255,255,255,0.9); font-weight: 500;"><i class="fas fa-palette"></i> Color Stops</label>
                <div class="gradient-stops" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px;">
                  <!-- Will be populated -->
                </div>
                <button type="button" class="add-stop-btn" 
                        style="padding: 8px 16px; border-radius: 8px; background: rgba(255,107,53,0.2); border: 1px solid rgba(255,107,53,0.5); color: #ff6b35; cursor: pointer; font-weight: 500; width: 100%;">
                  <i class="fas fa-plus"></i> Add Color Stop
                </button>
              </div>
              
              <div>
                <label style="display: block; margin-bottom: 8px; color: rgba(255,255,255,0.9); font-weight: 500;"><i class="fas fa-code"></i> Custom CSS (Optional)</label>
                <input type="text" class="gradient-custom" value="${config.custom || ''}" 
                       placeholder="linear-gradient(...)" 
                       style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: #fff; font-size: 14px; font-family: monospace;" />
              </div>
            </div>
          </div>
          
          <!-- Right: Preview -->
          <div>
            <label style="display: block; margin-bottom: 8px; color: rgba(255,255,255,0.9); font-weight: 500;"><i class="fas fa-eye"></i> Live Preview</label>
            <div class="preview-box" style="width: 100%; height: 200px; border-radius: 12px; border: 2px solid rgba(255,255,255,0.2); margin-bottom: 15px; transition: all 0.3s ease;"></div>
            <div class="preview-css" style="padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; font-family: monospace; font-size: 11px; color: rgba(255,255,255,0.7); word-break: break-all; min-height: 40px;"></div>
          </div>
        </div>
      </div>
    `;
    
    editorsContainer.appendChild(editorDiv);
    console.log(`✅ [PAGE BG] Added editor for ${page}_${theme}`);
    
    // Setup this editor immediately
    setupEditor(editorDiv, page, theme, config);
    
    // Force content visible
    const content = editorDiv.querySelector('.editor-content');
    if (content) {
      content.style.display = 'block';
      content.style.visibility = 'visible';
      content.style.opacity = '1';
      content.style.height = 'auto';
    }
  }
  
  // Setup event listeners for one editor
  function setupEditor(editorDiv, page, theme, config) {
    const key = `${page}_${theme}`;
    const content = editorDiv.querySelector('.editor-content');
    const toggleBtn = editorDiv.querySelector('.editor-toggle');
    const toggleText = editorDiv.querySelector('.toggle-text');
    const bgTypeSelect = editorDiv.querySelector('.bg-type-select');
    const solidEditor = editorDiv.querySelector('.solid-color-editor');
    const gradientEditor = editorDiv.querySelector('.gradient-editor');
    const colorPicker = editorDiv.querySelector('.color-picker');
    const colorText = editorDiv.querySelector('.color-text');
    const gradientDirection = editorDiv.querySelector('.gradient-direction');
    const gradientStops = editorDiv.querySelector('.gradient-stops');
    const addStopBtn = editorDiv.querySelector('.add-stop-btn');
    const gradientCustom = editorDiv.querySelector('.gradient-custom');
    const previewBox = editorDiv.querySelector('.preview-box');
    const previewCss = editorDiv.querySelector('.preview-css');
    
    // Ensure content is visible initially - FORCE IT
    if (content) {
      content.setAttribute('style', 'display: block !important; visibility: visible !important; opacity: 1 !important; height: auto !important;');
      console.log(`✅ [PAGE BG] Content for ${key} forced visible`);
    } else {
      console.error(`❌ [PAGE BG] Content element not found for ${key}`);
    }
    
    // Toggle expand/collapse
    if (toggleBtn && content) {
      toggleBtn.addEventListener('click', () => {
        const isOpen = content.style.display !== 'none' && content.style.display !== '';
        content.style.display = isOpen ? 'none' : 'block';
        content.style.visibility = isOpen ? 'hidden' : 'visible';
        if (toggleText) {
          toggleText.innerHTML = isOpen ? 'Configure <i class="fas fa-chevron-down"></i>' : 'Collapse <i class="fas fa-chevron-up"></i>';
        }
      });
    }
    
    // Update preview function
    function updatePreview() {
      const css = generateCSS(config);
      if (previewBox) previewBox.style.background = css;
      if (previewCss) previewCss.textContent = css || 'No background set';
    }
    
    // Render gradient stops
    function renderStops() {
      if (!gradientStops) return;
      gradientStops.innerHTML = '';
      const stops = config.stops || [];
      
      stops.forEach((stop, idx) => {
        const stopDiv = document.createElement('div');
        stopDiv.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);';
        stopDiv.innerHTML = `
          <span style="color: rgba(255,255,255,0.7); font-weight: 500; min-width: 50px;">${idx + 1}</span>
          <input type="color" class="stop-color" data-idx="${idx}" value="${stop.color || '#ffffff'}" 
                 style="width: 50px; height: 40px; border: 2px solid rgba(255,255,255,0.2); border-radius: 6px; cursor: pointer;" />
          <input type="text" class="stop-color-text" data-idx="${idx}" value="${stop.color || '#ffffff'}" 
                 style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: #fff; font-family: monospace; font-size: 12px;" />
          <input type="number" class="stop-position" data-idx="${idx}" value="${stop.position || 0}" min="0" max="100" 
                 style="width: 70px; padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: #fff; text-align: center;" />
          <span style="color: rgba(255,255,255,0.7);">%</span>
          ${stops.length > 2 ? `<button type="button" class="remove-stop" data-idx="${idx}" 
                 style="padding: 8px 12px; border-radius: 6px; background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.5); color: #ef4444; cursor: pointer;">
                 <i class="fas fa-times"></i></button>` : '<div style="width: 50px;"></div>'}
        `;
        gradientStops.appendChild(stopDiv);
        
        // Attach listeners
        const colorPicker = stopDiv.querySelector('.stop-color');
        const colorText = stopDiv.querySelector('.stop-color-text');
        const position = stopDiv.querySelector('.stop-position');
        const removeBtn = stopDiv.querySelector('.remove-stop');
        
        if (colorPicker) {
          colorPicker.addEventListener('input', (e) => {
            config.stops[idx].color = e.target.value;
            if (colorText) colorText.value = e.target.value;
            updatePreview();
          });
        }
        if (colorText) {
          colorText.addEventListener('input', (e) => {
            config.stops[idx].color = e.target.value;
            if (colorPicker) colorPicker.value = e.target.value;
            updatePreview();
          });
        }
        if (position) {
          position.addEventListener('input', (e) => {
            config.stops[idx].position = Number(e.target.value);
            updatePreview();
          });
        }
        if (removeBtn) {
          removeBtn.addEventListener('click', () => {
            config.stops.splice(idx, 1);
            renderStops();
            updatePreview();
          });
        }
      });
    }
    
    // Event listeners
    if (bgTypeSelect) {
      bgTypeSelect.addEventListener('change', (e) => {
        config.type = e.target.value;
        if (solidEditor) solidEditor.style.display = config.type === 'solid' ? 'block' : 'none';
        if (gradientEditor) gradientEditor.style.display = config.type === 'gradient' ? 'block' : 'none';
        updatePreview();
      });
    }
    
    if (colorPicker && colorText) {
      colorPicker.addEventListener('input', (e) => {
        config.color = e.target.value;
        colorText.value = e.target.value;
        updatePreview();
      });
      colorText.addEventListener('input', (e) => {
        config.color = e.target.value;
        colorPicker.value = e.target.value;
        updatePreview();
      });
    }
    
    if (gradientDirection) {
      gradientDirection.addEventListener('change', (e) => {
        config.direction = e.target.value;
        updatePreview();
      });
    }
    
    if (addStopBtn) {
      addStopBtn.addEventListener('click', () => {
        if (!config.stops) config.stops = [];
        const lastStop = config.stops[config.stops.length - 1];
        const newPosition = lastStop ? Math.min(100, (lastStop.position || 0) + 10) : 100;
        config.stops.push({ color: '#ffffff', position: newPosition });
        renderStops();
        updatePreview();
      });
    }
    
    if (gradientCustom) {
      gradientCustom.addEventListener('input', (e) => {
        config.custom = e.target.value;
        updatePreview();
      });
    }
    
    // Initial render
    renderStops();
    updatePreview();
  }
  
  // Render all editors
  console.log('🎨 [PAGE BG] Rendering editors for', pages.length * themes.length, 'combinations...');
  try {
    pages.forEach(page => {
      themes.forEach(theme => {
        try {
          renderEditor(page, theme);
        } catch (err) {
          console.error(`❌ [PAGE BG] Error rendering ${page}_${theme}:`, err);
        }
      });
    });
    
    console.log('✅ [PAGE BG] Page Background Editor initialized');
    console.log('✅ [PAGE BG] Container children count:', editorsContainer.children.length);
    
    // Force show all content initially
    const allContent = editorsContainer.querySelectorAll('.editor-content');
    console.log('✅ [PAGE BG] Found', allContent.length, 'content divs');
    allContent.forEach((content, idx) => {
      content.style.display = 'block';
      content.style.visibility = 'visible';
      content.style.opacity = '1';
      console.log(`✅ [PAGE BG] Content ${idx} set to visible`);
    });
  } catch (err) {
    console.error('❌ [PAGE BG] Error during initialization:', err);
  }
  
  // Make sync function available
  window.syncPageBgForm = function() {
    // Re-render all editors
    editorsContainer.innerHTML = '';
    pages.forEach(page => {
      themes.forEach(theme => {
        renderEditor(page, theme);
      });
    });
  };

  reloadBtn.addEventListener('click', async () => {
    settings = await fetchSettings();
    syncForm();
    if (typeof syncPageBgForm === 'function') {
      syncPageBgForm();
    }
    alert('Reloaded.');
  });
  saveBtn.addEventListener('click', async () => {
    try {
      // Ensure pageBackgrounds exists before saving
      if (!settings.pageBackgrounds) {
        settings.pageBackgrounds = {};
      }
      
      // Debug: Log what we're saving
      console.log('[PAGE BG] Saving settings with pageBackgrounds:', JSON.stringify(settings.pageBackgrounds, null, 2));
      console.log('[PAGE BG] Full settings object keys:', Object.keys(settings));
      
      const res = await fetch('/api/settings/header', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings)
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Save failed:', errorText);
        throw new Error(errorText);
      }
      const savedSettings = await res.json();
      settings = savedSettings;
      console.log('Settings saved successfully:', savedSettings);
      alert('✅ Saved header settings');
          // Notify frontend tabs to refresh settings (storage + BroadcastChannel)
          try {
            localStorage.setItem('dg_header_settings_updated', String(Date.now()));
          } catch {}
          try {
            const bc = new BroadcastChannel('dg-header');
            bc.postMessage({ type: 'header-settings-updated', at: Date.now() });
            bc.close();
          } catch {}
    } catch (e) {
      console.error('Save error:', e);
      alert('❌ Save failed: ' + (e.message || e));
    }
  });
  
  syncForm();
  
  // Initialize font selectors after buttons are rendered
  setTimeout(() => {
    initFontSelectors(settings, themeSel, bpSel);
    const c = ctx();
    loadGoogleFontIfNeeded(c);
  }, 200);
  
  // Also initialize when theme/breakpoint changes
  themeSel.addEventListener('change', () => {
    setTimeout(() => {
      initFontSelectors(settings, themeSel, bpSel);
      const c = ctx();
      loadGoogleFontIfNeeded(c);
    }, 100);
  });
  
  bpSel.addEventListener('change', () => {
    setTimeout(() => {
      initFontSelectors(settings, themeSel, bpSel);
      const c = ctx();
      loadGoogleFontIfNeeded(c);
    }, 100);
  });

  // Logo upload
  if (logoUploadBtn && logoFileInput) {
    logoUploadBtn.addEventListener('click', () => logoFileInput.click());
    logoFileInput.addEventListener('change', async () => {
      const file = logoFileInput.files && logoFileInput.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('image', file);
      // Optional: specify subfolder
      fd.append('folder', 'branding');
      try {
        const res = await fetch('/api/admin/upload-image', {
          method: 'POST',
          credentials: 'include',
          body: fd
        });
        if (!res.ok) {
          const errorText = await res.text();
          console.error('Upload failed:', errorText);
          throw new Error(errorText || 'Upload failed');
        }
        const data = await res.json();
        if (!data.imageUrl) {
          throw new Error('No image URL returned');
        }
        logoUrl.value = data.imageUrl;
        const c = ctx();
        c.logo.url = data.imageUrl;
        renderPreview();
        alert('✅ Image uploaded successfully');
      } catch (e) {
        console.error('Upload error:', e);
        const errorMsg = e.message || 'Unknown error';
        if (errorMsg.includes('401') || errorMsg.includes('Authentication')) {
          alert('❌ Authentication required. Please log in to the admin panel first.');
          window.location.href = '/admin-login.html';
        } else {
          alert('Upload failed: ' + errorMsg);
        }
      } finally {
        logoFileInput.value = '';
      }
    });
  }

  // Gallery picker
  if (logoGalleryBtn && galleryModal && galleryGrid) {
    logoGalleryBtn.addEventListener('click', async () => {
      galleryModal.style.display = 'block';
      galleryGrid.innerHTML = '<div class="loading">Loading images...</div>';
      try {
        const res = await fetch('/api/image-gallery/list?limit=200', { credentials: 'include' });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to load gallery');
        }
        const images = (data.images || []).slice(0, 400);
        if (images.length === 0) {
          galleryGrid.innerHTML = '<div class="loading">No images found in gallery.</div>';
          return;
        }
        galleryGrid.innerHTML = '';
        images.forEach(img => {
          const card = document.createElement('div');
          card.style.border = '1px solid rgba(255,255,255,0.12)';
          card.style.borderRadius = '8px';
          card.style.overflow = 'hidden';
          card.style.cursor = 'pointer';
          card.style.transition = 'transform 0.2s';
          card.onmouseenter = () => card.style.transform = 'scale(1.05)';
          card.onmouseleave = () => card.style.transform = 'scale(1)';
          const imgPath = img.path || img.url || '';
          card.innerHTML = `<img src="${imgPath}" style="width:100%;height:90px;object-fit:cover;display:block" alt="${img.filename || 'image'}" onerror="this.parentElement.innerHTML='<div style=\\'padding:20px;text-align:center;opacity:0.6\\'>Failed to load</div>'" />`;
          card.addEventListener('click', () => {
            logoUrl.value = imgPath;
            const c = ctx();
            c.logo.url = imgPath;
            renderPreview();
            galleryModal.style.display = 'none';
          });
          galleryGrid.appendChild(card);
        });
      } catch (e) {
        console.error('Gallery error:', e);
        const errorMsg = e.message || 'Unknown error';
        if (errorMsg.includes('401') || errorMsg.includes('Authentication')) {
          galleryGrid.innerHTML = `<div class="error" style="padding:20px;text-align:center;color:#ef4444;">Authentication required. <a href="/admin-login.html" style="color:#3b82f6;text-decoration:underline;">Please log in</a></div>`;
        } else {
          galleryGrid.innerHTML = `<div class="error" style="padding:20px;text-align:center;color:#ef4444;">Failed to load gallery: ${errorMsg}</div>`;
        }
      }
    });
    if (galleryClose) {
      galleryClose.addEventListener('click', () => (galleryModal.style.display = 'none'));
    }
    galleryModal.addEventListener('click', (e) => {
      if (e.target === galleryModal) galleryModal.style.display = 'none';
    });
  }
}

async function fetchSettings() {
  const res = await fetch('/api/settings/header', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 107, b: 53 };
}

function ensureDefaults(s) {
  const clone = JSON.parse(JSON.stringify(s || {}));
  const ensureCtx = (isDark = false) => ({
    header: { bg: '#1f2937', gradient: null, shadow: '', borderColor: 'rgba(255,255,255,0.1)' },
    logo: { url: '/logo.png', width: 40, height: 40, alt: 'Discover Gozo' },
    buttons: [
      baseBtn('explorer','EXPLORER','#ff6b35'),
      baseBtn('events','EVENTS','#ff6b35'),
      baseBtn('excursions','EXCURSIONS','#ff6b35'),
      baseBtn('contact','CONTACT US','#ff6b35'),
      baseBtn('trips','MY TRIPS','#40e0d0')
    ],
    overrides: {},
    sidebar: isDark 
      ? { cardBg: 'rgb(30, 41, 59)', sidebarBg: 'rgb(0, 0, 0)' }
      : { cardBg: 'rgb(255, 255, 255)', sidebarBg: 'rgb(241, 245, 249)' },
    burgerMenu: { color: '#ffffff', size: 24, strokeWidth: 2, bg: 'transparent', padding: 8, borderRadius: 4 }
  });
  function baseBtn(key,label,color) {
    return { key, label, fontFamily: 'Special Gothic Expanded One, system-ui, sans-serif', fontWeight: 700, fontSize: 13.6, letterSpacing: 0.05, uppercase: true, color, bg: 'transparent', borderColor: 'rgba(255,255,255,0.15)', selectedBg: color === '#40e0d0' ? 'rgba(64,224,208,0.25)' : 'rgba(255,107,53,0.25)', selectedBorderColor: 'rgba(255,255,255,0.25)' };
  }
  if (!clone.light) clone.light = { mobile: ensureCtx(false), desktop: ensureCtx(false) };
  if (!clone.dark) clone.dark = { mobile: ensureCtx(true), desktop: ensureCtx(true) };
  if (!clone.light.mobile) clone.light.mobile = ensureCtx(false);
  if (!clone.light.desktop) clone.light.desktop = ensureCtx(false);
  if (!clone.dark.mobile) clone.dark.mobile = ensureCtx(true);
  if (!clone.dark.desktop) clone.dark.desktop = ensureCtx(true);
  // Ensure sidebar exists for all contexts
  ['light', 'dark'].forEach(theme => {
    ['mobile', 'desktop'].forEach(bp => {
      if (!clone[theme] || !clone[theme][bp]) return;
      if (!clone[theme][bp].sidebar) {
        clone[theme][bp].sidebar = theme === 'dark'
          ? { cardBg: 'rgb(30, 41, 59)', sidebarBg: 'rgb(0, 0, 0)' }
          : { cardBg: 'rgb(255, 255, 255)', sidebarBg: 'rgb(241, 245, 249)' };
      }
      if (!clone[theme][bp].burgerMenu) {
        clone[theme][bp].burgerMenu = { color: '#ffffff', size: 24, strokeWidth: 2, bg: 'transparent', padding: 8, borderRadius: 4 };
      }
    });
  });
  // Ensure pageBackgrounds exists
  if (!clone.pageBackgrounds) clone.pageBackgrounds = {};
  return clone;
}

// Comprehensive list of popular Google Fonts
const GOOGLE_FONTS = [
  'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald', 'Raleway', 'Poppins', 'Source Sans Pro',
  'Roboto Condensed', 'Slabo 27px', 'Merriweather', 'PT Sans', 'Ubuntu', 'Playfair Display',
  'Lora', 'Roboto Slab', 'Droid Sans', 'Droid Serif', 'Noto Sans', 'PT Serif', 'Arimo',
  'Bitter', 'Cabin', 'Dosis', 'Fjalla One', 'Indie Flower', 'Lobster', 'Nunito', 'Oxygen',
  'Quicksand', 'Raleway Dots', 'Titillium Web', 'Yanone Kaffeesatz', 'Abel', 'Anton',
  'Bebas Neue', 'Crimson Text', 'Dancing Script', 'Exo', 'Fira Sans', 'Great Vibes',
  'Josefin Sans', 'Kalam', 'Libre Baskerville', 'Maven Pro', 'Muli', 'Pacifico',
  'Permanent Marker', 'Righteous', 'Satisfy', 'Shadows Into Light', 'Teko', 'Varela Round',
  'Work Sans', 'Abril Fatface', 'Amatic SC', 'Barlow', 'Comfortaa', 'Crete Round',
  'EB Garamond', 'Fira Code', 'Fredoka One', 'Gloria Hallelujah', 'Inconsolata', 'Kaushan Script',
  'Lilita One', 'Lobster Two', 'Luckiest Guy', 'Merriweather Sans', 'Mukta', 'Nunito Sans',
  'Orbitron', 'Overpass', 'Patua One', 'Playfair Display SC', 'Press Start 2P', 'Quattrocento',
  'Rajdhani', 'Rokkitt', 'Rubik', 'Saira', 'Sarabun', 'Signika', 'Space Mono', 'Spectral',
  'Tajawal', 'Tangerine', 'Trirong', 'Vollkorn', 'Zilla Slab', 'Special Gothic Expanded One',
  'Inter', 'Manrope', 'DM Sans', 'Plus Jakarta Sans', 'Outfit', 'Sora', 'Figtree',
  'Geist', 'Cabinet Grotesk', 'Clash Display', 'Satoshi', 'Chillax', 'Pilcrow Rounded'
];

function loadGoogleFontIfNeeded(ctx) {
  const families = new Set((ctx.buttons || []).map(b => {
    const font = (b.fontFamily || '').split(',')[0].trim();
    return font;
  }).filter(Boolean));
  
  families.forEach(f => {
    // Check if it's a Google Font (not system fonts)
    if (GOOGLE_FONTS.some(gf => f.includes(gf) || gf.includes(f))) {
      const fontName = GOOGLE_FONTS.find(gf => f.includes(gf) || gf.includes(f)) || f;
      const id = `gf-${fontName.replace(/\s+/g,'-').toLowerCase().replace(/[^a-z0-9-]/g, '')}`;
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        const familyParam = fontName.replace(/\s+/g, '+') + ':wght@400;500;600;700;800;900';
        link.href = `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`;
        document.head.appendChild(link);
      }
    }
  });
}

function initFontSelectors(settingsRef, themeSelRef, bpSelRef) {
  const wrappers = document.querySelectorAll('.font-selector-wrapper');
  if (wrappers.length === 0) {
    console.log('No font selector wrappers found');
    return;
  }
  
  wrappers.forEach(wrapper => {
    const key = wrapper.getAttribute('data-k');
    const searchInput = wrapper.querySelector('.font-search-input');
    const select = wrapper.querySelector('.font-family-select');
    const customInput = wrapper.querySelector('input[data-f="fontFamily"]');
    
    if (!searchInput || !select || !customInput) {
      console.log('Font selector elements not found for', key);
      return;
    }
    
    // Remove existing event listeners by cloning
    const newSearchInput = searchInput.cloneNode(true);
    const newSelect = select.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    select.parentNode.replaceChild(newSelect, select);
    
    // Populate font dropdown
    newSelect.innerHTML = '<option value="">-- Select a Google Font --</option>';
    GOOGLE_FONTS.sort().forEach(font => {
      const option = document.createElement('option');
      option.value = `${font}, system-ui, sans-serif`;
      option.textContent = font;
      option.style.display = 'block'; // Make sure all options are visible by default
      newSelect.appendChild(option);
    });
    
    // Set current value
    try {
      if (!settingsRef || !themeSelRef || !bpSelRef) {
        console.log('Settings or selectors not available');
        return;
      }
      const ctx = settingsRef[themeSelRef.value][bpSelRef.value];
      const btn = ctx.buttons.find(b => b.key === key);
      if (btn && btn.fontFamily) {
        const fontName = btn.fontFamily.split(',')[0].trim();
        const matchingOption = Array.from(newSelect.options).find(opt => opt.textContent === fontName);
        if (matchingOption) {
          newSelect.value = matchingOption.value;
        } else {
          customInput.value = btn.fontFamily;
        }
      }
    } catch (e) {
      console.error('Error setting font value:', e);
    }
    
    // Search functionality - filter dropdown options
    newSearchInput.addEventListener('input', (e) => {
      const search = e.target.value.toLowerCase().trim();
      const options = Array.from(newSelect.options);
      let visibleCount = 0;
      
      options.forEach((opt, idx) => {
        if (idx === 0) {
          // Always show the first option (placeholder)
          opt.style.display = 'block';
        } else if (!search) {
          // If no search, show all fonts
          opt.style.display = 'block';
          visibleCount++;
        } else {
          // Filter by search term
          const matches = opt.textContent.toLowerCase().includes(search);
          opt.style.display = matches ? 'block' : 'none';
          if (matches) visibleCount++;
        }
      });
      
      // Update placeholder if no results
      if (search && visibleCount === 0) {
        options[0].textContent = '-- No fonts found --';
      } else if (options[0].textContent.includes('No fonts')) {
        options[0].textContent = '-- Select a Google Font --';
      }
    });
    
    // Select change handler
    newSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        customInput.value = e.target.value;
        const changeEvent = new Event('change', { bubbles: true });
        customInput.dispatchEvent(changeEvent);
      }
    });
  });
  
  console.log(`Initialized ${wrappers.length} font selectors`);
}



