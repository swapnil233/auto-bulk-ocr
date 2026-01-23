import fs from "node:fs";
import path from "node:path";
import { Mistral } from "@mistralai/mistralai";
import OpenAI from "openai";
import { encodeImage } from "./lib/encodeImage.js";
import { getImageMimeType } from "./lib/mimeType.js";
import { combineMarkdownFiles, stripMarkdownFences } from "./lib/markdownHelpers.js";

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const OPENAI_MODEL = "gpt-5.2-2025-12-11";

async function ocr(inputDir: string): Promise<string> {
    // Resolve input directory and derive output directory
    const resolvedInputDir = path.resolve(inputDir);
    const dirName = path.basename(resolvedInputDir);
    const outDir = path.resolve("data", dirName);

    // Validate input directory exists
    if (!fs.existsSync(resolvedInputDir)) {
        throw new Error(`Input directory does not exist: ${resolvedInputDir}`);
    }

    const files = fs
        .readdirSync(resolvedInputDir)
        .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
        .sort();

    if (files.length === 0) {
        throw new Error(`No image files found in: ${resolvedInputDir}`);
    }

    // Create output directory
    fs.mkdirSync(outDir, { recursive: true });

    const listOfFiles = files.map((f) => path.join(resolvedInputDir, f));
    console.log(`Processing ${listOfFiles.length} files from: ${resolvedInputDir}`);
    console.log(`Output directory: ${outDir}`);

    for (const file of listOfFiles) {
        console.log(`\nStarting OCR for ${path.basename(file)}`);

        const base64Image = encodeImage(file);
        const mimeType = getImageMimeType(file);
        const imageUrl = `data:${mimeType};base64,${base64Image}`;

        try {
            console.log("OCR first pass (Mistral)...");
            const ocrRes = await mistral.ocr.process({
                model: "mistral-ocr-2512",
                document: {
                    type: "image_url",
                    imageUrl: imageUrl,
                },
            });

            const raw = ocrRes.pages?.[0]?.markdown?.trim() ?? "";

            if (!raw) {
                console.log("Empty OCR output. Full OCR response:");
                console.dir(ocrRes, { depth: null });
                continue;
            }

            const cleanupPrompt = [
                "You will be given OCR text. Convert it into clean, pure Markdown.",
                "Rules:",
                "- DO NOT include things like ``` or ```markdown",
                "- Output ONLY markdown (no explanations).",
                "- Fix broken line wraps and hyphenation at line breaks where appropriate.",
                "- Preserve the original wording; only adjust formatting.",
                "- Use headings, lists, and tables when clearly implied by the structure.",
                "",
                "OCR TEXT:",
                raw,
            ].join("\n");

            console.log("Cleaning up OCR text (OpenAI)...");
            const cleanupRes = await openai.chat.completions.create({
                model: OPENAI_MODEL,
                messages: [{ role: "user", content: cleanupPrompt }],
                temperature: 0,
            });

            const md = stripMarkdownFences(
                cleanupRes.choices?.[0]?.message?.content ?? ""
            );

            if (!md.trim()) {
                console.log("Empty cleanup output. Full cleanup response:");
                console.dir(cleanupRes, { depth: null });
                continue;
            }

            const base = path.basename(file, path.extname(file));
            const outPath = path.join(outDir, `${base}.md`);
            fs.writeFileSync(outPath, md, "utf8");

            console.log(`Done -> ${outPath}`);
        } catch (error) {
            console.log("Error during OCR pipeline:", error);
        }
    }

    return outDir;
}

const dir = "src/files/deep_cover";

ocr(dir).then((outDir) => {
    combineMarkdownFiles(outDir, "combined.md");
    console.log(`\nAll done! Combined output: ${path.join(outDir, "combined.md")}`);
}).catch((err) => {
    console.error(err);
    process.exitCode = 1;
});