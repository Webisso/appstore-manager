export interface GeminiSettings {
  apiKey: string;
  textModel?: string;
  imageModel?: string;
  verified?: boolean;
}

export interface GeminiModelOption {
  id: string;
  name: string;
  description?: string;
}

export interface GeminiModelsResponse {
  textModels: GeminiModelOption[];
  imageModels: GeminiModelOption[];
}
