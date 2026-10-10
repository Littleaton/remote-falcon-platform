import { SITE_CONFIG } from './config.js?v=20261009-show-state1';
import {
  RemoteFalconError,
  fetchShow,
  fetchVotesRemaining,
  hasPlaybackActivity,
  isShowRunning,
  recordViewerPageView,
  sequenceAvailabilityReason,
  submitSong,
  voteTimeForSong,
  votesForSong
} from './api.js?v=20261009-rf-parity1';
import { choosePerformer } from './performers.js';

const state = {
  show: null,
  query: '',
  loading: true,
  submitting: new Set(),
  pollTimer: null,
  pollDelay: 5000,
  toastTimer: null,
  lastPlaybackAt: 0,
  votesRemaining: null,
  votesRemainingLoaded: false,
  pageViewRecorded: false,
  locationPermission: 'unknown',
  locationHelpNeeded: false,
  lastCoords: null
};

let pulseMeshFrame = null;

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

function randomizePumpkinPlacement() {
  if (document.documentElement.dataset.season !== 'halloween') return;

  const randomBetween = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);

  $$('.pumpkin-row').forEach((row) => {
    const pumpkins = [...row.querySelectorAll('.pumpkin-prop')];
    const isBackShoulder = row.classList.contains('pumpkin-row-back');
    const usableWidth = 92;
    const segmentWidth = usableWidth / pumpkins.length;

    pumpkins.forEach((pumpkin, index) => {
      const x = 4 + segmentWidth * (index + randomBetween(0.2, 0.8));
      pumpkin.style.setProperty('--pumpkin-x', `${x.toFixed(2)}%`);
      pumpkin.style.setProperty('--pumpkin-y', `${randomBetween(isBackShoulder ? -2 : -4, isBackShoulder ? 8 : 5).toFixed(1)}px`);
      pumpkin.style.setProperty('--pumpkin-scale', randomBetween(isBackShoulder ? 0.74 : 0.86, isBackShoulder ? 1 : 1.13).toFixed(3));
      pumpkin.style.setProperty('--pumpkin-tilt', `${randomBetween(-6, 6).toFixed(2)}deg`);
    });
  });
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

function startVisitTraffic() {
  const throughCars = $$('.car-through');
  const watchCars = $$('.car-watch');
  if (!throughCars.length || !watchCars.length || document.documentElement.dataset.season !== 'halloween') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const randomBetween = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);
  const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  const shuffled = (items) => [...items].sort(() => Math.random() - 0.5);
  const animateCar = async (car, keyframes, options, finalState) => {
    if (!car.isConnected) return;
    const animation = car.animate(keyframes, { ...options, fill: 'forwards' });
    try {
      await animation.finished;
      Object.assign(car.style, finalState);
    } catch {
      // Navigation or reduced-motion changes can cancel an in-flight car.
    } finally {
      animation.cancel();
    }
  };

  const runThroughLane = async () => {
    let queue = shuffled(throughCars);
    while (throughCars[0]?.isConnected) {
      await wait(randomBetween(2600, 8200));
      if (!queue.length) queue = shuffled(throughCars);
      const car = queue.shift();
      car.dataset.trafficState = 'passing';
      car.style.left = '112%';
      car.style.opacity = '0';
      await animateCar(
        car,
        [
          { left: '112%', opacity: 0 },
          { left: '108%', opacity: 1, offset: 0.035 },
          { left: '-12%', opacity: 1, offset: 0.965 },
          { left: '-16%', opacity: 0 }
        ],
        { duration: randomBetween(8200, 12600), easing: 'linear' },
        { left: '-16%', opacity: '0' }
      );
      car.dataset.trafficState = 'idle';
    }
  };

  const runWatchLane = async () => {
    let firstCycle = true;
    while (watchCars[0]?.isConnected) {
      await wait(firstCycle ? randomBetween(500, 1400) : randomBetween(4800, 13200));
      firstCycle = false;

      const roll = Math.random();
      const queueSize = roll < 0.22 ? 1 : roll < 0.64 ? 2 : 3;
      const activeCars = shuffled(watchCars).slice(0, queueSize);
      const stopPositions = [66, 45, 24];
      const laneOffset = randomBetween(-2.5, 2.5);
      const queue = [];

      for (let index = 0; index < activeCars.length; index += 1) {
        const car = activeCars[index];
        const stop = stopPositions[index] + laneOffset;
        const start = -16;
        car.dataset.trafficState = 'arriving';
        car.style.left = `${start}%`;
        car.style.opacity = '0';
        await animateCar(
          car,
          [
            { left: `${start}%`, opacity: 0 },
            { left: `${start + 4}%`, opacity: 1, offset: 0.05 },
            { left: `${stop}%`, opacity: 1 }
          ],
          { duration: randomBetween(3300, 5200), easing: 'cubic-bezier(.25,.72,.3,1)' },
          { left: `${stop}%`, opacity: '1' }
        );
        car.dataset.trafficState = index === 0 ? 'watching' : 'queued';
        queue.push(car);
        if (index < activeCars.length - 1) await wait(randomBetween(1200, 4200));
      }

      while (queue.length) {
        const leadCar = queue.shift();
        leadCar.dataset.trafficState = 'watching';
        await wait(randomBetween(7600, 17800));
        leadCar.dataset.trafficState = 'leaving';
        const start = Number.parseFloat(leadCar.style.left);
        await animateCar(
          leadCar,
          [
            { left: `${start}%`, opacity: 1 },
            { left: '112%', opacity: 1, offset: 0.94 },
            { left: '116%', opacity: 0 }
          ],
          { duration: randomBetween(3400, 5200), easing: 'cubic-bezier(.45,0,.55,1)' },
          { left: '116%', opacity: '0' }
        );
        leadCar.dataset.trafficState = 'idle';

        if (queue.length) {
          const advanceDuration = randomBetween(1800, 3100);
          await Promise.all(queue.map((car, index) => {
            const from = Number.parseFloat(car.style.left);
            const nextStop = stopPositions[index] + laneOffset;
            car.dataset.trafficState = index === 0 ? 'advancing' : 'queued';
            return animateCar(
              car,
              [
                { left: `${from}%`, opacity: 1 },
                { left: `${nextStop}%`, opacity: 1 }
              ],
              { duration: advanceDuration, easing: 'cubic-bezier(.3,.7,.3,1)' },
              { left: `${nextStop}%`, opacity: '1' }
            );
          }));
        }
      }
    }
  };

  runThroughLane();
  runWatchLane();
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
    link.dataset.playerUrl = SITE_CONFIG.pulseMeshUrl;
    $('#pulsemesh-fallback').href = SITE_CONFIG.pulseMeshUrl;
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

function viewerIdForShow() {
  return state.show?.preferences?.analyticsBetaOptIn ? getViewerId() : null;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function songTitle(song, fallback = '—') {
  return song?.displayName || song?.name || fallback;
}

function safeArtworkUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function setStatusArtwork(song, running) {
  const copy = $('.now-copy');
  const frame = $('#now-artwork');
  const image = $('#now-artwork-image');
  const url = running ? safeArtworkUrl(song?.imageUrl) : '';
  copy.classList.toggle('has-artwork', Boolean(url));
  frame.hidden = !url;
  if (!url) {
    image.removeAttribute('src');
    image.alt = '';
    return;
  }
  image.src = url;
  image.alt = `Artwork for ${songTitle(song)}`;
}

function songVoteTime(song) {
  const parsed = Date.parse(voteTimeForSong(state.show, song) || '');
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function orderedSongsForDisplay(songs) {
  const categories = state.show?.categories || [];
  const rankByCategory = new Map(
    [...categories]
      .map((category, index) => ({
        name: category?.name,
        order: Number.isFinite(category?.displayOrder) ? category.displayOrder : index,
        index
      }))
      .sort((a, b) => a.order - b.order || a.index - b.index)
      .map((category, index) => [category.name, index])
  );
  const mode = state.show?.preferences?.viewerControlMode || 'JUKEBOX';

  return songs
    .map((song, index) => ({ song, index }))
    .sort((a, b) => {
      const aCategory = a.song.category ? (rankByCategory.get(a.song.category) ?? Number.MAX_SAFE_INTEGER) : -1;
      const bCategory = b.song.category ? (rankByCategory.get(b.song.category) ?? Number.MAX_SAFE_INTEGER) : -1;
      if (aCategory !== bCategory) return aCategory - bCategory;
      if (mode === 'VOTING') {
        const voteDifference = votesForSong(state.show, b.song) - votesForSong(state.show, a.song);
        if (voteDifference) return voteDifference;
        const timeDifference = songVoteTime(a.song) - songVoteTime(b.song);
        if (timeDifference) return timeDifference;
      }
      return a.index - b.index;
    })
    .map(({ song }) => song);
}

function showIsRunning() {
  return isShowRunning(state.show, { lastPlaybackAt: state.lastPlaybackAt });
}

function canInteract() {
  const show = state.show;
  return Boolean(
    show &&
      showIsRunning() &&
      show.preferences?.viewerControlEnabled &&
      !show.preferences?.viewerPageViewOnly
  );
}

function pulseMeshPlayerUrl() {
  try {
    const url = new URL($('#pulsemesh-link').dataset.playerUrl || SITE_CONFIG.pulseMeshUrl);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function renderPulseMesh(running) {
  const button = $('#pulsemesh-link');
  const dialog = $('#pulsemesh-dialog');
  const dock = $('#pulsemesh-dock');
  const loaded = Boolean(pulseMeshFrame);

  button.disabled = !loaded && !running;
  button.setAttribute('aria-disabled', String(!loaded && !running));
  button.classList.toggle('is-live', running || loaded);
  button.textContent = loaded ? 'Reopen show audio ↑' : running ? 'Listen to show audio' : 'Show audio · offline';
  $('#pulsemesh-note').textContent = loaded
    ? 'Your PulseMesh player stays loaded when minimized. Reopen it to adjust playback, or Stop to close it.'
    : running
      ? 'Opens the player here. Allow location, choose Lights On Admiral, then tap Listen.'
      : 'Available only while Remote Falcon reports that the show is running. Nothing loads automatically.';
  dock.hidden = !loaded || dialog.open;
  document.body.classList.toggle('pulsemesh-active', loaded);
}

function reopenPulseMesh() {
  if (!pulseMeshFrame) return;
  const dialog = $('#pulsemesh-dialog');
  if (!dialog.open) dialog.showModal();
  renderPulseMesh(showIsRunning());
}

function startPulseMesh() {
  if (pulseMeshFrame) {
    reopenPulseMesh();
    return;
  }
  if (!showIsRunning()) return;

  const url = pulseMeshPlayerUrl();
  if (!url) {
    $('#pulsemesh-note').textContent = 'The PulseMesh player needs a valid secure address. Please use 107.7 FM for now.';
    return;
  }

  const frame = document.createElement('iframe');
  frame.title = 'PulseMesh nearby displays and Lights On Admiral show audio';
  frame.allow = 'autoplay; geolocation';
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.src = url;
  pulseMeshFrame = frame;
  $('#pulsemesh-frame-slot').append(frame);
  reopenPulseMesh();
}

function minimizePulseMesh() {
  const dialog = $('#pulsemesh-dialog');
  if (dialog.open) dialog.close();
  renderPulseMesh(showIsRunning());
}

function stopPulseMesh(message = '') {
  const hadPlayer = Boolean(pulseMeshFrame);
  pulseMeshFrame?.remove();
  pulseMeshFrame = null;
  const dialog = $('#pulsemesh-dialog');
  if (dialog.open) dialog.close();
  renderPulseMesh(showIsRunning());
  if (message && hadPlayer) $('#pulsemesh-note').textContent = message;
}

function renderStatus() {
  const show = state.show;
  const card = $('#signal-card');
  const running = showIsRunning();
  card.classList.toggle('is-live', running);
  const header = $('#header-show-status');
  header.classList.toggle('is-live', running);
  $('#header-status-label').textContent = running ? 'Show live' : 'Show offline';
  const pulseMeshCard = $('#pulsemesh-card');
  pulseMeshCard.classList.toggle('is-live', running);
  if (!running && pulseMeshFrame) stopPulseMesh('Remote Falcon reports that the show has stopped, so the phone player was closed.');
  else renderPulseMesh(running);

  if (!show) {
    $('#signal-label').textContent = 'Offline';
    $('#status-kicker').textContent = 'Show status';
    $('#now-title').textContent = 'The wings are resting';
    $('#now-artist').textContent = 'The lights make more sense with the sound turned on.';
    $('#next-title').textContent = '—';
    setStatusArtwork(null, false);
    return;
  }

  $('#signal-label').textContent = running ? 'Live now' : 'Offline';
  $('#status-kicker').textContent = running ? 'Now playing' : 'Show status';
  $('#now-title').textContent = running
    ? songTitle(show.playingNowSequence, show.playingNow || 'Between songs')
    : 'The wings are resting';
  $('#now-artist').textContent = running
    ? [show.playingNowSequence?.artist, formatDuration(show.playingNowSequence?.duration)].filter(Boolean).join(' · ') || 'Live from Lights On Admiral'
    : 'The lights make more sense with the sound turned on.';
  $('#next-title').textContent = songTitle(show.playingNextSequence, show.playingNext || show.playingNextFromSchedule || '—');
  setStatusArtwork(show.playingNowSequence, running);
}

function renderQueue() {
  if (!state.show) return;
  const queue = state.show?.queue || [];
  const list = $('#queue-list');
  const mode = state.show.preferences?.viewerControlMode || 'JUKEBOX';

  if (mode === 'VOTING') {
    const leaders = state.show.sequences
      .map((song) => ({ song, votes: votesForSong(state.show, song) }))
      .filter((entry) => entry.votes > 0)
      .sort((a, b) => b.votes - a.votes || songVoteTime(a.song) - songVoteTime(b.song));
    $('#queue-label').textContent = 'Live voting';
    $('#queue-title').textContent = 'Top votes tonight';
    $('#queue-count').textContent = leaders.length;
    if (!leaders.length) {
      list.innerHTML = `<li class="queue-empty">${showIsRunning() ? 'No votes yet. Pick the song you want to see next.' : 'Voting opens when the show goes live.'}</li>`;
      return;
    }
    list.replaceChildren(...leaders.slice(0, 8).map(({ song, votes }) => {
      const item = document.createElement('li');
      item.textContent = songTitle(song);
      const detail = document.createElement('span');
      detail.textContent = `${votes} ${votes === 1 ? 'vote' : 'votes'}${song.artist ? ` · ${song.artist}` : ''}`;
      item.append(detail);
      return item;
    }));
    return;
  }

  $('#queue-label').textContent = 'Light queue';
  $('#queue-title').textContent = 'Coming up tonight';
  $('#queue-count').textContent = queue.length;

  if (!queue.length) {
    list.innerHTML = `<li class="queue-empty">${showIsRunning() ? 'The light queue is open and ready for the first request.' : 'Requests will line up here once the show is live.'}</li>`;
    return;
  }

  list.replaceChildren(...queue.slice(1, 9).map((request) => {
    const item = document.createElement('li');
    item.textContent = songTitle(request.sequence);
    if (request.sequence.artist) {
      const artist = document.createElement('span');
      artist.textContent = request.sequence.artist;
      item.append(artist);
    }
    return item;
  }));
  if (!list.children.length) {
    list.innerHTML = '<li class="queue-empty">The next request is already moving into position.</li>';
  }
}

function renderSongs() {
  const grid = $('#song-grid');
  if (state.loading) return;

  if (!state.show) {
    grid.innerHTML = `<div class="empty-state"><h3>The playlist is taking a quick intermission.</h3><p>We couldn't reach the show controller. Refresh in a moment or enjoy past shows on YouTube.</p></div>`;
    $('#song-count').textContent = 'Signal unavailable';
    $('#playlist-status').className = 'playlist-status is-offline';
    $('#playlist-status').innerHTML = '<i></i> Signal unavailable';
    $('#interaction-summary').textContent = 'Controls reconnect when the show signal returns.';
    return;
  }

  const songs = orderedSongsForDisplay(state.show.sequences.filter((song) => {
    const haystack = `${songTitle(song)} ${song.artist || ''}`.toLowerCase();
    return haystack.includes(state.query);
  }));

  const fresh = showIsRunning();
  $('#song-count').textContent = `${songs.length} ${songs.length === 1 ? 'song' : 'songs'}`;
  $('#playlist-status').className = `playlist-status ${fresh ? 'is-live' : 'is-browse'}`;
  $('#playlist-status').innerHTML = `<i></i> ${fresh ? 'Show live' : 'Browse playlist'}`;
  const mode = state.show.preferences?.viewerControlMode || 'JUKEBOX';
  const interactionReady = canInteract();
  const readOnly = state.show.preferences?.viewerPageViewOnly;
  $('#song-instructions').textContent = readOnly
    ? 'The playlist is in view-only mode. You can browse tonight’s music, but requests and votes are paused.'
    : interactionReady
      ? mode === 'VOTING'
        ? 'Tap a song to cast your vote. The crowd decides what plays next.'
        : 'Tap a song and it joins the light queue.'
      : 'The playlist is here to browse. Song controls open when the show goes live.';

  const interactionSummary = $('#interaction-summary');
  if (readOnly) {
    interactionSummary.textContent = 'View-only mode';
  } else if (mode === 'VOTING' && (state.show.preferences?.dailyVoteLimit || 0) > 0 && state.votesRemainingLoaded) {
    interactionSummary.textContent = state.votesRemaining === null
      ? 'Voting allowance managed by Remote Falcon'
      : `${state.votesRemaining} of ${state.show.preferences.dailyVoteLimit} votes left this show`;
  } else if (mode === 'JUKEBOX' && (state.show.preferences?.jukeboxDepth || 0) > 0) {
    interactionSummary.textContent = `${state.show.queue.length} of ${state.show.preferences.jukeboxDepth} queue spots filled`;
  } else {
    interactionSummary.textContent = mode === 'VOTING' ? 'Live voting' : 'Jukebox requests';
  }

  if (!songs.length) {
    grid.innerHTML = `<div class="empty-state"><h3>${state.show.sequences.length ? 'No songs match that search.' : 'The playlist is still being assembled.'}</h3><p>${state.show.sequences.length ? 'Try a title or artist.' : 'Songs will appear automatically after the show controller syncs.'}</p></div>`;
    return;
  }

  const elements = [];
  let lastCategory = null;
  songs.forEach((song) => {
    const category = song.category || '';
    if (category && category !== lastCategory) {
      const heading = document.createElement('h3');
      heading.className = 'song-category-heading';
      heading.textContent = category;
      elements.push(heading);
    }
    lastCategory = category;

    const card = document.createElement('article');
    card.className = 'song-card';
    const unavailableReason = sequenceAvailabilityReason(state.show, song);
    const isPlaying = [state.show.playingNow, state.show.playingNowSequence?.name]
      .filter(Boolean)
      .includes(song.name);
    const isQueued = state.show.queue.some((request) => request.sequence?.name === song.name);
    card.classList.toggle('is-unavailable', Boolean(unavailableReason));
    card.classList.toggle('is-playing', isPlaying);
    card.classList.toggle('is-queued', isQueued);

    let artwork;
    const artworkUrl = safeArtworkUrl(song.imageUrl);
    if (artworkUrl) {
      artwork = document.createElement('img');
      artwork.src = artworkUrl;
      artwork.alt = `Artwork for ${songTitle(song)}`;
      artwork.loading = 'lazy';
      artwork.referrerPolicy = 'no-referrer';
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
    details.textContent = [song.artist, formatDuration(song.duration), song.type === 'SEQUENCE_GROUP' ? 'Song group' : ''].filter(Boolean).join(' · ') || 'Lights On Admiral';
    const meta = document.createElement('small');
    const votes = votesForSong(state.show, song);
    meta.textContent = mode === 'VOTING' ? `${votes} ${votes === 1 ? 'vote' : 'votes'}` : isPlaying ? 'Playing now' : isQueued ? 'In the queue' : song.category || 'Light show track';
    info.append(heading, details, meta);
    if (unavailableReason) {
      const availability = document.createElement('span');
      availability.className = 'song-availability';
      availability.textContent = unavailableReason;
      info.append(availability);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'song-action';
    button.dataset.song = song.name;
    const noVotesLeft = mode === 'VOTING' && state.votesRemainingLoaded && state.votesRemaining === 0;
    button.disabled = !interactionReady || Boolean(unavailableReason) || noVotesLeft || state.submitting.has(song.name);
    button.setAttribute('aria-label', `${mode === 'VOTING' ? 'Vote for' : 'Request'} ${songTitle(song)}`);
    button.title = unavailableReason || (noVotesLeft ? 'You have used tonight’s votes' : interactionReady ? (mode === 'VOTING' ? 'Vote for this song' : 'Add to queue') : 'Available when the show is live');
    button.innerHTML = mode === 'VOTING'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20S4 15.4 4 9.5A4.5 4.5 0 0 1 12 6.7a4.5 4.5 0 0 1 8 2.8C20 15.4 12 20 12 20Z"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
    button.addEventListener('click', () => handleSongSubmit(song));

    card.append(artwork, info, button);
    elements.push(card);
  });
  grid.replaceChildren(...elements);
}

function makeArtworkFallback() {
  const artwork = document.createElement('div');
  artwork.className = 'song-art song-art-fallback';
  artwork.setAttribute('aria-hidden', 'true');
  return artwork;
}

function isInAppBrowser() {
  return /FBAN|FBAV|FB_IAB|FB4A|FBIOS|Instagram/i.test(navigator.userAgent || '');
}

async function queryLocationPermission() {
  if (!navigator.geolocation) return 'unsupported';
  if (!navigator.permissions?.query) return 'unknown';
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return ['granted', 'denied', 'prompt'].includes(status?.state) ? status.state : 'unknown';
  } catch {
    return 'unknown';
  }
}

function renderLocationHelp() {
  const help = $('#location-help');
  if (!help) return;
  const isGeo = state.show?.preferences?.locationCheckMethod === 'GEO';
  const shouldShow = isGeo && (state.locationHelpNeeded || ['denied', 'unsupported'].includes(state.locationPermission));
  help.hidden = !shouldShow;
  if (!shouldShow) return;

  const copy = $('#location-help-copy');
  const retry = $('#location-retry');
  if (isInAppBrowser()) {
    copy.textContent = 'This in-app browser may not share your location. Open this page in Safari or Chrome, then try again.';
    retry.textContent = 'Try location again';
  } else if (state.locationPermission === 'denied') {
    copy.textContent = 'Location is blocked for this site. Allow it in your browser settings, return here, then try again.';
    retry.textContent = 'Check location again';
  } else if (state.locationPermission === 'unsupported') {
    copy.textContent = 'This browser cannot share location. Open the site in Safari, Chrome, or Edge to request a song.';
    retry.hidden = true;
    return;
  } else {
    copy.textContent = 'Remote Falcon needs your location to confirm you are at the show. Tap below and allow access when prompted.';
    retry.textContent = 'Enable location';
  }
  retry.hidden = false;
}

async function acquireLocation(method) {
  if (method !== 'GEO') return { coords: null, permission: 'not-required' };
  if (!navigator.geolocation) {
    state.locationPermission = 'unsupported';
    state.locationHelpNeeded = true;
    renderLocationHelp();
    return { coords: null, permission: 'unsupported' };
  }

  try {
    const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000
    }));
    state.lastCoords = {
      latitude: Number(position.coords.latitude.toFixed(5)),
      longitude: Number(position.coords.longitude.toFixed(5))
    };
    state.locationPermission = 'granted';
    state.locationHelpNeeded = false;
    renderLocationHelp();
    return { coords: state.lastCoords, permission: 'granted' };
  } catch (error) {
    const queried = await queryLocationPermission();
    state.locationPermission = queried === 'unknown' ? (error?.code === 1 ? 'uncertain' : 'unavailable') : queried;
    state.locationHelpNeeded = true;
    renderLocationHelp();
    return { coords: state.lastCoords, permission: state.locationPermission };
  }
}

async function retryLocation() {
  const result = await acquireLocation('GEO');
  if (result.coords) showToast('Location is ready. You can request or vote now.');
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
    if (preferences.locationCheckMethod === 'GEO' && !location.coords) {
      showToast('We still need your location before Remote Falcon can accept that choice.', true);
      return;
    }
    await submitSong({
      showSubdomain: SITE_CONFIG.showSubdomain,
      songName: song.name,
      mode: preferences.viewerControlMode,
      viewerId: viewerIdForShow(),
      coords: location.coords,
      locationPermission: location.permission
    });
    showToast(preferences.viewerControlMode === 'VOTING' ? `Vote cast for “${songTitle(song)}”.` : `“${songTitle(song)}” joined the light queue.`);
    if (preferences.viewerControlMode === 'VOTING') await refreshVotesRemaining();
    await refreshShow();
  } catch (error) {
    if (error instanceof RemoteFalconError && error.code === 'INVALID_LOCATION') {
      state.locationHelpNeeded = true;
      renderLocationHelp();
    }
    const message = errorMessage(error);
    if (message) showToast(message, true);
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
    NAUGHTY: '',
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
  renderLocationHelp();
}

async function refreshVotesRemaining() {
  const preferences = state.show?.preferences || {};
  if (preferences.viewerControlMode !== 'VOTING' || (preferences.dailyVoteLimit || 0) <= 0) {
    state.votesRemaining = null;
    state.votesRemainingLoaded = false;
    return;
  }
  try {
    state.votesRemaining = await fetchVotesRemaining(SITE_CONFIG.showSubdomain, viewerIdForShow());
  } catch {
    state.votesRemaining = null;
  } finally {
    state.votesRemainingLoaded = true;
  }
}

function localDateTime() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

async function recordPageViewIfNeeded() {
  if (state.pageViewRecorded || !state.show) return;
  state.pageViewRecorded = true;
  const params = new URLSearchParams(window.location.search);
  try {
    await recordViewerPageView({
      showSubdomain: SITE_CONFIG.showSubdomain,
      date: localDateTime(),
      viewerId: viewerIdForShow(),
      utmSource: params.get('utm_source'),
      utmMedium: params.get('utm_medium')
    });
    if (params.has('utm_source') || params.has('utm_medium')) {
      params.delete('utm_source');
      params.delete('utm_medium');
      const query = params.toString();
      history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    }
  } catch {
    // Analytics must never block the viewer experience.
  }
}

async function refreshShow() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const previousMode = state.show?.preferences?.viewerControlMode;
    state.show = await fetchShow(SITE_CONFIG.showSubdomain, { signal: controller.signal });
    if (previousMode && previousMode !== state.show?.preferences?.viewerControlMode) {
      state.votesRemaining = null;
      state.votesRemainingLoaded = false;
    }
    if (hasPlaybackActivity(state.show)) state.lastPlaybackAt = Date.now();
    else if (state.show?.preferences?.viewerControlEnabled !== true) state.lastPlaybackAt = 0;
    state.pollDelay = 5000;
    if (!state.votesRemainingLoaded) await refreshVotesRemaining();
    void recordPageViewIfNeeded();
    if (state.show?.preferences?.locationCheckMethod === 'GEO' && state.locationPermission === 'unknown') {
      state.locationPermission = await queryLocationPermission();
      state.locationHelpNeeded = state.locationPermission === 'denied';
    }
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

  $('#pulsemesh-link').addEventListener('click', startPulseMesh);
  $('#pulsemesh-reopen').addEventListener('click', reopenPulseMesh);
  $('#pulsemesh-minimize').addEventListener('click', minimizePulseMesh);
  $('#pulsemesh-stop').addEventListener('click', () => stopPulseMesh());
  $('#pulsemesh-dock-stop').addEventListener('click', () => stopPulseMesh());
  $('#pulsemesh-dialog').addEventListener('cancel', (event) => {
    event.preventDefault();
    minimizePulseMesh();
  });
  $('#pulsemesh-dialog').addEventListener('close', () => renderPulseMesh(showIsRunning()));
  $('#location-retry').addEventListener('click', retryLocation);
  $('#now-artwork-image').addEventListener('error', () => {
    $('.now-copy').classList.remove('has-artwork');
    $('#now-artwork').hidden = true;
  });

  if (navigator.permissions?.query) {
    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      status.addEventListener('change', () => {
        state.locationPermission = status.state;
        state.locationHelpNeeded = status.state === 'denied';
        renderLocationHelp();
      });
    }).catch(() => {});
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(state.pollTimer);
    else refreshShow();
  });
}

applyConfig();
randomizePumpkinPlacement();
startFlyingGhost();
startVisitTraffic();
bindEvents();
revealPerformanceStage();
refreshShow();
