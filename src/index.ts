import fs from "node:fs";
import path from "node:path";
import ollama from "ollama";

function encodeImage(imagePath: string) {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString("base64");
}

function stripMarkdownFences(input: string): string {
    return (input ?? "")
        .replace(/^```(?:markdown)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
}

async function ocr(): Promise<void> {
    const imagePath = "src/files/p1.jpg";
    console.log(`Starting OCR for ${imagePath}`);

    const base64Image = encodeImage(imagePath);

    const VISION_MODEL = "deepseek-ocr:3b";
    const CLEANUP_MODEL = "gpt-oss:20b";

    const ocrPrompt = [
        "You are an OCR engine.",
        "Return ONLY valid GitHub-Flavored Markdown.",
        "Rules:",
        "- Do not add commentary or analysis.",
        "- Preserve reading order.",
        "- Use headings if the document clearly has them.",
        "- Use bullet lists for lists, and tables ONLY if there is a clear table.",
        "- Keep line breaks natural (wrap paragraphs, don't put every phrase on a new line).",
        "- If uncertain, output the best guess without brackets like [illegible].",
        "",
        "OCR the image now:",
    ].join("\n");

    console.log("OCR first pass...");
    const ocrRes = await ollama.chat({
        model: VISION_MODEL,
        messages: [
            {
                role: "user",
                content: ocrPrompt,
                // Ollama expects base64 strings here (no data:... prefix)
                images: [base64Image],
            },
        ],
        // optional: make output more deterministic
        options: { temperature: 0 },
    });

    const raw = ocrRes?.message?.content ?? "";
    if (!raw) {
        throw new Error("No OCR output returned from Ollama.");
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

    console.log("Cleaning up OCR text...");
    const cleanupRes = await ollama.chat({
        model: CLEANUP_MODEL,
        messages: [{ role: "user", content: cleanupPrompt }],
        options: { temperature: 0 },
    });

    let md = cleanupRes?.message?.content ?? "";
    md = stripMarkdownFences(md);

    const outPath = path.resolve("data.md");
    fs.writeFileSync(outPath, md, "utf8");
    console.log(`Done`);
}

ocr().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});