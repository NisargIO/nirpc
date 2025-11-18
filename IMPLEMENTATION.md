# RPC Package Enhancement - Implementation Summary

## Overview

This document describes the enhancements made to the nirpc (RPC) package to support:
1. Initial middleware for preprocessing requests
2. Acknowledgement system for reliable communication
3. Builder pattern with method chaining and type safety
4. Retry logic with exponential backoff
5. Separate timeouts for acknowledgement and function execution

## Key Features Implemented

### 1. Acknowledgement System

**What it does:**
- The receiver immediately acknowledges receipt of RPC requests before processing
- Sender can detect network/delivery issues early via `ackTimeout`
- Separate from function execution timeout

**Implementation:**
- Added `TYPE_ACK` message type alongside `TYPE_REQUEST` and `TYPE_RESPONSE`
- Receiver sends ACK message immediately upon receiving a request
- Sender tracks acknowledgement status in `PromiseEntry`
- Configurable `ackTimeout` (default: 5 seconds)

**Message Flow:**
```
Sender                    Receiver
  |                          |
  |------ REQUEST ---------> |
  | <------ ACK ------------ | (immediate)
  |                          | (processing...)
  | <----- RESPONSE -------- |
  |                          |
```

### 2. Middleware Support

**What it does:**
- Global middleware runs before any RPC send operation
- Can log, modify, or intercept requests
- Supports async operations

**Implementation:**
- Added `middleware` option to `NirpcOptions`
- Middleware signature: `(req: Request, next: (req?: Request) => Promise<any>) => Promise<any>`
- Applied in `_callOnce` before posting to transport layer

**Example:**
```typescript
middleware: async (req, next) => {
  console.log(`[Middleware] ${req.m}`);
  const modifiedReq = { ...req, timestamp: Date.now() };
  return await next(modifiedReq);
}
```

### 3. Builder Pattern

**What it does:**
- Fluent API for advanced RPC calls with method chaining
- Configure timeout, ackTimeout, and retry per call
- Full type safety maintained throughout the chain

**Implementation:**
- Added `RpcCallBuilder<T>` and `RpcCallBuilderWithParams<T>` interfaces
- Implemented `$builder(method)` method on RPC instance
- Builder captures method name and parameters, then passes options to `_call`

**API:**
```typescript
rpc.$builder("methodName")
   .params(arg1, arg2)
   .timeout(1000)
   .ackTimeout(500)
   .retry(3)
   .execute();
```

**Type Safety:**
- Method name must exist in RemoteFunctions
- Parameters must match method signature
- Return type inferred from method definition

### 4. Retry Logic

**What it does:**
- Automatically retries failed RPC calls
- Exponential backoff between attempts
- Configurable retry count

**Implementation:**
- Refactored `_call` to wrap `_callOnce` in retry loop
- Retry delays: 100ms, 200ms, 300ms, 400ms, 500ms...
- Formula: `100 * (attempt + 1)` milliseconds
- Last error is thrown if all retries fail

### 5. Dual Timeout System

**What it does:**
- `ackTimeout`: Maximum time to wait for acknowledgement
- `timeout`: Maximum time for complete function execution
- Both configurable per-call or globally

**Implementation:**
- Two separate timeout handlers in `PromiseEntry`
- `ackTimeoutId`: Cleared when ACK received
- `timeoutId`: Cleared when response received
- Both support custom error handlers

## Code Changes

### Type Definitions

**Added:**
- `Acknowledgement` interface for ACK messages
- `RpcCallBuilder<T>` and `RpcCallBuilderWithParams<T>` interfaces
- `ackTimeout` and `middleware` in `EventOptions`
- `onAckTimeoutError` error handler
- `$builder` method in `NirpcReturnBuiltin`

**Modified:**
- `PromiseEntry` - added `ackTimeoutId` and `ackReceived` fields
- `RPCMessage` type - now includes `Acknowledgement`
- Message constants - added `TYPE_ACK`

### Core Functions

**`createNirpc`:**
- Extracts `ackTimeout` and `middleware` from options
- Passes call options to internal `_call` function

**`_call` (new):**
- Wrapper function that implements retry logic
- Loops up to `maxRetries + 1` times
- Implements exponential backoff between retries

**`_callOnce` (refactored from `_call`):**
- Implements single RPC call attempt
- Applies middleware before posting
- Sets up both acknowledgement and function timeouts
- Creates promise entry with ACK tracking

**`onMessage`:**
- Added `TYPE_ACK` case to handle acknowledgements
- Sets `ackReceived` flag and clears ack timeout
- Refactored to handle three message types: REQUEST, ACK, RESPONSE
- Sends ACK immediately upon receiving REQUEST with ID

**`$builder`:**
- Returns `RpcCallBuilder` with fluent API
- Captures configuration through closures
- Calls `_call` with options on `execute()`

## Backward Compatibility

All changes are **fully backward compatible**:

✅ Existing `$call`, `$callOptional`, `$callEvent` methods work unchanged
✅ Direct method calls (`rpc.method()`) still function
✅ Event names and `.asEvent()` work as before
✅ All existing options still supported
✅ Default timeouts prevent breaking changes

## Usage Examples

### Basic Builder Pattern
```typescript
const result = await rpc
  .$builder("hello")
  .params("World")
  .timeout(2000)
  .ackTimeout(500)
  .retry(3)
  .execute();
```

### With Middleware
```typescript
const rpc = createNirpc<RemoteFunctions>(localFunctions, {
  post, on,
  middleware: async (req, next) => {
    console.log(`Processing ${req.m}`);
    return await next(req);
  }
});
```

### Error Handling
```typescript
const rpc = createNirpc<RemoteFunctions>(localFunctions, {
  post, on,
  ackTimeout: 1000,
  onAckTimeoutError: (fnName) => {
    console.error(`No ACK for ${fnName}`);
    return false; // throw error
  }
});
```

## Testing

Created comprehensive examples in:
- `examples.ts` - Multiple real-world usage scenarios
- `test-builder.ts` - Type safety and API verification

## Default Values

- `timeout`: 60,000ms (60 seconds) - unchanged
- `ackTimeout`: 5,000ms (5 seconds) - new
- `retry`: 0 (no retry) - new default

## Files Modified

1. **index.ts** - Core implementation
   - Added message types and interfaces
   - Implemented builder pattern
   - Added acknowledgement handling
   - Added middleware support
   - Implemented retry logic

2. **examples.ts** - Comprehensive usage examples
   - Builder pattern examples
   - Middleware examples
   - Two-way RPC with acknowledgements
   - Error handling scenarios

3. **README.md** - Complete documentation
   - Feature overview
   - API reference
   - Usage examples
   - Migration guide

4. **test-builder.ts** - Type safety verification
   - Builder API tests
   - Type checking examples
   - Method chaining verification

## Technical Decisions

### Why Builder Pattern?
- Cleaner API for optional parameters
- Better discoverability in IDEs
- Type safety maintained throughout
- Extensible for future options

### Why Separate Acknowledgement?
- Early detection of network issues
- Distinguish between delivery and execution problems
- Better debugging and monitoring
- Follows request-acknowledgement-response pattern

### Why Middleware?
- Cross-cutting concerns (logging, auth, metrics)
- Request modification/enrichment
- Consistent with HTTP middleware patterns
- Composable and testable

### Retry Implementation
- Simple exponential backoff
- Configurable per call
- Last error preserved
- No jitter (can be added later if needed)

## Future Enhancements

Possible additions (not implemented):
- Multiple middleware with composition
- Circuit breaker pattern
- Request/response interceptors
- Streaming support
- Batch calls
- Priority queues
- Metrics collection hooks

## Breaking Changes

**None** - All changes are additive and backward compatible.

## Performance Considerations

- Acknowledgement adds one extra message per RPC call
- Middleware adds minimal overhead (one async function call)
- Retry logic only activates on failure
- Builder pattern has negligible allocation overhead
- All timeouts use `unref()` in Node.js to prevent blocking

## Summary

The enhanced nirpc package now provides enterprise-grade features while maintaining simplicity and backward compatibility. The builder pattern offers a modern, type-safe API, while acknowledgements ensure reliable communication. Middleware support enables cross-cutting concerns, and retry logic handles transient failures gracefully.
