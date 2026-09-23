const STORAGE_KEY = 'language-study-v1';
const $ = (sel) => document.querySelector(sel);

const app = $('#app');
const pageTitle = $('#pageTitle');
const backBtn = $('#backBtn');
const settingsBtn = $('#settingsBtn');
const modal = $('#modal');
const modalForm = $('#modalForm');
const modalTitle = $('#modalTitle');
const modalEyebrow = $('#modalEyebrow');
const modalBody = $('#modalBody');
const modalSubmit = $('#modalSubmit');
const modalClose = $('#modalClose');
const modalCancel = $('#modalCancel');
const toastEl = $('#toast');

let state = loadState();
let route = { view: 'home', languageId: null, folderId: null, study: false };
let modalAction = null;
let studyIndex = 0;
let studyRevealed = false;
let currentSearch = '';

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { languages: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.languages)) throw new Error('invalid');
    return parsed;
  } catch {
    return { languages: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getLanguage() { return state.languages.find(x => x.id === route.languageId); }
function getFolder() { return getLanguage()?.folders.find(x => x.id === route.folderId); }
function totalCards(lang) { return (lang?.folders || []).reduce((n, f) => n + f.cards.length, 0); }

function formatCount(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

function setRoute(next) {
  route = { ...route, ...next };
  currentSearch = '';
  studyIndex = 0;
  studyRevealed = false;
  render();
}

function render() {
  if (route.view === 'home') renderHome();
  else if (route.view === 'language') renderLanguage();
  else if (route.view === 'folder') renderFolder();
  else if (route.view === 'settings') renderSettings();
  else renderHome();

  backBtn.classList.toggle('is-hidden', route.view === 'home');
  settingsBtn.classList.toggle('is-hidden', route.view !== 'home');
}

function renderHome() {
  pageTitle.textContent = 'Мои языки';
  const langs = state.languages;
  app.innerHTML = `
    <section class="hero">
      <div class="eyebrow">PERSONAL VOCABULARY</div>
    </section>
    <div class="fab-row">
      <button class="btn primary" id="addLanguage">＋New language</button>
      <button class="btn secondary" id="importData">Import Data</button>
    </div>
    <div class="section-head">
      <div class="title">Langs</div>
      <div class="count">${langs.length}</div>
    </div>
    ${langs.length ? `<div class="grid languages">${langs.map(languageCard).join('')}</div>` : emptyBlock('Делай Блять')}
  `;

  $('#addLanguage').onclick = () => openLanguageModal();
  $('#importData').onclick = importData;
  document.querySelectorAll('[data-language]').forEach(el => {
    el.onclick = () => setRoute({ view: 'language', languageId: el.dataset.language });
  });
}

function languageCard(lang) {
  const words = lang.folders[0]?.cards.length || 0;
  const phrases = lang.folders[1]?.cards.length || 0;
  return `
    <article class="language-card" data-language="${lang.id}">
      <div class="card-top">
        <div>
          <div class="card-title">${esc(lang.name)}</div>
          <div class="card-subtitle">${totalCards(lang)} ${formatCount(totalCards(lang), 'карточка', 'карточки', 'карточек')}</div>
        </div>
        <div class="count">→</div>
      </div>
      <div class="stats">
        <span class="pill">Слова · ${words}</span>
        <span class="pill">Фразы · ${phrases}</span>
      </div>
    </article>
  `;
}

function renderLanguage() {
  const lang = getLanguage();
  if (!lang) return setRoute({ view: 'home', languageId: null });
  pageTitle.textContent = lang.name;
  app.innerHTML = `
    <section class="hero">
      <div class="eyebrow">LANGUAGE</div>
      <h2>${esc(lang.name)}</h2>
      <p>${totalCards(lang)} ${formatCount(totalCards(lang), 'карточка', 'карточки', 'карточек')} для изучения.</p>
    </section>
    <div class="fab-row">
      <button class="btn primary" id="startStudy">Start Bitch</button>
      <button class="btn secondary" id="renameLanguage">Rename</button>
    </div>
    <div class="section-head"><div class="title">Folder</div><div class="count">2</div></div>
    <div class="folder-grid">
      ${folderCard(lang.folders[0], '▤', 'Отдельные слова')}
      ${folderCard(lang.folders[1], '≡', 'Словосочетания и предложения')}
    </div>
    <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <button class="btn ghost" id="exportLang"> Import Lang</button>
      <button class="btn danger" id="deleteLanguage">Delete Lang</button>
    </div>
  `;
  document.querySelectorAll('[data-folder]').forEach(el => {
    el.onclick = () => setRoute({ view: 'folder', folderId: el.dataset.folder });
  });
  $('#startStudy').onclick = () => {
    const all = lang.folders.flatMap(f => f.cards.map(c => ({ ...c, folderName: f.name })));
    if (!all.length) return toast('Добавляй карту нахуй');
    openStudy(all);
  };
  $('#renameLanguage').onclick = () => openLanguageModal(lang);
  $('#exportLang').onclick = () => exportData(lang.id);
  $('#deleteLanguage').onclick = () => {
    if (!confirm(`Удалить язык «${lang.name}» и все его карточки?`)) return;
    state.languages = state.languages.filter(x => x.id !== lang.id);
    saveState();
    setRoute({ view: 'home', languageId: null, folderId: null });
    toast('Язык удалён');
  };
}

function folderCard(folder, symbol, subtitle) {
  return `
    <article class="folder" data-folder="${folder.id}">
      <div class="folder-symbol">${symbol}</div>
      <div>
        <div class="folder-name">${esc(folder.name)}</div>
        <div class="folder-meta">${folder.cards.length} ${formatCount(folder.cards.length, 'карточка', 'карточки', 'карточек')}</div>
        <div class="folder-meta">${subtitle}</div>
      </div>
    </article>
  `;
}

function renderFolder() {
  const lang = getLanguage();
  const folder = getFolder();
  if (!lang || !folder) return setRoute({ view: 'language' });
  pageTitle.textContent = folder.name;
  const cards = folder.cards.filter(c => {
    const q = currentSearch.trim().toLowerCase();
    return !q || `${c.front} ${c.back}`.toLowerCase().includes(q);
  });
  app.innerHTML = `
    <div class="fab-row">
      <button class="btn primary" id="addCard">Добавляй карту сук</button>
      <button class="btn secondary" id="studyFolder">Start Нахуй</button>
    </div>
    <div class="search-wrap"><input class="input" id="searchInput" placeholder="Поиск по карточкам…" value="${esc(currentSearch)}" /></div>
    <div class="section-head"><div class="title">${folder.cards.length} всего</div><div class="count">${cards.length} показано</div></div>
    ${cards.length ? `<div class="cards-list">${cards.map(cardHtml).join('')}</div>` : emptyBlock('Карточек пока нет', 'Добавляй мозга сыкпеш')}
  `;
  $('#addCard').onclick = () => openCardModal();
  $('#studyFolder').onclick = () => {
    if (!folder.cards.length) return toast('Сначала добавь карточки');
    openStudy(folder.cards.map(c => ({ ...c, folderName: folder.name })));
  };
  $('#searchInput').oninput = (e) => { currentSearch = e.target.value; renderFolder(); $('#searchInput').focus(); $('#searchInput').setSelectionRange(currentSearch.length, currentSearch.length); };
  document.querySelectorAll('[data-edit-card]').forEach(el => el.onclick = () => openCardModal(el.dataset.editCard));
  document.querySelectorAll('[data-delete-card]').forEach(el => el.onclick = () => deleteCard(el.dataset.deleteCard));
}

function cardHtml(card) {
  return `
    <article class="note-card">
      <div class="front">${esc(card.front)}</div>
      <div class="back">${esc(card.back)}</div>
      <div class="card-actions">
        <button class="btn small secondary" data-edit-card="${card.id}">Изменить</button>
        <button class="btn small danger" data-delete-card="${card.id}">Удалить</button>
      </div>
    </article>
  `;
}

function emptyBlock(title, desc) {
  return `<div class="empty"><strong>${esc(title)}</strong>${esc(desc)}</div>`;
}

function renderSettings() {
  pageTitle.textContent = 'Настройки';
  app.innerHTML = `
    <section class="settings-section">
      <div class="section-head"><div class="title">Данные</div></div>
      <button class="btn primary" id="exportAll" style="width:100%">Экспортировать всё</button>
      <p class="small-note">Файл JSON можно сохранить на телефоне или в облако и потом импортировать обратно.</p>
    </section>
    <section class="settings-section">
      <div class="section-head"><div class="title">Интерфейс</div></div>
      <div class="empty"><strong>Тёмная тема</strong>Сейчас приложение оптимизировано под тёмный экран iPhone.</div>
    </section>
    <section class="settings-section">
      <div class="section-head"><div class="title">Хранение</div></div>
      <div class="empty"><strong>Локально на устройстве</strong>Карточки сохраняются в браузере. При очистке данных браузера они могут быть удалены — экспортируй резервную копию.</div>
    </section>
  `;
  $('#exportAll').onclick = () => exportData();
}

function openLanguageModal(lang = null) {
  modalAction = { type: 'language', id: lang?.id || null };
  modalEyebrow.textContent = lang ? 'EDIT LANGUAGE' : 'NEW LANGUAGE';
  modalTitle.textContent = lang ? 'Изменить язык' : 'Новый язык';
  modalSubmit.textContent = lang ? 'Сохранить' : 'Создать';
  modalBody.innerHTML = `
    <div class="field">
      <label for="languageName">Название языка</label>
      <input class="input" id="languageName" maxlength="40" autocomplete="off" placeholder="Например: Қазақ тілі" value="${esc(lang?.name || '')}" required />
      <div class="hint">Можно писать на русском, казахском, английском и т.д.</div>
    </div>
  `;
  modal.showModal();
  setTimeout(() => $('#languageName').focus(), 20);
}

function openCardModal(cardId = null) {
  const folder = getFolder();
  const card = folder?.cards.find(c => c.id === cardId);
  modalAction = { type: 'card', id: cardId };
  modalEyebrow.textContent = card ? 'EDIT CARD' : 'NEW CARD';
  modalTitle.textContent = card ? 'Изменить карточку' : 'Новая карточка';
  modalSubmit.textContent = 'Сохранить';
  const isPhrase = folder?.type === 'phrases';
  modalBody.innerHTML = `
    <div class="field">
      <label for="cardFront">${isPhrase ? 'Фраза / предложение' : 'Слово'}</label>
      <textarea class="textarea" id="cardFront" maxlength="500" placeholder="${isPhrase ? 'Например: Мен бүгін жұмыс істеймін.' : 'Например: кітап'}" required>${esc(card?.front || '')}</textarea>
    </div>
    <div class="field">
      <label for="cardBack">Перевод</label>
      <textarea class="textarea" id="cardBack" maxlength="1000" placeholder="Например: Я сегодня работаю." required>${esc(card?.back || '')}</textarea>
    </div>
  `;
  modal.showModal();
  setTimeout(() => $('#cardFront').focus(), 20);
}

function closeModal() { modal.close(); modalAction = null; }
modalClose.onclick = closeModal;
modalCancel.onclick = closeModal;
modalForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!modalAction) return;
  if (modalAction.type === 'language') {
    const name = $('#languageName').value.trim();
    if (!name) return;
    if (modalAction.id) {
      const lang = state.languages.find(x => x.id === modalAction.id);
      if (lang) lang.name = name;
      toast('Язык обновлён');
    } else {
      state.languages.push({
        id: uid('lang'), name,
        folders: [
          { id: uid('folder'), type: 'words', name: 'Словарь', cards: [] },
          { id: uid('folder'), type: 'phrases', name: 'Фразы и предложения', cards: [] }
        ]
      });
      toast('Язык создан');
    }
  }
  if (modalAction.type === 'card') {
    const lang = getLanguage();
    const folder = getFolder();
    if (!lang || !folder) return;
    const front = $('#cardFront').value.trim();
    const back = $('#cardBack').value.trim();
    if (!front || !back) return;
    if (modalAction.id) {
      const card = folder.cards.find(x => x.id === modalAction.id);
      if (card) { card.front = front; card.back = back; card.updatedAt = Date.now(); }
      toast('Карточка обновлена');
    } else {
      folder.cards.unshift({ id: uid('card'), front, back, createdAt: Date.now(), updatedAt: Date.now() });
      toast('Карточка добавлена');
    }
  }
  saveState();
  closeModal();
  render();
});

function deleteCard(cardId) {
  const folder = getFolder();
  if (!folder) return;
  const card = folder.cards.find(c => c.id === cardId);
  if (!card) return;
  if (!confirm(`Удалить карточку «${card.front}»?`)) return;
  folder.cards = folder.cards.filter(c => c.id !== cardId);
  saveState();
  render();
  toast('Карточка удалена');
}

function openStudy(cards) {
  route = { view: 'study', languageId: route.languageId, folderId: route.folderId, cards };
  studyIndex = 0;
  studyRevealed = false;
  pageTitle.textContent = 'Обучение';
  backBtn.classList.remove('is-hidden');
  settingsBtn.classList.add('is-hidden');
  renderStudy();
}

function renderStudy() {
  const cards = route.cards || [];
  if (!cards.length) return setRoute({ view: route.folderId ? 'folder' : 'language' });
  const card = cards[studyIndex % cards.length];
  pageTitle.textContent = 'Обучение';
  app.innerHTML = `
    <div class="study-progress">${studyIndex + 1} / ${cards.length}${card.folderName ? ` · ${esc(card.folderName)}` : ''}</div>
    <article class="study-card" id="studyCard" aria-label="">
      <div class="study-label">${studyRevealed ? '' : ''}</div>
      <div class="study-text">${esc(studyRevealed ? card.back : card.front)}</div>
      ${studyRevealed ? '<div class="study-back"> Далее div>' : '<div class="study-back"></div>'}
    </article>
    <div class="study-controls">
      <button class="btn secondary" id="prevStudy">Назад</button>
      <button class="btn primary" id="nextStudy">Далее </button>
      <button class="btn secondary" id="shuffleStudy">Перемешать</button>
    </div>
  `;
  $('#studyCard').onclick = () => { studyRevealed = !studyRevealed; renderStudy(); };
  $('#prevStudy').onclick = () => { studyIndex = (studyIndex - 1 + cards.length) % cards.length; studyRevealed = false; renderStudy(); };
  $('#nextStudy').onclick = () => { studyIndex = (studyIndex + 1) % cards.length; studyRevealed = false; renderStudy(); };
  $('#shuffleStudy').onclick = () => {
    route.cards = [...cards].sort(() => Math.random() - .5);
    studyIndex = 0; studyRevealed = false; renderStudy();
  };
}

function exportData(languageId = null) {
  const payload = languageId ? {
    version: 1,
    type: 'language-study-language',
    exportedAt: new Date().toISOString(),
    language: state.languages.find(x => x.id === languageId)
  } : {
    version: 1,
    type: 'language-study-all',
    exportedAt: new Date().toISOString(),
    languages: state.languages
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = languageId ? `language-${languageId}.json` : 'language-study-backup.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Экспорт готов');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'application/json,.json';
  input.onchange = async () => {
    const file = input.files?.[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.type === 'language-study-all' && Array.isArray(data.languages)) {
        state = { languages: data.languages };
      } else if (data.type === 'language-study-language' && data.language?.name && Array.isArray(data.language.folders)) {
        const idx = state.languages.findIndex(x => x.id === data.language.id);
        if (idx >= 0) state.languages[idx] = data.language; else state.languages.push(data.language);
      } else throw new Error('bad file');
      saveState(); setRoute({ view: 'home', languageId: null, folderId: null }); toast('Данные импортированы');
    } catch { toast('Не удалось прочитать файл'); }
  };
  input.click();
}

backBtn.onclick = () => {
  if (route.view === 'study') {
    setRoute({ view: route.folderId ? 'folder' : 'language' });
  } else if (route.view === 'folder') {
    setRoute({ view: 'language', folderId: null });
  } else if (route.view === 'settings') {
    setRoute({ view: 'home' });
  } else {
    setRoute({ view: 'home', languageId: null, folderId: null });
  }
};
settingsBtn.onclick = () => setRoute({ view: 'settings' });
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

// Handle study view separately because route.view is not part of the main render switch.
const originalRender = render;
render = function () {
  if (route.view === 'study') return renderStudy();
  return originalRender();
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { }));
}

render();
