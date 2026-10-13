const escapeAttribute = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const escapeText = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

function replaceMeta(html, attribute, key, value) {
  const marker = `<meta ${attribute}="${key}" content="`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing metadata tag: ${attribute}="${key}"`);

  const valueStart = markerIndex + marker.length;
  const valueEnd = html.indexOf('"', valueStart);
  if (valueEnd < 0) throw new Error(`Malformed metadata tag: ${attribute}="${key}"`);
  return `${html.slice(0, valueStart)}${escapeAttribute(value)}${html.slice(valueEnd)}`;
}

function replaceTitle(html, title) {
  const startMarker = '<title>';
  const endMarker = '</title>';
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error('Missing document title');
  return `${html.slice(0, start + startMarker.length)}${escapeText(title)}${html.slice(end)}`;
}

function replaceStructuredData(html, season, socialImage) {
  const marker = '<script type="application/ld+json" id="site-structured-data">';
  const start = html.indexOf(marker);
  const end = html.indexOf('</script>', start + marker.length);
  if (start < 0 || end < 0) throw new Error('Missing site structured data');

  const current = JSON.parse(html.slice(start + marker.length, end));
  current.description = season.metaDescription;
  current.image = socialImage;
  current.keywords = season.keywords;
  const rendered = `\n      ${JSON.stringify(current, null, 2).replaceAll('\n', '\n      ')}\n    `;
  return `${html.slice(0, start + marker.length)}${rendered}${html.slice(end)}`;
}

export function renderSeasonHtml(template, seasonKey, season, siteConfig) {
  const pageTitle = season.pageTitle || `${siteConfig.showName} | ${season.label}`;
  const socialTitle = season.socialTitle || pageTitle;
  const description = season.metaDescription || season.summary;
  const socialDescription = season.socialDescription || description;
  const socialImage = new URL(season.socialImage, siteConfig.siteUrl).href;

  let html = template.replace(
    '<html lang="en">',
    `<html lang="en" data-season="${escapeAttribute(seasonKey)}">`
  );
  html = replaceTitle(html, pageTitle);
  html = replaceMeta(html, 'name', 'theme-color', season.themeColor);
  html = replaceMeta(html, 'name', 'description', description);
  html = replaceMeta(html, 'name', 'keywords', season.keywords);
  html = replaceMeta(html, 'property', 'og:title', socialTitle);
  html = replaceMeta(html, 'property', 'og:description', socialDescription);
  html = replaceMeta(html, 'property', 'og:image', socialImage);
  html = replaceMeta(html, 'property', 'og:image:secure_url', socialImage);
  html = replaceMeta(html, 'property', 'og:image:width', season.socialImageWidth);
  html = replaceMeta(html, 'property', 'og:image:height', season.socialImageHeight);
  html = replaceMeta(html, 'property', 'og:image:alt', season.socialImageAlt);
  html = replaceMeta(html, 'name', 'twitter:title', socialTitle);
  html = replaceMeta(html, 'name', 'twitter:description', socialDescription);
  html = replaceMeta(html, 'name', 'twitter:image', socialImage);
  html = replaceMeta(html, 'name', 'twitter:image:alt', season.socialImageAlt);
  return replaceStructuredData(html, season, socialImage);
}
