export const SITE_CONFIG = {
  showSubdomain: 'lightsonadmiral',
  showName: 'Lights On Admiral',
  locationLabel: 'Herriman, UT',
  youtubeUrl: 'https://www.youtube.com/@lightsonadmiral',

  fmFrequency: '107.7',
  showHours: ['Nightly', '5:00–10:30 PM'],
  lastNight: 'October 31',
  directionsUrl: 'https://maps.app.goo.gl/JAw98A9neYv97QPk9',
  directionsLabel: 'Get directions',
  pulseMeshUrl: 'https://player.pulsemesh.io',

  performers: {
    pumpkin: {
      name: 'The Pumpkin King',
      tagline: 'The Admiral conducts. The Pumpkin King rocks.',
      stageLine: 'The Pumpkin King rocks.',
      description: 'the Pumpkin King rock vocalist'
    },
    death: {
      name: 'The Angel of Death',
      tagline: 'The Admiral conducts. Death sings.',
      stageLine: 'Death sings.',
      description: 'the Angel of Death singer'
    },
    phantom: {
      name: 'The Phantom',
      tagline: 'The Admiral conducts. The Phantom howls.',
      stageLine: 'The Phantom howls.',
      description: 'the spectral Phantom singer'
    }
  },

  // "auto" follows the date ranges below. Set to halloween, veterans, or
  // christmas to pin a season. Add ?season=christmas to any URL to preview.
  season: 'auto',
  seasons: {
    halloween: {
      label: 'Halloween lights',
      eyebrow: 'Halloween light show · 2026',
      headline: 'Lights On Admiral',
      summary: 'The Admiral conducts. Tonight’s performer is waiting in the wings.',
      dateRange: 'October 1 – 31'
    },
    veterans: {
      label: 'Veterans Day tribute',
      eyebrow: 'A light in gratitude',
      headline: 'Tonight, the lights stand in thanks.',
      summary: 'A respectful neighborhood tribute honoring the service and sacrifice of America’s veterans.',
      dateRange: 'November 2 – November 12'
    },
    christmas: {
      label: 'Christmas lights',
      eyebrow: 'The neighborhood glows',
      headline: 'Pick the song. Make the season shine.',
      summary: 'A bright, interactive Christmas show built for neighbors, families, and a little curbside wonder.',
      dateRange: 'November 13 – January 7'
    }
  }
};
