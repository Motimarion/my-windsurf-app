export interface EngineConfig {
  systemPrompt: string;
  channels: Record<string, { userMessage: string; personal: boolean }>;
}

export interface ProxyRequest {
  method: string;
  origin?: string;
  ip?: string;
  body?: unknown;
}

export interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export function createHandler(deps: {
  env: Record<string, string | undefined>;
  engine: EngineConfig;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): (req: ProxyRequest) => Promise<ProxyResponse>;
