import { randomUUID } from 'node:crypto';

interface RpcSuccess<T> {
  ok: true;
  value: T;
}

interface RpcFailure {
  ok: false;
  error: { message?: string; code?: string };
}

interface DshRpcResponse<T> {
  type?: string;
  result?: RpcSuccess<T> | RpcFailure;
}

export class DshApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = 'DshApiError';
    this.code = code;
  }
}

/** Minimal client for the confirmed DSH localhost RPC surface. */
export class DshApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 8_000,
  ) {}

  async call<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url = new URL(this.baseUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new DshApiError('DeepSeek Harness URL must use HTTP or HTTPS.');
      }
      const response = await fetch(`${url.toString().replace(/\/$/, '')}/api/${method}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: randomUUID(),
          method,
          payload,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new DshApiError(`DeepSeek Harness API returned HTTP ${response.status}.`);
      const body = await response.json() as DshRpcResponse<T>;
      const result = body.result;
      if (!result) throw new DshApiError(`DeepSeek Harness API returned an invalid ${method} response.`);
      if (!result.ok) throw new DshApiError(result.error.message ?? `DeepSeek Harness rejected ${method}.`, result.error.code ?? null);
      return result.value;
    } catch (error) {
      if (error instanceof DshApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new DshApiError(`DeepSeek Harness API request timed out: ${method}.`);
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new DshApiError(`DeepSeek Harness API request timed out: ${method}.`);
      }
      throw new DshApiError(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }
  }
}
