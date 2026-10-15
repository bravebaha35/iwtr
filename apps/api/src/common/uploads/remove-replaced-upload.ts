import { unlink } from "fs/promises";
import { join } from "path";

export type UploadFolder = "company-logos" | "company-banners" | "employer-avatars";

// Only names this API itself writes (a random UUID plus an image extension),
// so a stored URL can never point the delete outside its folder.
const OWN_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|webp|jpg|jpeg)$/;

/**
 * When an owner replaces (or clears) a logo, banner or profile photo, the old
 * file would otherwise stay on disk for ever. Deletes it when the old URL is
 * one of this API's own uploads in `folder`, it really changed, and
 * `stillUsed` says no row points at it any more. Best-effort: a file that is
 * already gone, or a failed delete, never fails the save.
 */
export async function removeReplacedUpload(
  oldUrl: string | null | undefined,
  newUrl: string | null | undefined,
  folder: UploadFolder,
  stillUsed: (url: string) => Promise<boolean>,
): Promise<void> {
  if (!oldUrl || oldUrl === newUrl) return;
  const marker = `/uploads/${folder}/`;
  const at = oldUrl.indexOf(marker);
  if (at === -1) return;
  const name = oldUrl.slice(at + marker.length);
  if (!OWN_FILE.test(name)) return;
  try {
    if (await stillUsed(oldUrl)) return;
    await unlink(join(process.cwd(), "uploads", folder, name));
  } catch {
    // Already gone, or the disk refused: the save itself stands.
  }
}
