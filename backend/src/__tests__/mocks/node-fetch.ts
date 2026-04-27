export class Response {
  constructor(
    public body: unknown = null,
    public init: { status?: number; headers?: Record<string, string> } = {}
  ) {}

  get ok() {
    const status = this.status;
    return status >= 200 && status < 300;
  }

  get status() {
    return this.init.status ?? 200;
  }

  async json() {
    return this.body;
  }

  async text() {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
  }

  async buffer() {
    return Buffer.from(await this.text());
  }
}

export default async function fetch() {
  throw new Error('node-fetch is mocked in Jest tests and no mock response was provided');
}
