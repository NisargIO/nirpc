# nrpc

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.2. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Features

- 🔧 **Builder pattern** – chain `.method().params().timeout().ackTimeout().retry().execute()` with full type safety.
- 📬 **Receiver acknowledgements** – every request is acknowledged before execution so callers know the remote side is processing it.
- 🧱 **Initial middleware** – hook into every outbound request before it is sent to add headers, tracing, or mutations.

## Builder API

```ts
rpc
  .method("hello")
  .params({ name: "Cursor" })
  .timeout(1_000) // function response timeout
  .ackTimeout(500) // acknowledgement timeout
  .retry(3) // retry on ack/response/send failures
  .execute();
```

The builder returns a promise for the remote method result and automatically retries on acknowledgement, send, and response timeouts.

## Initial Middleware

Use `initialMiddleware` to run logic before any request is posted:

```ts
createNirpc(functions, {
  initialMiddleware: async (req) => {
    req.a.unshift({ traceId });
    return req;
  },
  ackTimeout: 500,
  functionTimeout: 2_000,
  retry: 1,
});
```

## Timeouts & Retries

- `functionTimeout` (or legacy `timeout`) controls how long to wait for a response *after* the acknowledgement arrives.
- `ackTimeout` controls how long to wait for the receiver to acknowledge the call.
- `retry` sets the default builder retry count; you can override it per-call with `.retry(n)`.
