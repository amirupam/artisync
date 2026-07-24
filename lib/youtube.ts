export function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function getYouTubeThumbnail(url: string): string | null {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

/** Instagram reels/posts/tv links — shown as a link-out card rather than embedded (no reliable iframe embed without their JS SDK). */
export function isInstagramVideoUrl(url: string): boolean {
  return /instagram\.com\/(reel|p|tv)\//i.test(url);
}
