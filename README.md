# Auto Bulk OCR

Batch OCR images from a local folder with an Ollama vision model, then save Markdown and PDF output.

## Requirements

- Node.js 20 or newer
- Ollama running locally or at a reachable OpenAI-compatible endpoint
- A vision model that supports image input

## Setup

```sh
npm install
```

Create `.env` from `.env.example` and set values as needed:

```env
OLLAMA_BASE_URL=http://localhost:11434/v1
OCR_MODEL=gemma4:e4b
CONCURRENCY=1
```

## Usage

1. Put image files in a folder under `src/files`.
2. Update the `dir` value in `src/index.ts` to point to that folder.
3. Run the app:

```sh
npm run dev
```

Supported image types are `png`, `jpg`, `jpeg`, and `webp`.

## Output

Results are written to `data/<input-folder-name>`:

- one `.md` file per image
- `combined.md` with all Markdown files joined in sort order
- `combined.pdf` generated from the combined Markdown

## Scripts

- `npm run dev`: run the OCR pipeline with `.env`
- `npm run build`: compile TypeScript
