# nirpc

A type-safe, feature-rich RPC library with builder pattern, acknowledgements, middleware, and retry logic.

## Features

- ✨ **Builder Pattern** - Fluent API for configuring RPC calls
- 🔄 **Acknowledgements** - Receiver acknowledges receipt before processing
- 🔧 **Middleware** - Hook into every request before sending
- ♻️ **Retry Logic** - Automatic retry with configurable attempts
- ⏱️ **Dual Timeouts** - Separate timeouts for acknowledgement and execution
- 🎯 **Type Safety** - Full TypeScript support with type inference
- 🚀 **Promise-based** - Modern async/await API

## Installation

```bash
bun install
```

## Quick Start

### Basic Setup

```typescript
import { createNirpc } from "nirpc";

interface RemoteFunctions {
  hello: (name: string) => string;
  calculate: (a: number, b: number) => number;
}

const rpc = createNirpc<RemoteFunctions>({}, {
  post: async (data) => {
    // Send to remote (WebSocket, PostMessage, etc.)
  },
  on: (fn) => {
    // Listen for incoming messages
  },
});
```

### Builder Pattern (New!)

The builder pattern provides a fluent API for configuring advanced RPC calls:

```typescript
// Simple call with timeout
const result = await rpc
  .$builder("hello")
  .params("World")
  .timeout(1000)
  .execute();

// With acknowledgement timeout and retry
const result = await rpc
  .$builder("calculate")
  .params(10, 20)
  .ackTimeout(500)      // Wait max 500ms for acknowledgement
  .timeout(2000)        // Wait max 2s for result
  .retry(3)             // Retry up to 3 times on failure
  .execute();
```

### Middleware (New!)

Add middleware that runs before every request:

```typescript
const rpc = createNirpc<RemoteFunctions>({}, {
  post: async (data) => { /* ... */ },
  on: (fn) => { /* ... */ },
  middleware: async (req) => {
    // Add authentication, logging, validation, etc.
    console.log(`Calling ${req.m} with args:`, req.a);
    
    // Optionally modify the request
    return {
      ...req,
      // Add custom fields if needed
    };
  },
});
```

### Acknowledgements (New!)

The receiver automatically sends an acknowledgement when it receives a request, before processing it. This helps detect network issues early:

```typescript
const rpc = createNirpc<RemoteFunctions>({}, {
  post: async (data) => { /* ... */ },
  on: (fn) => { /* ... */ },
  ackTimeout: 5000,  // Fail if no ACK within 5 seconds
  timeout: 30000,    // Fail if no result within 30 seconds
  onAckTimeoutError: (functionName, args) => {
    console.error(`No acknowledgement for ${functionName}`);
    return false; // Return true to suppress error
  },
});
```

## API Reference

### Builder Methods

- **`.params(...args)`** - Set function parameters
- **`.timeout(ms)`** - Set function execution timeout
- **`.ackTimeout(ms)`** - Set acknowledgement timeout
- **`.retry(attempts)`** - Set number of retry attempts
- **`.execute()`** - Execute the RPC call

### Options

#### `middleware`
Function that runs before sending every request. Can modify the request or perform side effects.

```typescript
middleware?: (req: Request) => Promise<Request | void> | Request | void;
```

#### `ackTimeout`
Maximum time to wait for acknowledgement from receiver (default: 5000ms).

```typescript
ackTimeout?: number;
```

#### `onAckTimeoutError`
Handler for acknowledgement timeout errors.

```typescript
onAckTimeoutError?: (functionName: string, args: any[]) => boolean | void;
```

### Traditional API (Still Supported)

```typescript
// Direct call
await rpc.hello("World");

// Using $call
await rpc.$call("hello", "World");

// Fire and forget
await rpc.hello.asEvent("World");
await rpc.$callEvent("hello", "World");
```

## Real-World Example

```typescript
// WebSocket RPC with authentication middleware
const ws = new WebSocket("ws://localhost:3000");

const rpc = createNirpc<RemoteFunctions>(localFunctions, {
  post: async (data) => ws.send(JSON.stringify(data)),
  on: (fn) => ws.onmessage = (e) => fn(JSON.parse(e.data)),
  middleware: async (req) => {
    // Add auth token to every request
    return {
      ...req,
      // Could add custom metadata here
    };
  },
  ackTimeout: 3000,
  timeout: 30000,
});

// Use with builder pattern
try {
  const result = await rpc
    .$builder("processPayment")
    .params(orderId, amount)
    .timeout(10000)
    .ackTimeout(2000)
    .retry(3)
    .execute();
  
  console.log("Payment processed:", result);
} catch (error) {
  console.error("Payment failed:", error);
}
```

## Examples

Run the examples:

```bash
bun run examples.ts
```

## How It Works

### Message Flow with Acknowledgements

1. **Sender** → Request → **Receiver**
2. **Receiver** → ACK → **Sender** (acknowledges receipt)
3. **Receiver** processes function
4. **Receiver** → Response → **Sender** (returns result)

### Retry Behavior

If a call fails (timeout, network error, etc.), the builder will automatically retry:

- Generates a new request ID for each retry
- Waits for both ACK and response on each attempt
- Throws error only after all retry attempts are exhausted

## Type Safety

The library is fully typed. TypeScript will infer parameter and return types:

```typescript
interface RemoteFunctions {
  add: (a: number, b: number) => number;
}

// ✅ Type-safe
const sum = await rpc.$builder("add").params(1, 2).execute();
// sum is inferred as number

// ❌ Type error
await rpc.$builder("add").params("hello", "world").execute();
```

## License

MIT

---

This project uses [Bun](https://bun.com) - a fast all-in-one JavaScript runtime.
