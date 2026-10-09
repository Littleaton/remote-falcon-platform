export const SITE_CONFIG = {
  showSubdomain: 'lightsonadmiral',
  showName: 'Lights On Admiral',
  locationLabel: 'West Jordan, Utah',
  youtubeUrl: 'https://www.youtube.com/@lightsonadmiral',

  // Fill these in when the season schedule and radio frequency are final.
  // Leaving them blank renders honest "coming soon" copy instead of a guess.
  fmFrequency: '',
  showHours: [],
  directionsUrl: '',
  directionsLabel: 'Directions available during show season',

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
      dateRange: 'September 15 – November 1'
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
