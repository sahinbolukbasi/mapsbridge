type MessageHandler = (data: unknown) => void;

const WS_ENDPOINT = process.env.NEXT_PUBLIC_WS_URL ?? "";
const MAX_RETRIES = 6;
const BASE_DELAY_MS = 1000;

class MapsBridgeWS {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private handlers = new Map<string, MessageHandler[]>();
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  connect(token: string) {
    if (!WS_ENDPOINT) return;
    this.token = token;
    this.intentionallyClosed = false;
    this.retryCount = 0;
    this._open();
  }

  private _open() {
    if (!WS_ENDPOINT || !this.token) return;
    const url = `${WS_ENDPOINT}?token=${encodeURIComponent(this.token)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.retryCount = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { action?: string; [key: string]: unknown };
        const action = msg.action ?? "message";
        const list = this.handlers.get(action) ?? [];
        list.forEach((h) => h(msg));
        // also fire wildcard handlers
        (this.handlers.get("*") ?? []).forEach((h) => h(msg));
      } catch {
        // non-JSON frame — ignore
      }
    };

    this.ws.onerror = () => {
      // onclose fires right after onerror, handle there
    };

    this.ws.onclose = () => {
      if (this.intentionallyClosed) return;
      if (this.retryCount >= MAX_RETRIES) return;
      const delay = BASE_DELAY_MS * Math.pow(2, this.retryCount);
      this.retryCount++;
      this.retryTimer = setTimeout(() => this._open(), delay);
    };
  }

  disconnect() {
    this.intentionallyClosed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.ws?.close();
    this.ws = null;
    this.token = null;
  }

  send(action: string, payload: Record<string, unknown> = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, ...payload }));
    }
  }

  on(action: string, handler: MessageHandler) {
    const list = this.handlers.get(action) ?? [];
    list.push(handler);
    this.handlers.set(action, list);
    return () => {
      const updated = (this.handlers.get(action) ?? []).filter((h) => h !== handler);
      this.handlers.set(action, updated);
    };
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const ws = new MapsBridgeWS();
