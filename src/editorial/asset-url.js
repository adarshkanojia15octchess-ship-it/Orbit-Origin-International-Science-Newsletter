/**
 * Public publication assets must resolve to this project's public issue bucket.
 * Draft object paths and arbitrary external URLs are never rendered by public pages.
 */
export function isPublishedStorageAsset(value, supabaseUrl) {
  if (typeof value !== "string" || typeof supabaseUrl !== "string") return false;
  try {
    const project = new URL(supabaseUrl);
    const separator = value.indexOf("://");
    if (separator < 0) return false;
    const pathStart = value.indexOf("/", separator + 3);
    if (pathStart < 0) return false;
    const rawPath = value.slice(pathStart).split(/[?#]/, 1)[0];
    const marker = "/storage/v1/object/public/issue-public/";
    if (!rawPath.startsWith(marker) || rawPath.includes("\\")) return false;
    const rawSegments = rawPath.slice(marker.length).split("/").map((part) => decodeURIComponent(part));
    if (!rawSegments.length || rawSegments.some((part) => part === "." || part === ".." || part.includes("\\"))) return false;
    const asset = new URL(value);
    return asset.origin === project.origin && asset.pathname.startsWith(marker);
  } catch {
    return false;
  }
}
