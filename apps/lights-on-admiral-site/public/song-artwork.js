const ARTWORK_BY_SEQUENCE = new Map([
  ['BFLS - Skeleton Sam HD Layout', './assets/song-art/skeleton-sam.jpg'],
  ['BFLS-Bloody Mary - Lady Gaga (Wednesday Dance TikTok Version)', './assets/song-art/bloody-mary.jpg'],
  ['free-Halloween Night', './assets/song-art/halloween-night.jpg'],
  ['free-Monster Mash', './assets/song-art/monster-mash.jpg'],
  ['LOA-becky g problem the monster remix ft will i am', './assets/song-art/problem-monster-remix.jpg'],
  ['MLS-Best of Michael Jackson', './assets/song-art/best-of-michael-jackson.jpg'],
  ['MLS-Grim Grinning Ghosts (Electro Swing Mix)', './assets/song-art/grim-grinning-ghosts.jpg'],
  ['MLS-Spooky_ Scary Skeletons (Undead Tombstone Remix)', './assets/song-art/spooky-scary-skeletons.jpg'],
  ['PPD-Christina Aguilera Haunted Heart', './assets/song-art/haunted-heart.jpg'],
  ["PPD-Rockwell Somebody's Watching Me Halloween Pro Layout", './assets/song-art/somebodys-watching-me.jpg'],
  ['PPD-Sheb Wooley The Purple People Eater - xLights Sequence Halloween Pro Layout', './assets/song-art/purple-people-eater.jpg'],
  ['PPS-Thriller (Single Version)', './assets/song-art/thriller.jpg'],
  ['SS-Ghostbusters-Showstoppers', './assets/song-art/ghostbusters.jpg'],
  ['VLS-Falloutboy-My Songs Know What You Did In The Dark (Light Em Up)', './assets/song-art/light-em-up.jpg']
]);

const ARTWORK_BY_TITLE = new Map([
  ['skeleton sam', './assets/song-art/skeleton-sam.jpg'],
  ['bloody mary', './assets/song-art/bloody-mary.jpg'],
  ['halloween night', './assets/song-art/halloween-night.jpg'],
  ['monster mash', './assets/song-art/monster-mash.jpg'],
  ['problem (the monster remix)', './assets/song-art/problem-monster-remix.jpg'],
  ['best of michael jackson', './assets/song-art/best-of-michael-jackson.jpg'],
  ['grim grinning ghosts (electro swing mix)', './assets/song-art/grim-grinning-ghosts.jpg'],
  ['spooky, scary skeletons (undead tombstone remix)', './assets/song-art/spooky-scary-skeletons.jpg'],
  ['haunted heart', './assets/song-art/haunted-heart.jpg'],
  ["somebody's watching me", './assets/song-art/somebodys-watching-me.jpg'],
  ['purple people eater', './assets/song-art/purple-people-eater.jpg'],
  ['thriller (single version)', './assets/song-art/thriller.jpg'],
  ['ghostbusters', './assets/song-art/ghostbusters.jpg'],
  ['my songs know what you did in the dark (light em up)', './assets/song-art/light-em-up.jpg']
]);

function normalizedTitle(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function localArtworkForSong(song = {}) {
  const bySequence = ARTWORK_BY_SEQUENCE.get(String(song.name || '').trim());
  if (bySequence) return bySequence;

  for (const candidate of [song.displayName, song.title]) {
    const byTitle = ARTWORK_BY_TITLE.get(normalizedTitle(candidate));
    if (byTitle) return byTitle;
  }

  return '';
}
