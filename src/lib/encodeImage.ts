import fs from "node:fs";

export function encodeImage(imagePath: string) {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString("base64");
}