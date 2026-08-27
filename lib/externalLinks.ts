// Where a course actually lives. There is no public per-course deep-link
// API for either platform (iGOT Karmayogi has no public catalog API, and
// MoSPI NSTA courses are this prototype's stand-in for departmental
// training), so this links to the real platform itself rather than
// fabricating a specific course URL that might not exist. Verified live:
// both domains resolve to the real iGOT Karmayogi and MoSPI sites.

export function courseExternalUrl(source: string) {
  return source === "IGOT_KARMAYOGI" ? "https://igotkarmayogi.gov.in" : "https://mospi.gov.in";
}

export function courseSourceLabel(source: string) {
  return source === "IGOT_KARMAYOGI" ? "iGOT Karmayogi" : "MoSPI NSTA";
}
