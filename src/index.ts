import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { mdToPdf } from "md-to-pdf";
import { encodeImage } from "./lib/encodeImage.js";
import { combineMarkdownFiles, stripMarkdownFences } from "./lib/markdownHelpers.js";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
const OCR_MODEL = process.env.OCR_MODEL ?? "gemma4:e4b";
const CONCURRENCY = readConcurrency();

const client = new OpenAI({ baseURL: OLLAMA_BASE_URL, apiKey: "ollama" });

const MIME_TYPES: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
};

function readConcurrency(): number {
    const raw = process.env.CONCURRENCY ?? "1";
    const parsed = Number(raw);

    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`CONCURRENCY must be a positive integer. Received: ${raw}`);
    }

    return parsed;
}

async function processFile(file: string, outDir: string): Promise<void> {
    console.log(`\nProcessing ${path.basename(file)}...`);

    const base64Image = encodeImage(file);
    const mimeType = MIME_TYPES[path.extname(file).toLowerCase()] ?? "image/jpeg";
    const imageUrl = `data:${mimeType};base64,${base64Image}`;

    try {
        const res = await client.chat.completions.create({
            model: OCR_MODEL,
            messages: [{
                role: "user",
                content: [
                    {
                        type: "text",
                        text: [
                            "Extract all text from this image and format it as clean Markdown.",
                            "Rules:",
                            "- Output ONLY markdown (no explanations, no ``` code fences)",
                            "- Fix broken line wraps and hyphenation at line breaks",
                            "- Preserve the original wording; only adjust formatting",
                            "- Use headings, lists, and tables where clearly implied by the structure",
                        ].join("\n"),
                    },
                    { type: "image_url", image_url: { url: imageUrl } },
                ],
            }],
            temperature: 0,
        });

        const md = stripMarkdownFences(res.choices[0]?.message?.content ?? "");

        if (!md.trim()) {
            console.log(`Empty output for ${path.basename(file)}. Full response:`);
            console.dir(res, { depth: null });
            return;
        }

        const base = path.basename(file, path.extname(file));
        const outPath = path.join(outDir, `${base}.md`);
        fs.writeFileSync(outPath, md, "utf8");

        console.log(`Done -> ${outPath}`);
    } catch (error) {
        console.log(`Error processing ${path.basename(file)}:`, error);
    }
}

async function ocr(inputDir: string): Promise<string> {
    const resolvedInputDir = path.resolve(inputDir);
    const dirName = path.basename(resolvedInputDir);
    const outDir = path.resolve("data", dirName);

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

    fs.mkdirSync(outDir, { recursive: true });

    const listOfFiles = files.map((f) => path.join(resolvedInputDir, f));
    console.log(`Processing ${listOfFiles.length} files from: ${resolvedInputDir} (concurrency: ${CONCURRENCY})`);
    console.log(`Output directory: ${outDir}`);

    const queue = [...listOfFiles];
    const workers = Array.from({ length: CONCURRENCY }, async () => {
        while (queue.length > 0) {
            const file = queue.shift()!;
            await processFile(file, outDir);
        }
    });
    await Promise.all(workers);

    return outDir;
}

const dir = "src/files/deep_cover";
const start = performance.now();

ocr(dir).then(async (outDir) => {
    const combinedPath = combineMarkdownFiles(outDir, "combined.md");

    if (!combinedPath) {
        console.log("Skipping PDF generation because no markdown files were created.");
        return;
    }

    console.log(`\nCombined markdown -> ${combinedPath}`);

    console.log("Generating PDF...");
    const pdfPath = path.join(outDir, "combined.pdf");
    const pdf = await mdToPdf({ path: combinedPath });
    fs.writeFileSync(pdfPath, pdf.content);
    console.log(`PDF -> ${pdfPath}`);

    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    console.log(`\nAll done in ${elapsed}s`);
}).catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
