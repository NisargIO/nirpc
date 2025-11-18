import { createNirpc } from "./index";

// Example 1: Basic RPC setup with middleware
interface RemoteFunctions {
  hello: (name: string) => string;
  calculate: (a: number, b: number) => number;
  asyncTask: () => Promise<string>;
}

interface LocalFunctions {
  ping: () => string;
  echo: (message: string) => string;
}

const localFunctions: LocalFunctions = {
  ping: () => "pong",
  echo: (message: string) => `Echo: ${message}`,
};

// Create RPC with middleware that runs before every send
const rpc = createNirpc<RemoteFunctions, LocalFunctions>(localFunctions, {
  post: async (data) => {
    // Send data to remote (e.g., WebSocket, PostMessage, etc.)
    console.log("Sending:", data);
  },
  on: (fn) => {
    // Listen for incoming messages
    // fn would be called with incoming data
  },
  // Middleware runs before every request is sent
  middleware: async (req) => {
    console.log(`[Middleware] Preparing to call ${req.m}`);
    // You can modify the request here
    // For example, add authentication, logging, etc.
    return req; // Return modified request or undefined to use original
  },
  // Configure acknowledgement timeout
  ackTimeout: 5000,
  // Configure function timeout
  timeout: 30000,
  // Handle acknowledgement timeouts
  onAckTimeoutError: (functionName, args) => {
    console.error(`No acknowledgement received for ${functionName}`);
    return false; // Return true to suppress error
  },
});

// Example 2: Using the builder pattern
async function exampleBuilderPattern() {
  // Simple call with timeout
  const result1 = await rpc.hello
    .options({ timeout: 1000 })
    .run("World");

  // Call with acknowledgement timeout
  const result2 = await rpc.calculate
    .options({ ackTimeout: 500, timeout: 2000 })
    .run(10, 20);

  // Call with retry logic
  const result3 = await rpc.asyncTask
    .options({ timeout: 5000, ackTimeout: 1000, retry: 3 }) // Retry up to 3 times on failure
    .run();

  console.log("Results:", result1, result2, result3);
}

// Example 3: Traditional method calling (still works)
async function exampleTraditionalCalls() {
  // Direct call
  const result1 = await rpc.hello("Alice");

  // Using $call
  const result2 = await rpc.$call("calculate", 5, 10);

  // Send as event (no response expected)
  await rpc.hello.asEvent("Bob");
  await rpc.$callEvent("hello", "Charlie");

  console.log("Traditional results:", result1, result2);
}

// Example 4: Real-world WebSocket example
function createWebSocketRPC() {
  const ws = new WebSocket("ws://localhost:3000");

  const wsRpc = createNirpc<RemoteFunctions, LocalFunctions>(localFunctions, {
    post: async (data) => {
      ws.send(JSON.stringify(data));
    },
    on: (fn) => {
      ws.onmessage = (event) => {
        fn(JSON.parse(event.data));
      };
    },
    serialize: (data) => data, // Already handled in post
    deserialize: (data) => data, // Already handled in on
    middleware: async (req) => {
      // Add authentication token to every request
      console.log(`[Auth Middleware] Authenticating call to ${req.m}`);
      return req;
    },
    ackTimeout: 3000,
    timeout: 30000,
  });

  return wsRpc;
}

// Example 5: Using builder with all options
async function exampleAllBuilderOptions() {
  const wsRpc = createWebSocketRPC();

  try {
    const result = await wsRpc.asyncTask
      .options({
        timeout: 10000, // 10 second timeout for function execution
        ackTimeout: 2000, // 2 second timeout for acknowledgement
        retry: 5, // Retry up to 5 times on failure
      })
      .run();

    console.log("Success:", result);
  } catch (error) {
    console.error("Failed after retries:", error);
  }
}

// Example 6: Chaining without params (for functions with no arguments)
async function exampleNoParams() {
  const result = await rpc.asyncTask
    .options({ timeout: 5000, retry: 2 })
    .run();

  console.log("No params result:", result);
}

// Run examples
if (import.meta.main) {
  console.log("RPC Examples with Builder Pattern");
  console.log("==================================\n");

  exampleBuilderPattern().catch(console.error);
  exampleTraditionalCalls().catch(console.error);
  exampleAllBuilderOptions().catch(console.error);
  exampleNoParams().catch(console.error);
}
