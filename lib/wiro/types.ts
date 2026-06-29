export interface WiroSettings {
  apiKey: string;
  apiSecret: string;
  imageModel?: string;
  verified?: boolean;
}

export interface WiroModelOption {
  id: string;
  name: string;
  description?: string;
}

export interface WiroModelsResponse {
  imageModels: WiroModelOption[];
}
