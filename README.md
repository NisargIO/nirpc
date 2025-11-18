# nrpc

Lightweight RPC helpers for Bun runtimes with acknowledgements, retries and a fluent builder API.

## Key features

- 🔁 Type-safe builder pattern: chain `method → params → timeout → ackTimeout → retry → execute`.
- ✅ Receiver acknowledgements so the caller knows when the remote endpoint has started processing.
- ⏱ Dual timeout controls: acknowledgement and function execution windows per call.
- 🧩 Initial middleware hook that runs before *any* request dispatch for auditing or mutation.
- ♻️ Automatic retries via the builder without rewriting call sites.

## Installation

```bash
bun install
```

## Usage

```ts
import { createNirpc } from "./index";

const rpc = createNirpc(handlers, {
  post: transport.send,
  on: transport.on,
  initialMiddleware: (req) => {
    req.a = [{ ...req.a[0], traceId: crypto.randomUUID() }];
  },
});

const params = { name: "Bun" };

const result = await rpc
  .method("hello")
  .params(params)
  .timeout(1_000) // function timeout
  .ackTimeout(1_000) // acknowledgement timeout
  .retry(3)
  .execute();
```

Every request expecting a response now receives an acknowledgement packet before the handler finishes, allowing you to differentiate “in flight” vs “not received”. Builder-level overrides cascade on top of the global defaults configured through `createNirpc`.

To run the sample server:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.2. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
