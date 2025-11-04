/**
 * Strip all query parameters from a URL
 */
export function stripQueryParams(url: string): string {
  if (!url) return url;
  
  const questionMarkIndex = url.indexOf('?');
  return questionMarkIndex !== -1 ? url.substring(0, questionMarkIndex) : url;
}