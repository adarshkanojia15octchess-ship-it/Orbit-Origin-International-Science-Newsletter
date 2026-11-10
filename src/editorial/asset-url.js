/**
 * Public publication assets must resolve to this project's public issue bucket.
 * Draft object paths and arbitrary external URLs are never rendered by public pages.
 */
export function isPublishedStorageAsset(value, supabaseUrl) {
  if (typeof value !== "string" || typeof supabaseUrl !== "string") return false;
  try {
    const asset = new URL(value);
    const project = new URL(supabaseUrl);
    if (asset.origin !== project.origin) return false;
    const marker = "/storage/v1/object/public/issue-public/";
    if (!asset.pathname.startsWith(marker)) return false;
    const objectPath = decodeURIComponent(asset.pathname.slice(marker.length));
    return objectPath.length > 0 &&
      !objectPath.split("/").some((part) => part === "." || part === "..") &&
      !objectPath.includes("\\");
  } catch {
    return false;
  }
}
