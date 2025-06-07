// Translation Controller - Simplified version without pause/resume functionality
import { TranslationController } from '@/types/pdf-processor';

export class TranslationControllerImpl implements TranslationController {
  public isPaused: boolean = false;
  public pauseRequested: boolean = false;
  public resumeRequested: boolean = false;
  public abortController?: AbortController;

  constructor() {
    this.abortController = new AbortController();
  }

  pauseTranslation(): void {
    // No-op - pause functionality removed
  }

  resumeTranslation(): void {
    // No-op - resume functionality removed
  }

  checkPauseStatus(): boolean {
    return false; // Always return false since pause is disabled
  }

  async waitForResume(): Promise<void> {
    // No-op - no waiting needed
  }

  // Reset the controller for new translation session
  reset(): void {
    this.isPaused = false;
    this.pauseRequested = false;
    this.resumeRequested = false;
    this.abortController = new AbortController();
  }

  // Check if translation should be aborted
  isAborted(): boolean {
    return this.abortController?.signal.aborted || false;
  }

  // Abort the translation completely
  abort(): void {
    this.abortController?.abort();
  }
}

// Global translation controller instance
export const globalTranslationController = new TranslationControllerImpl();

// Helper function to check pause status during translation loops (now a no-op)
export async function checkTranslationPause(controller: TranslationController): Promise<void> {
  // No-op - pause functionality removed
}

// Helper function to save translation progress
export async function saveTranslationProgress(
  sessionId: string,
  fileName: string,
  currentChunkIndex: number,
  totalChunks: number,
  completedChunks: number,
  partialResults: string[],
  chunks: string[]
): Promise<void> {
  try {
    // This will be implemented to save progress to session manager
    const progressData = {
      sessionId,
      fileName,
      currentChunkIndex,
      totalChunks,
      completedChunks,
      partialResults,
      chunks,
      pausedAt: Date.now()
    };

    console.log('Saving translation progress:', progressData);

    // Store in localStorage as fallback
    localStorage.setItem(`translation_progress_${sessionId}_${fileName}`, JSON.stringify(progressData));
  } catch (error) {
    console.error('Failed to save translation progress:', error);
  }
}

// Helper function to load translation progress
export async function loadTranslationProgress(
  sessionId: string,
  fileName: string
): Promise<{
  currentChunkIndex: number;
  totalChunks: number;
  completedChunks: number;
  partialResults: string[];
  chunks: string[];
  pausedAt?: number;
} | null> {
  try {
    const progressKey = `translation_progress_${sessionId}_${fileName}`;
    const progressData = localStorage.getItem(progressKey);

    if (progressData) {
      return JSON.parse(progressData);
    }

    return null;
  } catch (error) {
    console.error('Failed to load translation progress:', error);
    return null;
  }
}

// Helper function to clear translation progress
export async function clearTranslationProgress(sessionId: string, fileName: string): Promise<void> {
  try {
    const progressKey = `translation_progress_${sessionId}_${fileName}`;
    localStorage.removeItem(progressKey);
  } catch (error) {
    console.error('Failed to clear translation progress:', error);
  }
}
