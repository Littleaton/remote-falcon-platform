import { SITE_CONFIG } from './config.js?v=20261009-visit-scene2';
import { RemoteFalconError, fetchShow, isHeartbeatFresh, submitSong } from './api.js';
import { choosePerformer } from './performers.js';

const state = {
  show: null,
  query: '',
  loading: true,
  submitting: new Set(),
  pollTimer: null,
  pollDelay: 8000,
  toastTimer: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const SPRITE_ASSETS = {
  admiral: './assets/admiral-conductor-sprite-8-aligned-v1.png?v=20261009-static-cast1',
  death: './assets/death-singer-sprite-16-clean-v2.png',
  pumpkin: './assets/pumpkin-singer-sprite-16-clean-v2.png',
  phantom: './assets/phantom-singer-sprite-16-clean-v2.png'
};

function getSeason(date = new Date()) {
  const preview = new URLSearchParams(window.location.search).get('season');
  if (preview && SITE_CONFIG.seasons[preview]) return preview;
  if (SITE_CONFIG.season !== 'auto' && SITE_CONFIG.seasons[SITE_CONFIG.season]) return SITE_CONFIG.season;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month === 9 || month === 10 || (month === 11 && day === 1)) return 'halloween';
  if (month === 11 && day <= 12) return 'veterans';
  return 'christmas';
}

function applyPerformer() {
  const forced = new URLSearchParams(window.location.search).get('performer');
  const storageKey = 'loa-last-performer';
  const previous = sessionStorage.getItem(storageKey);
  const performerKey = choosePerformer(SITE_CONFIG.performers, { forced, previous });
  const performer = SITE_CONFIG.performers[performerKey];

  if (!forced) sessionStorage.setItem(storageKey, performerKey);
  document.documentElement.dataset.performer = performerKey;
  $('#season-summary').textContent = performer.tagline;
  $('#stage-performer-line').textContent = performer.stageLine;
  $('#halloween-stage').setAttribute(
    'aria-label',
    `An animated Halloween scene featuring the Lights On Admiral house, the Admiral conductor, and ${performer.description}`
  );
}

function randomizePerformanceTiming() {
  const root = document.documentElement;
  const seconds = (minimum, spread) => `${(minimum + Math.random() * spread).toFixed(2)}s`;
  const negativeSeconds = (maximum) => `${(-Math.random() * maximum).toFixed(2)}s`;

  root.style.setProperty('--admiral-wing-duration', seconds(9.5, 4.5));
  root.style.setProperty('--death-wing-duration', seconds(11, 5));
  root.style.setProperty('--admiral-wing-delay', negativeSeconds(10));
  root.style.setProperty('--death-wing-delay', negativeSeconds(12));
}

function startFlyingGhost() {
  const ghost = $('.flying-ghost');
  if (!ghost || document.documentElement.dataset.season !== 'halloween') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const randomBetween = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const ghostWidth = () => ghost.getBoundingClientRect().width || 180;
  const safeBounds = () => {
    const width = ghostWidth();
    return {
      minX: -width * 0.35,
      maxX: Math.max(80, window.innerWidth - width * 0.65),
      minY: Math.max(70, window.innerHeight * 0.08),
      maxY: Math.max(180, window.innerHeight - width * 0.72 - 120)
    };
  };

  const bounds = safeBounds();
  let position = {
    x: randomBetween(bounds.minX, bounds.maxX * 0.28),
    y: randomBetween(bounds.minY, bounds.maxY),
    scale: randomBetween(0.72, 0.94),
    direction: 1,
    rotation: randomBetween(-4, 4)
  };

  const transformFor = (point) =>
    `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0) scale(${point.scale.toFixed(3)}) scaleX(${point.direction}) rotate(${point.rotation.toFixed(2)}deg)`;

  ghost.style.transform = transformFor(position);
  ghost.style.opacity = '0';

  const flyNextSegment = () => {
    if (!ghost.isConnected) return;
    const nextBounds = safeBounds();
    position.x = clamp(position.x, nextBounds.minX, nextBounds.maxX);
    position.y = clamp(position.y, nextBounds.minY, nextBounds.maxY);

    let targetX = randomBetween(nextBounds.minX, nextBounds.maxX);
    let attempts = 0;
    while (Math.abs(targetX - position.x) < window.innerWidth * 0.24 && attempts < 8) {
      targetX = randomBetween(nextBounds.minX, nextBounds.maxX);
      attempts += 1;
    }

    const targetY = randomBetween(nextBounds.minY, nextBounds.maxY);
    const direction = targetX >= position.x ? 1 : -1;
    const target = {
      x: targetX,
      y: targetY,
      scale: randomBetween(0.68, 1.02),
      direction,
      rotation: randomBetween(-5, 5)
    };
    const arc = randomBetween(-Math.min(105, window.innerHeight * 0.12), Math.min(105, window.innerHeight * 0.12));
    const midpoint = {
      x: position.x + (target.x - position.x) * randomBetween(0.42, 0.58),
      y: clamp((position.y + target.y) / 2 + arc, nextBounds.minY, nextBounds.maxY),
      scale: (position.scale + target.scale) / 2 + randomBetween(-0.035, 0.035),
      direction,
      rotation: randomBetween(-6, 6)
    };
    const duration = randomBetween(7600, 13200);
    const cruisingOpacity = randomBetween(0.42, 0.64);

    ghost.dataset.flightDirection = direction === 1 ? 'right' : 'left';
    ghost.dataset.flightTargetY = Math.round(target.y).toString();

    const keyframes = [
      { transform: transformFor(position), opacity: Number.parseFloat(ghost.style.opacity) || 0 }
    ];
    if (direction !== position.direction) {
      keyframes.push({
        transform: transformFor({
          x: position.x + (target.x - position.x) * 0.08,
          y: position.y + (target.y - position.y) * 0.06,
          scale: position.scale * 0.96,
          direction,
          rotation: midpoint.rotation * 0.45
        }),
        opacity: cruisingOpacity * 0.82,
        offset: 0.1
      });
    }
    keyframes.push(
      { transform: transformFor(midpoint), opacity: cruisingOpacity, offset: 0.52 },
      { transform: transformFor(target), opacity: randomBetween(0.3, 0.56) }
    );

    const animation = ghost.animate(
      keyframes,
      { duration, easing: 'cubic-bezier(.42, .05, .58, .95)', fill: 'forwards' }
    );

    animation.finished.then(() => {
      position = target;
      ghost.style.transform = transformFor(position);
      ghost.style.opacity = getComputedStyle(ghost).opacity;
      animation.cancel();
      window.setTimeout(flyNextSegment, randomBetween(250, 1100));
    }).catch(() => {});
  };

  window.setTimeout(flyNextSegment, randomBetween(350, 1400));
}

function decodeImage(source) {
  return new Promise((resolve) => {
    const image = source instanceof HTMLImageElement ? source : new Image();
    let settled = false;

    const finish = async () => {
      if (settled) return;
      settled = true;
      try {
        if (typeof image.decode === 'function') await image.decode();
      } catch {
        // A load event still means the browser can paint the image.
      }
      resolve();
    };

    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', finish, { once: true });
    if (!(source instanceof HTMLImageElement)) image.src = source;
    if (image.complete) finish();
  });
}

async function revealPerformanceStage() {
  const stage = $('#halloween-stage');
  if (!stage || document.documentElement.dataset.season !== 'halloween') return;

  const performer = document.documentElement.dataset.performer;
  const visibleImages = $$(`.admiral-character img, .performer-${performer} img`);
  const requiredAssets = [SPRITE_ASSETS.admiral, SPRITE_ASSETS[performer]];
  const decoded = Promise.all([
    ...requiredAssets.filter(Boolean).map(decodeImage),
    ...visibleImages.map(decodeImage)
  ]);
  const fallback = new Promise((resolve) => setTimeout(resolve, 5000));

  await Promise.race([decoded, fallback]);
  requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.add('sprites-ready')));
}

function applyConfig() {
  const seasonKey = getSeason();
  const season = SITE_CONFIG.seasons[seasonKey];
  const [headlineLead, ...headlineRest] = season.headline.split('. ');
  document.documentElement.dataset.season = seasonKey;
  $('#season-eyebrow').textContent = season.eyebrow;
  $('#hero-title').innerHTML = headlineRest.length
    ? `${headlineLead}.<br><em>${headlineRest.join('. ')}</em>`
    : season.headline;
  $('#season-summary').textContent = season.summary;
  $('#season-label').textContent = season.label;
  $('#season-range').textContent = season.dateRange;
  $('#location-label').textContent = SITE_CONFIG.locationLabel;
  document.title = `${SITE_CONFIG.showName} · ${season.label}`;

  if (seasonKey === 'halloween') {
    randomizePerformanceTiming();
    applyPerformer();
  }

  for (const link of $$('[data-youtube]')) {
    link.href = SITE_CONFIG.youtubeUrl;
    link.target = '_blank';
    link.rel = 'noreferrer';
  }

  if (SITE_CONFIG.fmFrequency) {
    $('#visit-frequency').textContent = `${SITE_CONFIG.fmFrequency} FM`;
    $('#status-frequency').textContent = SITE_CONFIG.fmFrequency;
  }
  if (SITE_CONFIG.showHours.length) {
    $('#show-hours').textContent = SITE_CONFIG.showHours.join(' · ');
    $('#status-hours').textContent = SITE_CONFIG.showHours.slice(1).join(' · ') || SITE_CONFIG.showHours[0];
  }
  if (SITE_CONFIG.lastNight) $('#last-night').textContent = SITE_CONFIG.lastNight;
  if (SITE_CONFIG.directionsUrl) {
    const link = $('#directions-link');
    link.href = SITE_CONFIG.directionsUrl;
    link.textContent = `${SITE_CONFIG.directionsLabel} ↗`;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.classList.remove('is-hidden');
  }
  if (SITE_CONFIG.pulseMeshUrl) {
    const link = $('#pulsemesh-link');
    link.href = SITE_CONFIG.pulseMeshUrl;
    link.dataset.playerUrl = SITE_CONFIG.pulseMeshUrl;
    link.target = '_blank';
    link.rel = 'noreferrer';
  }
}

function getViewerId() {
  const key = 'loa-viewer-id';
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, value);
  }
  return value;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function songTitle(song, fallback = '—') {
  return song?.displayName || song?.name || fallback;
}

function canInteract() {
  const show = state.show;
  return Boolean(
    show &&
      isHeartbeatFresh(show.lastFppHeartbeat) &&
      show.preferences?.viewerControlEnabled &&
      !show.preferences?.viewerPageViewOnly
  );
}

function renderStatus() {
  const show = state.show;
  const card = $('#signal-card');
  const fresh = isHeartbeatFresh(show?.lastFppHeartbeat);
  card.classList.toggle('is-live', fresh);
  const header = $('#header-show-status');
  header.classList.toggle('is-live', fresh);
  $('#header-status-label').textContent = fresh ? 'Show live' : 'Show offline';
  const pulseMeshCard = $('#pulsemesh-card');
  const pulseMeshLink = $('#pulsemesh-link');
  pulseMeshCard.classList.toggle('is-live', fresh);
  pulseMeshLink.classList.toggle('is-live', fresh);
  pulseMeshLink.setAttribute('aria-disabled', String(!fresh));
  pulseMeshLink.tabIndex = fresh ? 0 : -1;
  pulseMeshLink.textContent = fresh ? 'Listen live with PulseMesh ↗' : 'Show audio · offline';
  $('#pulsemesh-note').textContent = fresh
    ? 'The show is live. The player opens only when you choose it.'
    : 'Available while the show is live. The player opens only when you choose it.';

  if (!show) {
    $('#signal-label').textContent = 'Offline';
    $('#status-kicker').textContent = 'Show status';
    $('#now-title').textContent = 'The wings are resting';
    $('#now-artist').textContent = 'The lights make more sense with the sound turned on.';
    $('#next-title').textContent = '—';
    return;
  }

  $('#signal-label').textContent = fresh ? 'Live now' : 'Offline';
  $('#status-kicker').textContent = fresh ? 'Now playing' : 'Show status';
  $('#now-title').textContent = fresh
    ? songTitle(show.playingNowSequence, show.playingNow || 'Between songs')
    : 'The wings are resting';
  $('#now-artist').textContent = fresh
    ? show.playingNowSequence?.artist || 'Live from Lights On Admiral'
    : 'The lights make more sense with the sound turned on.';
  $('#next-title').textContent = songTitle(show.playingNextSequence, show.playingNext || show.playingNextFromSchedule || '—');
}

function renderQueue() {
  const queue = state.show?.queue || [];
  $('#queue-count').textContent = queue.length;
  const list = $('#queue-list');

  if (!queue.length) {
    list.innerHTML = `<li class="queue-empty">${isHeartbeatFresh(state.show?.lastFppHeartbeat) ? 'The light queue is open and ready for the first request.' : 'Requests will line up here once the show is live.'}</li>`;
    return;
  }

  list.replaceChildren(...queue.slice(0, 8).map((request) => {
    const item = document.createElement('li');
    item.textContent = songTitle(request.sequence);
    if (request.sequence.artist) {
      const artist = document.createElement('span');
      artist.textContent = request.sequence.artist;
      item.append(artist);
    }
    return item;
  }));
}

function isUnavailable(song) {
  if (song.visibilityCount > 0) return true;
  const limit = state.show?.preferences?.nightlyPlayLimit;
  return Boolean(limit && limit > 0 && song.playsToday >= limit);
}

function renderSongs() {
  const grid = $('#song-grid');
  if (state.loading) return;

  if (!state.show) {
    grid.innerHTML = `<div class="empty-state"><h3>The playlist is taking a quick intermission.</h3><p>We couldn't reach the show controller. Refresh in a moment or enjoy past shows on YouTube.</p></div>`;
    $('#song-count').textContent = 'Signal unavailable';
    $('#playlist-status').className = 'playlist-status is-offline';
    $('#playlist-status').innerHTML = '<i></i> Signal unavailable';
    return;
  }

  const songs = state.show.sequences.filter((song) => {
    const haystack = `${songTitle(song)} ${song.artist || ''}`.toLowerCase();
    return haystack.includes(state.query);
  });

  const fresh = isHeartbeatFresh(state.show.lastFppHeartbeat);
  $('#song-count').textContent = `${songs.length} ${songs.length === 1 ? 'song' : 'songs'}`;
  $('#playlist-status').className = `playlist-status ${fresh ? 'is-live' : 'is-browse'}`;
  $('#playlist-status').innerHTML = `<i></i> ${fresh ? 'Show live' : 'Browse playlist'}`;
  const mode = state.show.preferences?.viewerControlMode || 'JUKEBOX';
  const interactionReady = canInteract();
  $('#song-instructions').textContent = interactionReady
    ? mode === 'VOTING'
      ? 'Tap a song to cast your vote. The crowd decides what plays next.'
      : 'Tap a song and it joins the light queue.'
    : 'The playlist is here to browse. Song controls open when the show goes live.';

  if (!songs.length) {
    grid.innerHTML = `<div class="empty-state"><h3>${state.show.sequences.length ? 'No songs match that search.' : 'The playlist is still being assembled.'}</h3><p>${state.show.sequences.length ? 'Try a title or artist.' : 'Songs will appear automatically after the show controller syncs.'}</p></div>`;
    return;
  }

  grid.replaceChildren(...songs.map((song) => {
    const card = document.createElement('article');
    card.className = 'song-card';

    let artwork;
    if (song.imageUrl) {
      artwork = document.createElement('img');
      artwork.src = song.imageUrl;
      artwork.alt = '';
      artwork.loading = 'lazy';
      artwork.className = 'song-art';
      artwork.addEventListener('error', () => artwork.replaceWith(makeArtworkFallback()));
    } else {
      artwork = makeArtworkFallback();
    }

    const info = document.createElement('div');
    info.className = 'song-info';
    const heading = document.createElement('h3');
    heading.textContent = songTitle(song);
    const details = document.createElement('p');
    details.textContent = [song.artist, formatDuration(song.duration)].filter(Boolean).join(' · ') || 'Lights On Admiral';
    const meta = document.createElement('small');
    const votes = state.show.votes.get(song.name);
    meta.textContent = mode === 'VOTING' ? `${votes || 0} ${votes === 1 ? 'vote' : 'votes'}` : song.category || 'Light show track';
    info.append(heading, details, meta);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'song-action';
    button.dataset.song = song.name;
    const unavailable = isUnavailable(song);
    button.disabled = !interactionReady || unavailable || state.submitting.has(song.name);
    button.setAttribute('aria-label', `${mode === 'VOTING' ? 'Vote for' : 'Request'} ${songTitle(song)}`);
    button.title = unavailable ? 'This song is resting for now' : interactionReady ? (mode === 'VOTING' ? 'Vote for this song' : 'Add to queue') : 'Available when the show is live';
    button.innerHTML = mode === 'VOTING'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20S4 15.4 4 9.5A4.5 4.5 0 0 1 12 6.7a4.5 4.5 0 0 1 8 2.8C20 15.4 12 20 12 20Z"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
    button.addEventListener('click', () => handleSongSubmit(song));

    card.append(artwork, info, button);
    return card;
  }));
}

function makeArtworkFallback() {
  const artwork = document.createElement('div');
  artwork.className = 'song-art song-art-fallback';
  artwork.setAttribute('aria-hidden', 'true');
  return artwork;
}

async function acquireLocation(method) {
  if (method !== 'GEO') return { coords: null, permission: 'not-required' };
  if (!navigator.geolocation) return { coords: null, permission: 'unsupported' };

  try {
    const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    }));
    return {
      coords: { latitude: position.coords.latitude, longitude: position.coords.longitude },
      permission: 'granted'
    };
  } catch (error) {
    return { coords: null, permission: error.code === 1 ? 'denied' : 'unavailable' };
  }
}

async function handleSongSubmit(song) {
  if (!canInteract() || state.submitting.has(song.name)) return;
  const preferences = state.show.preferences || {};

  if (preferences.locationCheckMethod === 'CODE') {
    const code = window.prompt('Enter the location code shown at the display:');
    if (code === null) return;
    if (Number(code) !== Number(preferences.locationCode)) {
      showToast('That location code does not match. Check the sign and try again.', true);
      return;
    }
  }

  state.submitting.add(song.name);
  renderSongs();
  try {
    const location = await acquireLocation(preferences.locationCheckMethod);
    await submitSong({
      showSubdomain: SITE_CONFIG.showSubdomain,
      songName: song.name,
      mode: preferences.viewerControlMode,
      viewerId: getViewerId(),
      coords: location.coords,
      locationPermission: location.permission
    });
    showToast(preferences.viewerControlMode === 'VOTING' ? `Vote cast for “${songTitle(song)}”.` : `“${songTitle(song)}” joined the light queue.`);
    await refreshShow();
  } catch (error) {
    showToast(errorMessage(error), true);
  } finally {
    state.submitting.delete(song.name);
    renderSongs();
  }
}

function errorMessage(error) {
  const code = error instanceof RemoteFalconError ? error.code : 'UNEXPECTED_ERROR';
  return {
    QUEUE_FULL: 'The light queue is full right now. Try again after the next song.',
    INVALID_LOCATION: 'Song requests are only available at the display. Allow location access and try again.',
    ALREADY_VOTED: 'You already voted for that song.',
    DAILY_VOTE_LIMIT_REACHED: 'You’ve used tonight’s votes. Thanks for helping choose the show.',
    ALREADY_REQUESTED: 'You already have a song waiting in the queue.',
    SEQUENCE_REQUESTED: 'That song is already waiting in the queue.',
    SEQUENCE_UNAVAILABLE: 'That song is resting for now. Pick another favorite.',
    NETWORK_ERROR: 'The show signal dropped for a moment. Please try again.'
  }[code] || 'That request did not go through. Please try another song.';
}

function showToast(message, isError = false) {
  const toast = $('#toast');
  clearTimeout(state.toastTimer);
  toast.textContent = message;
  toast.classList.toggle('is-error', isError);
  toast.classList.add('is-visible');
  state.toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 5200);
}

function render() {
  renderStatus();
  renderSongs();
  renderQueue();
}

async function refreshShow() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    state.show = await fetchShow(SITE_CONFIG.showSubdomain, { signal: controller.signal });
    state.pollDelay = 8000;
  } catch (error) {
    state.pollDelay = Math.min(state.pollDelay * 1.8, 60000);
    if (!state.show) state.show = null;
  } finally {
    clearTimeout(timeout);
    state.loading = false;
    render();
    schedulePoll();
  }
}

function schedulePoll() {
  clearTimeout(state.pollTimer);
  if (!document.hidden) state.pollTimer = setTimeout(refreshShow, state.pollDelay);
}

function bindEvents() {
  $('#song-search').addEventListener('input', (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderSongs();
  });

  const navToggle = $('.nav-toggle');
  navToggle.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') !== 'true';
    navToggle.setAttribute('aria-expanded', String(open));
    $('#site-nav').classList.toggle('is-open', open);
  });
  $$('#site-nav a').forEach((link) => link.addEventListener('click', () => {
    navToggle.setAttribute('aria-expanded', 'false');
    $('#site-nav').classList.remove('is-open');
  }));

  $('#pulsemesh-link').addEventListener('click', (event) => {
    if (event.currentTarget.getAttribute('aria-disabled') === 'true') event.preventDefault();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(state.pollTimer);
    else refreshShow();
  });
}

applyConfig();
startFlyingGhost();
bindEvents();
revealPerformanceStage();
refreshShow();
