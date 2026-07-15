Add this to the URL in Browser Bookmark:
```
javascript:(function(){
  const STORAGE_KEY = 'multi_ai_search_prefs';
  
  /* 1. Default Search Engines */
  const DEFAULT_ENGINES = [
    { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/?q=%s', checked: true },
    { id: 'gemini', name: 'Google Gemini', url: 'https://gemini.google.com/app?q=%s', checked: true },
    { id: 'brave', name: 'Brave AI', url: 'https://search.brave.com/ask?q=%s', checked: true },
    { id: 'google_ai', name: 'Google AI', url: 'https://www.google.com/search?udm=50&q=%s', checked: false },
    { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/search?q=%s', checked: false }
  ];

  /* 2. Load Preferences */
  let engines = [...DEFAULT_ENGINES];
  const savedData = localStorage.getItem(STORAGE_KEY);
  if (savedData) {
    try {
      const parsed = JSON.parse(savedData);
      /* Merge saved preferences with defaults, preserving custom engines */
      const merged = [];
      parsed.forEach(saved => {
        const foundDefault = DEFAULT_ENGINES.find(d => d.id === saved.id);
        if (foundDefault) {
          merged.push({ ...foundDefault, checked: saved.checked });
        } else {
          merged.push(saved); /* Restore custom engine */
        }
      });
      /* Add any defaults that weren't in saved settings */
      DEFAULT_ENGINES.forEach(d => {
        if (!merged.find(m => m.id === d.id)) {
          merged.push(d);
        }
      });
      engines = merged;
    } catch(e) {
      console.error("Failed to parse stored search preferences", e);
    }
  }

  /* Remove any existing panel if clicked twice */
  const existing = document.getElementById('multi-search-container');
  if (existing) existing.remove();

  /* 3. Build UI Overlay */
  const container = document.createElement('div');
  container.id = 'multi-search-container';
  Object.assign(container.style, {
    position: 'fixed', top: '20px', right: '20px', width: '380px',
    backgroundColor: '#1e1e2e', color: '#cdd6f4', fontFamily: 'system-ui, -apple-system, sans-serif',
    borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', padding: '20px',
    zIndex: '2147483647', border: '1px solid #45475a', boxSizing: 'border-box'
  });

  /* Title & Close Button */
  const header = document.createElement('div');
  header.innerHTML = `<h3 style="margin:0;font-size:16px;color:#f5c2e7;">Multi-AI Search Engine</h3>`;
  const closeBtn = document.createElement('span');
  closeBtn.textContent = '×';
  Object.assign(closeBtn.style, { float: 'right', cursor: 'pointer', fontSize: '20px', marginTop: '-5px', color: '#a6adc8' });
  closeBtn.onclick = () => container.remove();
  header.prepend(closeBtn);
  container.appendChild(header);

  /* Query Input */
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Enter search query...';
  Object.assign(input.style, {
    width: '100%', padding: '10px', marginTop: '15px', borderRadius: '6px',
    border: '1px solid #45475a', backgroundColor: '#313244', color: '#cdd6f4',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box'
  });
  container.appendChild(input);

  /* Engine List */
  const listTitle = document.createElement('div');
  listTitle.textContent = 'Select Engines:';
  Object.assign(listTitle.style, { fontSize: '12px', color: '#bac2de', marginTop: '15px', marginBottom: '8px', fontWeight: 'bold' });
  container.appendChild(listTitle);

  const engineList = document.createElement('div');
  Object.assign(engineList.style, { maxHeight: '180px', overflowY: 'auto', marginBottom: '15px' });

  function renderEngines() {
    engineList.innerHTML = '';
    engines.forEach((eng, index) => {
      const item = document.createElement('div');
      Object.assign(item.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' });

      const label = document.createElement('label');
      Object.assign(label.style, { display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', width: '100%' });
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = eng.checked;
      checkbox.style.marginRight = '8px';
      checkbox.onchange = () => { eng.checked = checkbox.checked; };

      const nameText = document.createTextNode(eng.name);
      label.appendChild(checkbox);
      label.appendChild(nameText);
      item.appendChild(label);

      /* Custom engines get a delete button */
      if (!DEFAULT_ENGINES.find(d => d.id === eng.id)) {
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete';
        Object.assign(delBtn.style, {
          backgroundColor: '#f38ba8', color: '#11111b', border: 'none',
          padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px'
        });
        delBtn.onclick = () => {
          engines.splice(index, 1);
          renderEngines();
        };
        item.appendChild(delBtn);
      }

      engineList.appendChild(item);
    });
  }
  renderEngines();
  container.appendChild(engineList);

  /* 4. Custom Engine Accordion Wrapper */
  const addEngineArea = document.createElement('div');
  Object.assign(addEngineArea.style, { borderTop: '1px solid #313244', paddingTop: '10px', marginTop: '10px' });
  
  const toggleLink = document.createElement('div');
  toggleLink.textContent = '+ Add Custom Engine';
  Object.assign(toggleLink.style, { fontSize: '12px', color: '#89b4fa', cursor: 'pointer', marginBottom: '8px', userSelect: 'none' });
  
  const formDiv = document.createElement('div');
  formDiv.style.display = 'none';
  
  toggleLink.onclick = () => {
    formDiv.style.display = formDiv.style.display === 'none' ? 'block' : 'none';
  };

  const nameInput = document.createElement('input');
  nameInput.placeholder = 'Engine Name (e.g., DeepSeek)';
  const urlInput = document.createElement('input');
  urlInput.placeholder = 'Engine URL (must include %s)';
  
  [nameInput, urlInput].forEach(inp => {
    Object.assign(inp.style, {
      width: '100%', padding: '6px', marginBottom: '6px', borderRadius: '4px',
      border: '1px solid #45475a', backgroundColor: '#313244', color: '#cdd6f4',
      fontSize: '11px', boxSizing: 'border-box'
    });
    formDiv.appendChild(inp);
  });

  const saveCustomBtn = document.createElement('button');
  saveCustomBtn.textContent = 'Add Engine';
  Object.assign(saveCustomBtn.style, {
    width: '100%', padding: '6px', backgroundColor: '#a6e3a1', color: '#11111b',
    border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold'
  });
  saveCustomBtn.onclick = () => {
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    if (!name || !url.includes('%s')) {
      alert('Please provide a valid name and a search URL containing %s.');
      return;
    }
    engines.push({ id: 'custom_' + Date.now(), name, url, checked: true });
    nameInput.value = '';
    urlInput.value = '';
    formDiv.style.display = 'none';
    renderEngines();
  };
  formDiv.appendChild(saveCustomBtn);
  addEngineArea.appendChild(toggleLink);
  addEngineArea.appendChild(formDiv);
  container.appendChild(addEngineArea);

  /* 5. Control Buttons */
  const footer = document.createElement('div');
  Object.assign(footer.style, { display: 'flex', gap: '8px', marginTop: '15px', borderTop: '1px solid #313244', paddingTop: '15px' });

  const savePrefsBtn = document.createElement('button');
  savePrefsBtn.textContent = 'Save Default Preferences';
  Object.assign(savePrefsBtn.style, {
    flex: '1', padding: '10px', backgroundColor: '#cba6f7', color: '#11111b',
    border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold'
  });
  savePrefsBtn.onclick = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(engines));
    alert('Search engine preferences successfully saved!');
  };

  const searchBtn = document.createElement('button');
  searchBtn.textContent = 'Search';
  Object.assign(searchBtn.style, {
    flex: '1', padding: '10px', backgroundColor: '#89b4fa', color: '#11111b',
    border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
  });
  
  function executeSearch() {
    const q = encodeURIComponent(input.value.trim());
    if (!q) return;

    engines.forEach(eng => {
      if (eng.checked) {
        const targetUrl = eng.url.replace(/%s/g, q);
        window.open(targetUrl, '_blank');
      }
    });
    container.remove();
  }

  searchBtn.onclick = executeSearch;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') executeSearch();
  };

  footer.appendChild(savePrefsBtn);
  footer.appendChild(searchBtn);
  container.appendChild(footer);
```
  document.body.appendChild(container);
  input.focus();
})();
