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
        locationCheckMethod
        locationCode
        dailyVoteLimit
        nightlyPlayLimit
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
        order
      }
      requests {
        position
        sequence { name displayName artist imageUrl }
      }
      votes {
        votes
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
    throw new RemoteFalconError(first.extensions?.message || first.message || 'UNEXPECTED_ERROR');
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

export function normalizeShow(show) {
  if (!show) return null;

  const sequences = [...(show.sequences || [])]
    .filter((song) => song && song.active !== false && song.visible !== false)
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));

  const queue = [...(show.requests || [])]
    .filter((request) => request?.sequence)
    .sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999));

  const votes = new Map();
  for (const vote of show.votes || []) {
    const name = vote?.sequence?.name || vote?.sequenceGroup?.name;
    if (name) votes.set(name, vote.votes || 0);
  }

  return { ...show, sequences, queue, votes };
}

export function isHeartbeatFresh(heartbeat, now = Date.now()) {
  if (!heartbeat) return false;
  const parsed = Date.parse(heartbeat);
  return Number.isFinite(parsed) && now - parsed < 180_000;
}
