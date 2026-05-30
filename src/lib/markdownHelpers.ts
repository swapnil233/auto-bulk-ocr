import fs from "node:fs";
import path from "node:path";

export function stripMarkdownFences(input: string): string {
    return (input ?? "")
        .replace(/^```(?:markdown)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
}

export function combineMarkdownFiles(outDir: string, combinedFileName: string): string | null {
    const mdFiles = fs
        .readdirSync(outDir)
        .filter((f) => f.endsWith(".md") && f !== combinedFileName)
        .sort();

    if (mdFiles.length === 0) {
        console.log("No markdown files to combine.");
        return null;
    }

    const combined = mdFiles
        .map((f) => {
            const content = fs.readFileSync(path.join(outDir, f), "utf8");
            return content;
        })
        .join("\n\n---\n\n");

    const combinedPath = path.join(outDir, combinedFileName);
    fs.writeFileSync(combinedPath, combined, "utf8");
    console.log(`Combined ${mdFiles.length} files -> ${combinedPath}`);
    return combinedPath;
}
