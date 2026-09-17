import { guideItems } from './guide-data.js';
import { readerEntries } from './reader-data.js';

const $ = (selector) => document.querySelector(selector);
const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const zones = [
  ['front-lights', 'Front lighting'],
  ['engine', 'Engine and battery'],
  ['brakes-front', 'Front brakes and wheels'],
  ['cabin', 'Cabin and steering'],
  ['underbody', 'Underbody and transmission'],
  ['brakes-rear', 'Rear brakes and wheels'],
  ['rear-lights', 'Rear lighting']
];
const zoneLabel = Object.fromEntries(zones);
const carViews = {
  side: { file: 'Side.svg', alt: 'Stylized side illustration of an Elantra', pins: [
    ['front-lights', 9, 43], ['engine', 26, 36], ['brakes-front', 27, 67], ['cabin', 54, 38],
    ['underbody', 56, 73], ['brakes-rear', 76, 67], ['rear-lights', 91, 43]
  ] },
  front: { file: 'Front.svg', alt: 'Stylized front illustration of an Elantra', pins: [
    ['front-lights', 23, 46], ['engine', 50, 32], ['brakes-front', 78, 69]
  ] },
  back: { file: 'Back.svg', alt: 'Stylized rear illustration of an Elantra', pins: [
    ['rear-lights', 25, 46], ['brakes-rear', 78, 82]
  ] },
  vehicle: { file: 'Elantra.svg', alt: 'Stylized three-quarter illustration of an Elantra', pins: [
    ['front-lights', 20, 51], ['engine', 34, 37], ['brakes-front', 32, 70], ['cabin', 52, 34],
    ['underbody', 54, 75], ['brakes-rear', 76, 68], ['rear-lights', 85, 48]
  ] }
};
let currentView = 'guide';
let currentZone = null;
let currentCarView = 'side';

function setView(view, focusHeading = false) {
  if (!['guide', 'reader', 'manual'].includes(view)) return;
  if (currentView !== view) stopSpeech();
  currentView = view;
  for (const name of ['guide', 'reader', 'manual']) {
    const active = name === view;
    $(`#${name}-view`).hidden = !active;
    const button = document.querySelector(`[data-view="${name}"]`);
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  const heading = {
    guide: ['Find the part. Check the source.', 'Explore a vehicle zone or search the guide. Each entry points back to the supplied 2013 manual or workshop archive.'],
    reader: ['Read maintenance clearly.', 'Structured maintenance entries with individual playback and links to the original manual pages.'],
    manual: ['Read the original manual.', 'Use the built-in PDF viewer to inspect the exact 2013 owner’s manual page.']
  }[view];
  $('#view-heading').textContent = heading[0];
  $('#view-description').textContent = heading[1];
  if (view === 'manual') loadPdf();
  if (focusHeading) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    $('#view-heading').setAttribute('tabindex', '-1');
    $('#view-heading').focus({ preventScroll: true });
  }
}

function setCarView(name) {
  currentCarView = name;
  const view = carViews[name];
  $('#car-image').src = `SVG/${view.file}`;
  $('#car-image').alt = view.alt;
  document.querySelectorAll('[data-car-view]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.carView === name));
  });
  const holder = $('#diagram-hotspots');
  holder.replaceChildren();
  for (const [zone, x, y] of view.pins) {
    const button = make('button', 'hotspot', String(zones.findIndex(([key]) => key === zone) + 1));
    button.type = 'button';
    button.style.left = `${x}%`;
    button.style.top = `${y}%`;
    button.dataset.zone = zone;
    button.title = zoneLabel[zone];
    button.setAttribute('aria-label', `Filter to ${zoneLabel[zone]}`);
    button.setAttribute('aria-pressed', String(currentZone === zone));
    button.addEventListener('click', () => setZone(zone));
    holder.append(button);
  }
}

function setZone(zone) {
  currentZone = zone;
  $('#clear-zone').hidden = !zone;
  document.querySelectorAll('.hotspot, .zone-buttons button').forEach(button => {
    button.setAttribute('aria-pressed', String(Boolean(zone) && button.dataset.zone === zone));
  });
  renderGuide();
  $('#results-count').scrollIntoView({ block: 'nearest' });
}

function setupZones() {
  const holder = $('#zone-buttons');
  for (const [zone, label] of zones) {
    const button = make('button', '', label);
    button.type = 'button';
    button.dataset.zone = zone;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => setZone(zone));
    holder.append(button);
  }
  setCarView('side');
}

function sourceControl(source) {
  if (source.kind === 'owner') {
    const button = make('button', 'source-button', `Owner’s manual • PDF p. ${source.page}`);
    button.type = 'button';
    button.setAttribute('aria-label', `View owner’s manual PDF page ${source.page}`);
    button.addEventListener('click', () => showPdf(source.page));
    return button;
  }
  const link = make('a', '', source.page ? `Workshop procedure ↗` : 'Workshop archive ↗');
  link.href = `2013%20Hyundai%20Elantra%20L4-1.8L/pages/${source.page}.html`;
  return link;
}

function playControl(id, title, text) {
  const button = make('button', 'play-button', '▶ Play');
  button.type = 'button';
  button.dataset.speakId = id;
  button.setAttribute('aria-label', `Play ${title}`);
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => playSpeech(id, title, text));
  if (!speechSupported) {
    button.disabled = true;
    button.title = 'Read aloud is unavailable in this browser.';
  }
  return button;
}

function renderGuide() {
  const query = $('#guide-search').value.trim().toLocaleLowerCase();
  const terms = query.match(/[\p{L}\p{N}]+/gu) || [];
  const type = $('#category-filter').value;
  const filtered = guideItems.filter(item =>
    (!currentZone || item.zone === currentZone) &&
    (type === 'all' || item.type === type) &&
    (!terms.length || terms.every(term =>
      ([item.title, item.category, item.mainSpec, item.subSpec, item.details].join(' ').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
        .some(word => word.startsWith(term))
    ))
  );
  $('#results-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}${currentZone ? ` in ${zoneLabel[currentZone]}` : ''}`;
  const holder = $('#guide-cards');
  holder.replaceChildren();
  if (!filtered.length) {
    holder.append(make('p', 'empty', 'No entries match. Try another search, category, or vehicle zone.'));
    return;
  }
  for (const item of filtered) {
    const card = make('article', 'card');
    card.id = `guide-${item.id}`;
    const top = make('div', 'card-top');
    top.append(make('span', 'tag', item.category));
    const speech = [item.title, item.mainSpec, item.subSpec, item.details].join('. ');
    top.append(playControl(`guide-${item.id}`, item.title, speech));
    card.append(top, make('h4', '', item.title), make('p', 'spec', item.mainSpec), make('p', 'subspec', item.subSpec), make('p', 'details', item.details));
    const actions = make('div', 'card-actions');
    actions.append(sourceControl(item.source));
    card.append(actions);
    holder.append(card);
  }
  syncPlayButtons();
}

function renderReader() {
  const holder = $('#reader-entries');
  const toc = $('#reader-toc');
  let lastGroup = '';
  const groupOrder = ['Owner checks', 'Schedules', 'Fluids and filters', 'Tires and wheels', 'Visibility', 'Electrical', 'Care', 'Specifications'];
  const orderedEntries = [...readerEntries].sort((a, b) =>
    groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group) || a.page - b.page
  );
  for (const entry of orderedEntries) {
    if (entry.group !== lastGroup) {
      lastGroup = entry.group;
      holder.append(make('h3', 'reader-group', lastGroup));
    }
    const article = make('article', 'reader-entry');
    article.id = entry.id;
    const top = make('div', 'entry-top');
    const heading = make('div');
    heading.append(make('span', 'entry-group', entry.group), make('h4', '', entry.title));
    top.append(heading);
    const speech = [entry.title, entry.body, ...entry.points, entry.caution ? `Caution. ${entry.caution}` : ''].filter(Boolean).join('. ');
    top.append(playControl(`reader-${entry.id}`, entry.title, speech));
    article.append(top, make('p', '', entry.body));
    if (entry.points.length) {
      const list = make('ul');
      for (const point of entry.points) list.append(make('li', '', point));
      article.append(list);
    }
    if (entry.caution) {
      const caution = make('p', 'caution');
      caution.append(make('strong', '', 'Caution: '), document.createTextNode(entry.caution));
      article.append(caution);
    }
    const actions = make('div', 'entry-actions');
    actions.append(sourceControl({ kind: 'owner', page: entry.page }));
    article.append(actions);
    holder.append(article);
    const link = make('a', '', entry.title);
    link.href = `#${entry.id}`;
    link.addEventListener('click', event => {
      event.preventDefault();
      article.scrollIntoView({ block: 'start' });
      article.setAttribute('tabindex', '-1');
      article.focus({ preventScroll: true });
      history.replaceState(null, '', `#${entry.id}`);
    });
    toc.append(link);
  }
}

const speechSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
let activeSpeechId = null;
let speechToken = 0;
function syncPlayButtons() {
  document.querySelectorAll('[data-speak-id]').forEach(button => {
    const active = button.dataset.speakId === activeSpeechId;
    button.setAttribute('aria-pressed', String(active));
    button.textContent = active ? '■ Stop' : '▶ Play';
    button.setAttribute('aria-label', `${active ? 'Stop' : 'Play'} ${button.closest('article')?.querySelector('h4')?.textContent || 'entry'}`);
  });
}
function stopSpeech() {
  speechToken += 1;
  if (speechSupported) window.speechSynthesis.cancel();
  activeSpeechId = null;
  $('#speech-bar').hidden = true;
  $('#speech-pause').textContent = 'Pause';
  syncPlayButtons();
}
function playSpeech(id, title, content) {
  if (!speechSupported) return;
  if (activeSpeechId === id) { stopSpeech(); return; }
  stopSpeech();
  const token = ++speechToken;
  const utterance = new SpeechSynthesisUtterance(content);
  utterance.rate = 0.95;
  let started = false;
  utterance.onstart = () => {
    if (token === speechToken) {
      started = true;
      $('#speech-status').textContent = 'Reading aloud';
    }
  };
  utterance.onend = () => {
    if (token !== speechToken) return;
    if (!started && content.length > 30) $('#speech-support').textContent = 'Speech ended before audio started. Check the browser’s speech voices and audio output.';
    stopSpeech();
  };
  utterance.onerror = event => {
    if (token !== speechToken) return;
    stopSpeech();
    $('#speech-support').textContent = `Read aloud stopped: ${event.error || 'audio unavailable'}.`;
  };
  activeSpeechId = id;
  $('#speech-title').textContent = title;
  $('#speech-status').textContent = 'Starting speech…';
  $('#speech-bar').hidden = false;
  syncPlayButtons();
  window.speechSynthesis.speak(utterance);
}
function togglePause() {
  if (!speechSupported || !activeSpeechId) return;
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    $('#speech-pause').textContent = 'Pause';
    $('#speech-status').textContent = 'Reading aloud';
  } else {
    window.speechSynthesis.pause();
    $('#speech-pause').textContent = 'Resume';
    $('#speech-status').textContent = 'Paused';
  }
}

const PDF_URL = '2013%20Hyundai%20Elantra%20(UD)%20Owners%20Manual.pdf';
let pdfjs = null;
let pdfDoc = null;
let pdfLoading = null;
let pdfPage = 292;
let renderToken = 0;
let renderTask = null;
let searchToken = 0;
let searchMatches = [];
let searchIndex = -1;
let searchQuery = '';
const textCache = new Map();
function setPdfStatus(message) { $('#pdf-status').textContent = message; }
async function loadPdf() {
  if (pdfDoc || pdfLoading) return pdfLoading;
  setPdfStatus('Loading the 2013 owner’s manual…');
  pdfLoading = (async () => {
    pdfjs = await import('./vendor/pdfjs/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.mjs';
    pdfDoc = await pdfjs.getDocument({ url: PDF_URL }).promise;
    $('#pdf-page').max = String(pdfDoc.numPages);
    $('#pdf-page-count').textContent = `of ${pdfDoc.numPages}`;
    await renderPdfPage();
  })().catch(error => {
    console.error('PDF viewer could not load', error);
    setPdfStatus('The built-in viewer could not load this PDF. Use “Open or download PDF” above.');
    pdfLoading = null;
  });
  return pdfLoading;
}
async function renderPdfPage() {
  if (!pdfDoc) return;
  const token = ++renderToken;
  if (renderTask) renderTask.cancel();
  const pageNumber = Math.min(Math.max(1, Number(pdfPage) || 1), pdfDoc.numPages);
  pdfPage = pageNumber;
  $('#pdf-page').value = String(pageNumber);
  $('#pdf-prev').disabled = pageNumber === 1;
  $('#pdf-next').disabled = pageNumber === pdfDoc.numPages;
  setPdfStatus(`Rendering PDF page ${pageNumber} of ${pdfDoc.numPages}…`);
  try {
    const page = await pdfDoc.getPage(pageNumber);
    if (token !== renderToken) return;
    const scale = Number($('#pdf-zoom').value);
    const viewport = page.getViewport({ scale });
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = $('#pdf-canvas');
    const context = canvas.getContext('2d', { alpha: false });
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    $('#pdf-page-wrap').style.width = `${viewport.width}px`;
    $('#pdf-page-wrap').style.height = `${viewport.height}px`;
    renderTask = page.render({ canvasContext: context, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
    await renderTask.promise;
    if (token !== renderToken) return;
    const layer = $('#pdf-text-layer');
    layer.replaceChildren();
    layer.style.setProperty('--scale-factor', scale);
    layer.style.width = `${viewport.width}px`;
    layer.style.height = `${viewport.height}px`;
    const textLayer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: layer, viewport });
    await textLayer.render();
    if (token !== renderToken) return;
    if (searchQuery) {
      layer.querySelectorAll('span').forEach(span => {
        if (span.textContent.toLocaleLowerCase().includes(searchQuery)) span.classList.add('pdf-hit');
      });
    }
    setPdfStatus(`PDF page ${pageNumber} of ${pdfDoc.numPages}. Text is selectable; reader mode has structured maintenance content.`);
  } catch (error) {
    if (error?.name !== 'RenderingCancelledException') {
      console.error('PDF page render failed', error);
      setPdfStatus('This page could not be rendered. Use “Open or download PDF” above.');
    }
  }
}
function showPdf(page) {
  pdfPage = Number(page);
  searchToken += 1;
  searchQuery = '';
  searchMatches = [];
  searchIndex = -1;
  $('#pdf-search').value = '';
  $('#pdf-next-match').disabled = true;
  setView('manual', true);
  history.replaceState(null, '', `#pdf-page=${pdfPage}`);
  if (pdfDoc) renderPdfPage();
}
async function getPageText(pageNumber) {
  if (textCache.has(pageNumber)) return textCache.get(pageNumber);
  const page = await pdfDoc.getPage(pageNumber);
  const text = (await page.getTextContent()).items.map(item => item.str).join(' ').toLocaleLowerCase();
  textCache.set(pageNumber, text);
  return text;
}
async function searchPdf(term) {
  await loadPdf();
  if (!pdfDoc) return;
  const query = term.trim().toLocaleLowerCase();
  searchQuery = query;
  const token = ++searchToken;
  searchMatches = [];
  searchIndex = -1;
  $('#pdf-next-match').disabled = true;
  if (!query) { setPdfStatus('Enter a term to search the PDF.'); return; }
  setPdfStatus(`Searching all ${pdfDoc.numPages} PDF pages for “${term}”…`);
  try {
    for (let page = 1; page <= pdfDoc.numPages; page++) {
      if (token !== searchToken) return;
      if ((await getPageText(page)).includes(query)) searchMatches.push(page);
      if (page % 15 === 0) {
        setPdfStatus(`Searching PDF: ${page} of ${pdfDoc.numPages} pages checked…`);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    if (token !== searchToken) return;
    if (!searchMatches.length) { setPdfStatus(`No PDF pages contain “${term}”.`); return; }
    $('#pdf-next-match').disabled = false;
    searchIndex = 0;
    pdfPage = searchMatches[0];
    await renderPdfPage();
    setPdfStatus(`${searchMatches.length} PDF pages contain “${term}”. Showing result 1 of ${searchMatches.length}.`);
  } catch (error) {
    console.error('PDF search failed', error);
    setPdfStatus('PDF search failed. Try another term or use the open PDF link.');
  }
}
function nextMatch() {
  if (!searchMatches.length) return;
  searchIndex = (searchIndex + 1) % searchMatches.length;
  pdfPage = searchMatches[searchIndex];
  renderPdfPage().then(() => setPdfStatus(`Showing search result ${searchIndex + 1} of ${searchMatches.length} on PDF page ${pdfPage}.`));
}

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  history.replaceState(null, '', location.pathname + location.search);
  setView(button.dataset.view, true);
}));
document.querySelectorAll('[data-car-view]').forEach(button => button.addEventListener('click', () => setCarView(button.dataset.carView)));
$('#clear-zone').addEventListener('click', () => setZone(null));
$('#guide-search').addEventListener('input', renderGuide);
$('#category-filter').addEventListener('change', renderGuide);
$('#reader-font-size').addEventListener('change', event => { $('.reader-content').dataset.size = event.target.value; });
$('#speech-pause').addEventListener('click', togglePause);
$('#speech-stop').addEventListener('click', stopSpeech);
$('#pdf-prev').addEventListener('click', () => { pdfPage -= 1; renderPdfPage(); });
$('#pdf-next').addEventListener('click', () => { pdfPage += 1; renderPdfPage(); });
$('#pdf-page').addEventListener('change', event => { pdfPage = Number(event.target.value); renderPdfPage(); });
$('#pdf-zoom').addEventListener('change', renderPdfPage);
$('#pdf-search-form').addEventListener('submit', event => { event.preventDefault(); searchPdf($('#pdf-search').value); });
$('#pdf-next-match').addEventListener('click', nextMatch);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && activeSpeechId) stopSpeech(); });
if (!speechSupported) $('#speech-support').textContent = 'Read aloud is unavailable in this browser. All entries remain readable as text.';
setupZones();
renderGuide();
renderReader();
const deepLink = location.hash.match(/^#pdf-page=(\d+)$/);
if (deepLink) showPdf(Number(deepLink[1]));
else if (readerEntries.some(entry => `#${entry.id}` === location.hash)) {
  setView('reader');
  requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView());
}
