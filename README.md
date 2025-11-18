# nirpc - Enhanced RPC with Builder Pattern & Acknowledgements

A type-safe, feature-rich RPC (Remote Procedure Call) library for TypeScript with acknowledgements, middleware support, and a fluent builder pattern.

## Features

✨ **New Features**:
- 🔧 **Builder Pattern** - Fluent API with method chaining for advanced RPC calls
- ✅ **Acknowledgements** - Receiver acknowledges receipt before processing
- 🔄 **Retry Logic** - Automatic retry with configurable attempts
- ⏱️ **Dual Timeouts** - Separate timeouts for acknowledgement and function execution
- 🎯 **Middleware Support** - Global middleware that runs before any send operation
- 🔒 **Type Safety** - Full TypeScript support with type inference

🎁 **Core Features**:
- Bidirectional RPC calls
- Promise-based async/await API
- Event broadcasting (fire-and-forget)
- Custom serialization/deserialization
- Error handling hooks
- Backward compatible with existing API

## Installation

```bash
bun install
```

## Quick Start

```typescript
import { createNirpc } from "./index";

interface RemoteFunctions {
  hello(name: string): string;
  add(a: number, b: number): number;
}

interface LocalFunctions {
  greet(name: string): string;
}

const localFunctions: LocalFunctions = {
  greet: (name) => `Hello, ${name}!`,
};

const rpc = createNirpc<RemoteFunctions, LocalFunctions>(localFunctions, {
  post: async (data) => {
    // Send data to remote
  },
  on: (fn) => {
    // Listen for incoming messages
  },
  timeout: 5000,       // Function execution timeout
  ackTimeout: 1000,    // Acknowledgement timeout
  middleware: async (req, next) => {
    console.log(`Processing: ${req.m}`);
    return await next(req);
  },
});
```

## Builder Pattern Usage

The builder pattern provides a fluent API for making RPC calls with advanced options:

```typescript
// Basic builder usage
const result = await rpc
  .$builder("hello")
  .params("World")
  .timeout(2000)
  .ackTimeout(500)
  .retry(3)
  .execute();

// Multiple parameters
const sum = await rpc
  .$builder("add")
  .params(5, 10)
  .timeout(1000)
  .ackTimeout(500)
  .retry(2)
  .execute();

// With retry for unreliable connections
const result = await rpc
  .$builder("slowOperation")
  .params()
  .timeout(5000)
  .ackTimeout(1000)
  .retry(5)
  .execute();
```

### Builder Methods

- **`$builder(method)`** - Create a new builder for the specified method
- **`.params(...args)`** - Set the parameters for the method call
- **`.timeout(ms)`** - Set the function execution timeout in milliseconds
- **`.ackTimeout(ms)`** - Set the acknowledgement timeout in milliseconds
- **`.retry(attempts)`** - Set the number of retry attempts (default: 0)
- **`.execute()`** - Execute the RPC call and return a Promise

## Acknowledgement System

When a remote RPC call is made:
1. Request is sent to the receiver
2. Receiver sends an acknowledgement (ACK) immediately upon receipt
3. Receiver processes the function
4. Receiver sends the response with the result

If acknowledgement is not received within `ackTimeout`, the call fails early. If the function execution takes longer than `timeout`, the call times out.

```typescript
const rpc = createNirpc<RemoteFunctions>(localFunctions, {
  post,
  on,
  ackTimeout: 1000,  // Fail if no ACK within 1 second
  timeout: 5000,     // Fail if function takes more than 5 seconds
  onAckTimeoutError: (functionName) => {
    console.error(`No acknowledgement for ${functionName}`);
    return false; // false = throw error, true = suppress error
  },
});
```

## Middleware

Middleware runs before every send operation, allowing you to:
- Log requests
- Modify requests
- Add authentication
- Track metrics

```typescript
const rpc = createNirpc<RemoteFunctions>(localFunctions, {
  post,
  on,
  middleware: async (req, next) => {
    console.log(`[Middleware] ${req.m} with args:`, req.a);
    
    // Optionally modify the request
    const modifiedReq = { ...req, timestamp: Date.now() };
    
    // Continue with the request
    return await next(modifiedReq);
  },
});
```

## Retry Logic

The builder pattern supports automatic retry with exponential backoff:

```typescript
const result = await rpc
  .$builder("unreliableMethod")
  .params("data")
  .retry(5)  // Retry up to 5 times on failure
  .execute();
```

Retry delays: 100ms, 200ms, 300ms, 400ms, 500ms...

## Traditional API (Backward Compatible)

All existing API methods still work:

```typescript
// Direct method call
const result = await rpc.hello("World");

// Using $call
const result = await rpc.$call("hello", "World");

// Optional call (returns undefined if method doesn't exist)
const result = await rpc.$callOptional("maybeExists", "arg");

// Event (fire-and-forget)
await rpc.$callEvent("logMessage", "Hello");

// As event
await rpc.hello.asEvent("World");
```

## Error Handling

```typescript
const rpc = createNirpc<RemoteFunctions>(localFunctions, {
  post,
  on,
  onTimeoutError: (functionName, args) => {
    console.error(`Timeout calling ${functionName}`);
    return false; // throw error
  },
  onAckTimeoutError: (functionName, args) => {
    console.error(`No acknowledgement from ${functionName}`);
    return false; // throw error
  },
  onFunctionError: (error, functionName, args) => {
    console.error(`Error in ${functionName}:`, error);
    return false; // throw error
  },
  onGeneralError: (error, functionName, args) => {
    console.error(`General error:`, error);
    return true; // suppress error
  },
});
```

## Examples

See `examples.ts` for comprehensive usage examples including:
- Builder pattern usage
- Middleware implementation
- Two-way RPC communication
- Error handling
- Retry logic

To run examples:

```bash
bun run examples.ts
```

## Type Safety

All RPC calls are fully type-safe with TypeScript:

```typescript
interface RemoteFunctions {
  add(a: number, b: number): number;
}

// ✅ Type-safe
const result = await rpc.$builder("add").params(5, 10).execute();

// ❌ Type error - wrong parameter types
const result = await rpc.$builder("add").params("5", "10").execute();

// ❌ Type error - wrong method name
const result = await rpc.$builder("subtract").params(5, 10).execute();
```

## API Reference

### Options

```typescript
interface NirpcOptions<Remote> {
  // Required
  post: (data: any) => any | Promise<any>;
  on: (fn: (data: any) => void) => any | Promise<any>;
  
  // Optional
  off?: (fn: (data: any) => void) => any | Promise<any>;
  serialize?: (data: any) => any;
  deserialize?: (data: any) => any;
  timeout?: number;          // Default: 60000 (1 minute)
  ackTimeout?: number;       // Default: 5000 (5 seconds)
  eventNames?: (keyof Remote)[];
  resolver?: NirpcResolver;
  bind?: "rpc" | "functions";
  
  // New options
  middleware?: (req: Request, next: (req?: Request) => Promise<any>) => Promise<any>;
  onAckTimeoutError?: (functionName: string, args: any[]) => boolean | void;
  
  // Existing error handlers
  onTimeoutError?: (functionName: string, args: any[]) => boolean | void;
  onFunctionError?: (error: Error, functionName: string, args: any[]) => boolean | void;
  onGeneralError?: (error: Error, functionName?: string, args?: any[]) => boolean | void;
}
```

## License

MIT

## Credits

Based on [nirpc](https://github.com/antfu/birpc) with enhancements for acknowledgements, middleware, and builder pattern.
