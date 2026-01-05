
export interface ImageHistoryItem {
  id: string;
  originalUrl: string;
  editedUrl: string;
  prompt: string;
  explanation?: string;
  timestamp: number;
  sources?: Array<{
    title: string;
    uri: string;
  }>;
}

export interface WorkspaceState {
  currentImage: string | null;
  editedImage: string | null;
  explanation: string;
}

export interface AppState {
  currentImage: string | null;
  editedImage: string | null;
  isProcessing: boolean;
  error: string | null;
  history: ImageHistoryItem[];
  showApiKeySelector: boolean;
  searchEnabled: boolean;
  selectedStyle: string;
  selectedAspectRatio: string;
  selectedBlur: number;
  undoStack: WorkspaceState[];
  redoStack: WorkspaceState[];
}
