// Hugging Face model definitions and types shared between main and renderer.

/** A curated GGUF model recommended for refinement. */
export interface CuratedGgufModel {
  id: string
  repoId: string
  filename: string
  name: string
  size: string
  description: string
}

/** A downloaded GGUF model tracked in gguf-meta.json. */
export interface DownloadedGgufModel {
  id: string
  repoId: string
  filename: string
  downloadedAt: number
  fileSize: number
}

/** A search result from the Hugging Face models API. */
export interface HfModelSearchResult {
  id: string
  downloads: number
  tags: string[]
}

/** Shape of the gguf-meta.json file stored in userData. */
export interface GgufMetaFile {
  downloadedModels: DownloadedGgufModel[]
}

/** Recommended GGUF models for AI refinement. */
export const CURATED_GGUF_MODELS: CuratedGgufModel[] = [
  {
    id: 'qwen-3.5-0.8B-Q4_K_M',
    repoId: 'unsloth/Qwen3.5-0.8B-GGUF',
    filename: 'Qwen3.5-0.8B-Q4_K_M.gguf',
    name: 'Qwen 3.5 0.8B (Q4_K_M)',
    size: '~0.6 GB',
    description: 'Fastest. Best for basic punctuation and typo fixes.',
  },
  {
    id: 'qwen-3.5-2B-Q4_K_M',
    repoId: 'unsloth/Qwen3.5-2B-GGUF',
    filename: 'Qwen3.5-2B-Q4_K_M.gguf',
    name: 'Qwen 3.5 2B (Q4_K_M)',
    size: '~1.3 GB',
    description: 'Recommended. Best balance of speed and quality.',
  },
  {
    id: 'gemma-4-E2B-Q4_K_M',
    repoId: 'unsloth/gemma-4-E2B-it-GGUF',
    filename: 'gemma-4-E2B-it-Q4_K_M.gguf',
    name: 'Gemma 4 E2B (Q4_K_M)',
    size: '~1.6 GB',
    description: 'Good quality, multimodal model from Google.',
  },
  {
    id: 'phi-4-mini-Q4_K_M',
    repoId: 'unsloth/phi-4-mini-instruct-GGUF',
    filename: 'phi-4-mini-instruct-Q4_K_M.gguf',
    name: 'Phi-4 Mini (Q4_K_M)',
    size: '~2.5 GB',
    description: 'Best quality at small size. Text-only, from Microsoft.',
  },
]
