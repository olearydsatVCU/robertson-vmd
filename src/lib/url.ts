/** Same rules as the database (vmd_normalize_url): add https:// when missing so
 *  "linkedin.com/in/name" or "www.zoom.us/j/123" just work. The database has the final say. */
export function fixUrl(raw: string): string {
  const v = raw.replace(/\s/g, '')
  if (!v) return ''
  if (/^https?:\/\//i.test(v)) return v.replace(/^https?:\/\//i, 'https://')
  if (v.startsWith('//')) return 'https:' + v
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#]|$)/i.test(v)) return v // not a web link; the database will explain
  return 'https://' + v
}
