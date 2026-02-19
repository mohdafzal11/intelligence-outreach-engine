/**
 * Luma event URLs – backend only. Not exposed to frontend.
 * Builds the events URL by appending the company name to the base Luma link.
 */

const LUMA_BASE_URL = "https://lu.ma/";

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9-]/g, "");
}

export function getLumaUrlsForCompany(companyName: string): string[] | null {
  const slug = slugFromName(companyName);
  if (!slug) return null;
  const url = `${LUMA_BASE_URL}${slug}`;
  return [url];
}
