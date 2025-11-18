# nirpc - Type-Safe RPC Library

A lightweight, type-safe RPC (Remote Procedure Call) library with advanced features including middleware, acknowledgements, and a fluent builder pattern.

## Features

- ✅ **Full Type Safety** - TypeScript types for all RPC calls
- ✅ **Middleware Support** - Pre-process messages before sending
- ✅ **Acknowledgement System** - Know when receiver starts processing
- ✅ **Builder Pattern** - Fluent API for advanced configurations
- ✅ **Retry Logic** - Automatic retry with exponential backoff
- ✅ **Flexible Timeouts** - Separate timeouts for ACK and execution
- ✅ **Bidirectional** - Call functions in both directions
- ✅ **Promise-based** - Modern async/await support

## Installation

```bash
bun install
```

## Quick Start

```typescript
import { createNirpc } from "nirpc";

interface RemoteFunctions {
  hello(name: string): string;
  add(a: number, b: number): number;
}

const rpc = createNirpc<RemoteFunctions>(
  {}, // Local functions
  {
    post: (data) => channel.send(data),
    on: (handler) => channel.onMessage(handler),
  }
);

// Call remote function
const result = await rpc.hello("World");
```

## New Features

### 1. Initial Middleware

Run custom logic before any message is sent. Perfect for logging, encryption, authentication, etc.

```typescript
const rpc = createNirpc<RemoteFunctions>(
  {},
  {
    post: (data) => channel.send(data),
    on: (handler) => channel.onMessage(handler),
    // Middleware runs before every send
    middleware: async (data) => {
      console.log("Sending:", data);
      // Add authentication token
      return { ...data, token: await getAuthToken() };
    },
  }
);
```

### 2. Acknowledgement System

The receiver automatically sends an ACK when it receives a request, so the sender knows the message was delivered and processing has started.

```typescript
const rpc = createNirpc<RemoteFunctions>(
  {},
  {
    post: (data) => channel.send(data),
    on: (handler) => channel.onMessage(handler),
    ackTimeout: 3000, // Wait 3s for acknowledgement
    timeout: 30000, // Wait 30s for function execution
  }
);
```

**How it works:**
1. Sender sends request
2. Receiver immediately sends ACK
3. Sender knows receiver is processing (within ackTimeout)
4. Receiver processes the function
5. Receiver sends final response (within timeout)

### 3. Builder Pattern

Fluent API for fine-grained control over individual RPC calls.

```typescript
// Basic usage
const result = await rpc
  .$builder("hello")
  .params("Alice")
  .execute();

// With custom timeouts
const result = await rpc
  .$builder("slowOperation")
  .params("data")
  .timeout(5000) // Function execution timeout
  .ackTimeout(1000) // Acknowledgement timeout
  .execute();

// With retry logic
const result = await rpc
  .$builder("unreliableOperation")
  .params("data")
  .timeout(3000)
  .ackTimeout(1000)
  .retry(3) // Retry up to 3 times
  .execute();

// Full chain
const result = await rpc
  .$builder("criticalOperation")
  .params(arg1, arg2)
  .timeout(10000)
  .ackTimeout(2000)
  .retry(5)
  .execute();
```

#### Builder Methods

- **`.$builder(method)`** - Start building a call for the specified method
- **`.params(...args)`** - Set the parameters (type-checked)
- **`.timeout(ms)`** - Set function execution timeout in milliseconds
- **`.ackTimeout(ms)`** - Set acknowledgement timeout in milliseconds
- **`.retry(count)`** - Set number of retry attempts (with exponential backoff)
- **`.execute()`** - Execute the RPC call and return a Promise

All methods are **type-safe** based on your RemoteFunctions interface!

## Full API

### Creating RPC Instance

```typescript
const rpc = createNirpc<RemoteFunctions, LocalFunctions>(
  localFunctions, // Functions this side provides
  {
    post: (data) => {}, // Send message
    on: (handler) => {}, // Receive messages
    off?: (handler) => {}, // Remove message listener
    serialize?: (data) => {}, // Custom serialization
    deserialize?: (data) => {}, // Custom deserialization
    middleware?: async (data) => {}, // Pre-send middleware (NEW)
    timeout?: 60000, // Function execution timeout
    ackTimeout?: 5000, // Acknowledgement timeout (NEW)
    eventNames?: [], // Methods that don't need responses
    resolver?: (name, fn) => {}, // Custom function resolution
    bind?: "rpc" | "functions", // Context binding
    onRequest?: (req, next, resolve) => {}, // Request interceptor
    onFunctionError?: (error, name, args) => {}, // Error handler
    onGeneralError?: (error, name, args) => {}, // General error handler
    onTimeoutError?: (name, args) => {}, // Timeout error handler
  }
);
```

### Calling Remote Functions

```typescript
// Direct call (type-safe)
const result = await rpc.methodName(arg1, arg2);

// Using $call
const result = await rpc.$call("methodName", arg1, arg2);

// Optional call (returns undefined if method doesn't exist)
const result = await rpc.$callOptional("methodName", arg1, arg2);

// Fire-and-forget event
await rpc.$callEvent("methodName", arg1, arg2);

// Using builder (NEW)
const result = await rpc
  .$builder("methodName")
  .params(arg1, arg2)
  .timeout(5000)
  .ackTimeout(1000)
  .retry(3)
  .execute();
```

### Utility Methods

```typescript
// Check if closed
if (rpc.$closed) {
  console.log("RPC is closed");
}

// Close the connection
rpc.$close();

// Reject pending calls
rpc.$rejectPendingCalls((call) => {
  console.log(`Rejecting ${call.method}`);
  call.reject(new Error("Shutting down"));
});

// Access local functions
rpc.$functions.myLocalFunction();
```

## Advanced Examples

### Complete Example with All Features

```typescript
import { createNirpc } from "nirpc";

interface RemoteFunctions {
  processData(data: string): Promise<string>;
  quickCheck(): boolean;
}

interface LocalFunctions {
  notify(message: string): void;
}

const rpc = createNirpc<RemoteFunctions, LocalFunctions>(
  {
    notify: (message) => console.log("Notification:", message),
  },
  {
    post: (data) => websocket.send(JSON.stringify(data)),
    on: (handler) => {
      websocket.onmessage = (e) => handler(JSON.parse(e.data));
    },
    // Add authentication to all messages
    middleware: async (data) => {
      return {
        ...data,
        auth: await getAuthToken(),
        timestamp: Date.now(),
      };
    },
    ackTimeout: 2000, // 2 seconds for ACK
    timeout: 30000, // 30 seconds for execution
  }
);

// Critical operation with retry
try {
  const result = await rpc
    .$builder("processData")
    .params("important data")
    .timeout(10000)
    .ackTimeout(1000)
    .retry(3)
    .execute();
  
  console.log("Success:", result);
} catch (error) {
  console.error("Failed after retries:", error);
}

// Quick check without custom options
const isReady = await rpc.quickCheck();
```

### Error Handling

```typescript
const rpc = createNirpc<RemoteFunctions>(
  {},
  {
    post: (data) => channel.send(data),
    on: (handler) => channel.onMessage(handler),
    onFunctionError: (error, name, args) => {
      console.error(`Error in ${name}:`, error);
      // Return true to prevent error from being thrown
      return false;
    },
    onTimeoutError: (name, args) => {
      console.error(`Timeout calling ${name}`);
      // Return true to prevent error from being thrown
      return false;
    },
  }
);
```

## Type Safety

The library provides full type safety:

```typescript
interface API {
  getUser(id: number): Promise<{ name: string; email: string }>;
  updateSettings(settings: { theme: string }): Promise<boolean>;
}

const rpc = createNirpc<API>({}, options);

// ✅ Type-safe
await rpc.getUser(123);
await rpc.$builder("getUser").params(123).execute();

// ❌ Type errors
await rpc.getUser("123"); // Error: expected number
await rpc.$builder("getUser").params("123").execute(); // Error: expected number
await rpc.nonExistent(); // Error: method doesn't exist
```

## Migration Guide

### Upgrading to v0.0.1 with New Features

All existing code continues to work! The new features are opt-in:

```typescript
// Before (still works)
const result = await rpc.methodName(arg);

// New options available
const result = await rpc
  .$builder("methodName")
  .params(arg)
  .timeout(5000)
  .retry(3)
  .execute();
```

## Running Examples

```bash
bun run examples.ts
```

## Development

```bash
# Install dependencies
bun install

# Run examples
bun run examples.ts

# Run tests (if available)
bun test
```

## License

MIT

---

Built with [Bun](https://bun.com) 🥟
