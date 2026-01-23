import path from "node:path";

export function getImageMimeType(imagePath: string): string {
    const ext = path.extname(imagePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    };
    return mimeTypes[ext] ?? "image/png";
}