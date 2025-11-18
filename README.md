# nirpc

A small TypeScript-first RPC library with acknowledgements, middleware, configurable timeouts and a fluent call builder.

## Features

- Type-safe client and server interfaces
- Acknowledgements before work starts
- Configurable timeouts for acknowledgement and result
- Optional middleware hook for logging, auth, etc.
- Per-call retry support
- Simple builder API on each remote method

## Installation

```bash
bun install nirpc
```

## Quick start

### Basic setup

```typescript
import { createNirpc } from "nirpc";

interface RemoteFunctions {
  hello: (name: string) => string;
  calculate: (a: number, b: number) => number;
}

const rpc = createNirpc<RemoteFunctions>({}, {
  post: async (data) => {
    // Send to remote (WebSocket, postMessage, etc.)
  },
  on: (fn) => {
    // Listen for incoming messages
  },
});
```

### Calling methods

Direct call:

```typescript
const result = await rpc.hello("World");
```

With per-call options using the builder hanging off the method:

```typescript
const sum = await rpc.calculate
  .options({
    timeout: 2000,
    ackTimeout: 500,
    retry: 3,
  })
  .run(10, 20);
```

### Middleware

Middleware runs before each request and can inspect or modify the outgoing message:

```typescript
const rpc = createNirpc<RemoteFunctions>({}, {
  post: async (data) => { /* ... */ },
  on: (fn) => { /* ... */ },
  middleware: (req) => {
    return {
      ...req,
      // attach metadata, auth tokens, etc.
    };
  },
});
```

### Acknowledgements and timeouts

`createNirpc` can send an acknowledgement as soon as a request is received, before the handler runs. Timeouts are configurable both for the acknowledgement and for the handler result:

```typescript
const rpc = createNirpc<RemoteFunctions>({}, {
  post: async (data) => { /* ... */ },
  on: (fn) => { /* ... */ },
  ackTimeout: 5000,
  timeout: 30000,
  onAckTimeoutError: (functionName, args) => {
    console.error(`No acknowledgement for ${functionName}`, args);
    // return true to suppress throwing the error
  },
});
```

## API surface

### `createNirpc`

Creates an RPC instance:

```typescript
const rpc = createNirpc<RemoteFunctions, LocalFunctions>(localFunctions, {
  post,
  on,
  off,
  serialize,
  deserialize,
  bind,
  eventNames,
  timeout,
  ackTimeout,
  resolver,
  middleware,
  onRequest,
  onError,
  onFunctionError,
  onGeneralError,
  onTimeoutError,
  onAckTimeoutError,
});
```

Each remote function is exposed as:

- `rpc.method(...args)` – regular call returning a promise
- `rpc.method.asEvent(...args)` – fire-and-forget
- `rpc.method.options({ timeout?, ackTimeout?, retry? }).run(...args)` – call with per-invocation options

Additional helpers:

- `rpc.$call(name, ...args)`
- `rpc.$callOptional(name, ...args)`
- `rpc.$callEvent(name, ...args)`
- `rpc.$builder(name)` – lower-level builder (`params().timeout().ackTimeout().retry().execute()`)
- `rpc.$close(error?)`
- `rpc.$rejectPendingCalls(handler?)`

### `createNirpcGroup`

For broadcasting the same call to multiple channels:

```typescript
import { createNirpcGroup } from "nirpc";

const group = createNirpcGroup<RemoteFunctions>(localFunctions, () => channels, {
  timeout: 10_000,
});

await group.broadcast.processEvent("payload");
await group.broadcast.processEvent.asEvent("payload");
```

## Examples

Run the examples in this repo with:

```bash
bun run examples.ts
```

## License

MIT
