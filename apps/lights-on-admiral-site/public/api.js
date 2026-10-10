const SHOW_QUERY = `
  query LightsOnAdmiralShow($showSubdomain: String!) {
    getShow(showSubdomain: $showSubdomain) {
      showName
      showSubdomain
      lastFppHeartbeat
      playingNow
      playingNowSequence { name displayName artist duration imageUrl category }
      playingNext
      playingNextSequence { name displayName artist duration imageUrl category }
      playingNextFromSchedule
      preferences {
        viewerControlEnabled
        viewerPageViewOnly
        viewerControlMode
        jukeboxDepth
        jukeboxRequestLimit
        checkIfRequested
        checkIfVoted
        locationCheckMethod
        locationCode
        dailyVoteLimit
        nightlyPlayLimit
        lastPlayCountedAt
        analyticsBetaOptIn
      }
      sequences {
        name
        displayName
        artist
        duration
        imageUrl
        category
        active
        visible
        visibilityCount
        playsToday
        index
        order
        type
        group
      }
      categories {
        name
        displayOrder
        nightlyPlayLimit
      }
      requests {
        position
        sequence { name displayName artist imageUrl }
      }
      votes {
        votes
        lastVoteTime
        systemInjected
        sequence { name displayName }
        sequenceGroup { name }
      }
    }
  }
`;

const REQUEST_MUTATION = `
  mutation AddLightsOnAdmiralRequest(
    $showSubdomain: String!,
    $name: String!,
    $latitude: Float,
    $longitude: Float,
    $viewerId: String,
    $locationPermission: String
  ) {
    addSequenceToQueue(
      showSubdomain: $showSubdomain,
      name: $name,
      latitude: $latitude,
      longitude: $longitude,
      viewerId: $viewerId,
      locationPermission: $locationPermission
    )
  }
`;

const VOTE_MUTATION = `
  mutation VoteForLightsOnAdmiralSong(
    $showSubdomain: String!,
    $name: String!,
    $latitude: Float,
    $longitude: Float,
    $viewerId: String
  ) {
    voteForSequence(
      showSubdomain: $showSubdomain,
      name: $name,
      latitude: $latitude,
      longitude: $longitude,
      viewerId: $viewerId
    )
  }
`;

const VOTES_REMAINING_QUERY = `
  query LightsOnAdmiralVotesRemaining($showSubdomain: String!, $viewerId: String) {
    votesRemaining(showSubdomain: $showSubdomain, viewerId: $viewerId)
  }
`;

const PAGE_VIEW_MUTATION = `
  mutation RecordLightsOnAdmiralPageView(
    $showSubdomain: String!,
    $date: DateTime!,
    $viewerId: String,
    $utmSource: String,
    $utmMedium: String
  ) {
    insertViewerPageStats(
      showSubdomain: $showSubdomain,
      date: $date,
      viewerId: $viewerId,
      utmSource: $utmSource,
      utmMedium: $utmMedium
    )
  }
`;

const KNOWN_ERROR_CODES = new Set([
  'QUEUE_FULL',
  'INVALID_LOCATION',
  'SEQUENCE_REQUESTED',
  'SEQUENCE_UNAVAILABLE',
  'ALREADY_VOTED',
  'DAILY_VOTE_LIMIT_REACHED',
  'ALREADY_REQUESTED',
  'NAUGHTY',
  'UNEXPECTED_ERROR'
]);

export function normalizeErrorCode(value) {
  const message = String(value || 'UNEXPECTED_ERROR');
  return [...KNOWN_ERROR_CODES].find((code) => message.includes(code)) || 'UNEXPECTED_ERROR';
}

export class RemoteFalconError extends Error {
  constructor(code = 'UNEXPECTED_ERROR') {
    super(code);
    this.name = 'RemoteFalconError';
    this.code = code;
  }
}

export async function graphQLRequest(query, variables, { signal } = {}) {
  const response = await fetch('/remote-falcon-viewer/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Route: 'Viewer'
    },
    cache: 'no-store',
    signal,
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new RemoteFalconError('NETWORK_ERROR');
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    const first = payload.errors[0];
    throw new RemoteFalconError(normalizeErrorCode(first.extensions?.message || first.message));
  }

  return payload.data;
}

export async function fetchShow(showSubdomain, options) {
  const data = await graphQLRequest(SHOW_QUERY, { showSubdomain }, options);
  return normalizeShow(data?.getShow);
}

export async function submitSong({ showSubdomain, songName, mode, viewerId, coords, locationPermission }) {
  const variables = {
    showSubdomain,
    name: songName,
    viewerId,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null
  };

  if (mode === 'VOTING') {
    const data = await graphQLRequest(VOTE_MUTATION, variables);
    return data?.voteForSequence === true;
  }

  const data = await graphQLRequest(REQUEST_MUTATION, {
    ...variables,
    locationPermission: locationPermission || 'unknown'
  });
  return data?.addSequenceToQueue === true;
}

export async function fetchVotesRemaining(showSubdomain, viewerId, options) {
  const data = await graphQLRequest(VOTES_REMAINING_QUERY, { showSubdomain, viewerId }, options);
  return Number.isFinite(data?.votesRemaining) ? data.votesRemaining : null;
}

export async function recordViewerPageView({ showSubdomain, date, viewerId = null, utmSource = null, utmMedium = null }) {
  const data = await graphQLRequest(PAGE_VIEW_MUTATION, { showSubdomain, date, viewerId, utmSource, utmMedium });
  return data?.insertViewerPageStats === true;
}

export function normalizeShow(show) {
  if (!show) return null;

  const sequences = [...(show.sequences || [])]
    .filter((song) => song && song.active !== false && song.visible !== false)
    .sort((a, b) => (a.order ?? a.index ?? 9999) - (b.order ?? b.index ?? 9999));

  const queue = [...(show.requests || [])]
    .filter((request) => request?.sequence)
    .sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999));

  const voteTotals = new Map();
  const voteTimes = new Map();
  for (const vote of show.votes || []) {
    if (vote?.systemInjected || (vote?.votes || 0) >= 2000) continue;
    const name = vote?.sequence?.name || vote?.sequenceGroup?.name;
    if (name) {
      voteTotals.set(name, vote.votes || 0);
      voteTimes.set(name, vote.lastVoteTime || null);
    }
  }

  return { ...show, sequences, queue, voteTotals, voteTimes };
}

export function votesForSong(show, song) {
  if (!show || !song) return 0;
  return show.voteTotals?.get(song.name) ?? (song.group ? show.voteTotals?.get(song.group) : undefined) ?? 0;
}

export function voteTimeForSong(show, song) {
  if (!show || !song) return null;
  return show.voteTimes?.get(song.name) ?? (song.group ? show.voteTimes?.get(song.group) : undefined) ?? null;
}

const SERVER_OFFSET_SUFFIX = /(Z|[+-]\d{2}:?\d{2})$/i;

export function parseServerDateTime(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  const text = String(value).trim();
  const parsed = Date.parse(SERVER_OFFSET_SUFFIX.test(text) ? text : `${text}Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isNightlyTallyCurrent(lastPlayCountedAt, now = Date.now()) {
  const parsed = parseServerDateTime(lastPlayCountedAt);
  return parsed !== null && parsed >= now - 6 * 60 * 60 * 1000;
}

export function effectiveNightlyLimit(show, song) {
  const category = (show?.categories || []).find(
    (item) => item?.name && song?.category && item.name.toLowerCase() === song.category.toLowerCase()
  );
  return category?.nightlyPlayLimit ?? show?.preferences?.nightlyPlayLimit ?? null;
}

export function sequenceAvailabilityReason(show, song, now = Date.now()) {
  if ((song?.visibilityCount ?? 0) > 0) return 'Available again soon';
  if (!isNightlyTallyCurrent(show?.preferences?.lastPlayCountedAt, now)) return '';
  const limit = effectiveNightlyLimit(show, song);
  if (Number.isFinite(limit) && limit > 0 && (song?.playsToday ?? 0) >= limit) return 'Back next show';
  return '';
}

export function isHeartbeatFresh(heartbeat, now = Date.now()) {
  if (!heartbeat) return false;
  const parsed = Date.parse(heartbeat);
  return Number.isFinite(parsed) && now - parsed < 180_000;
}

export function hasPlaybackActivity(show) {
  return [show?.playingNow, show?.playingNext, show?.playingNextFromSchedule]
    .some((value) => typeof value === 'string' && value.trim().length > 0);
}

export function isShowRunning(show, { now = Date.now(), lastPlaybackAt = 0, graceMs = 45_000 } = {}) {
  if (!show || !isHeartbeatFresh(show.lastFppHeartbeat, now)) return false;
  if (show.preferences?.viewerControlEnabled !== true) return false;
  if (hasPlaybackActivity(show)) return true;
  return Number.isFinite(lastPlaybackAt) && lastPlaybackAt > 0 && now - lastPlaybackAt < graceMs;
}
