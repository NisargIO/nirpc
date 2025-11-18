import { createNirpc } from "./index";

// Example: Define remote and local function types
interface RemoteFunctions {
  hello(name: string): string;
  add(a: number, b: number): number;
  slowOperation(data: string): Promise<string>;
}

interface LocalFunctions {
  greet(name: string): string;
  multiply(a: number, b: number): number;
}

// Example setup with in-memory message passing (for demonstration)
class MessageChannel {
  private handlers: ((data: any) => void)[] = [];

  post(data: any) {
    // Simulate async message passing
    setTimeout(() => {
      this.handlers.forEach((handler) => handler(data));
    }, 10);
  }

  on(handler: (data: any) => void) {
    this.handlers.push(handler);
  }

  off(handler: (data: any) => void) {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }
}

// Create two message channels for bidirectional communication
const clientToServer = new MessageChannel();
const serverToClient = new MessageChannel();

// ============================================
// Feature 1: Initial Middleware
// ============================================
console.log("\n=== Feature 1: Initial Middleware ===");

const clientWithMiddleware = createNirpc<RemoteFunctions, LocalFunctions>(
  {
    greet: (name) => `Hello from client, ${name}!`,
    multiply: (a, b) => a * b,
  },
  {
    post: (data) => clientToServer.post(data),
    on: (fn) => serverToClient.on(fn),
    off: (fn) => serverToClient.off(fn),
    // Middleware runs before every send
    middleware: async (data) => {
      console.log("[Client Middleware] Processing outgoing message:", data);
      // You can modify, log, encrypt, etc.
      return { ...data, timestamp: Date.now() };
    },
  }
);

// ============================================
// Feature 2: Acknowledgement System
// ============================================
console.log("\n=== Feature 2: Acknowledgement System ===");

const serverWithAck = createNirpc<LocalFunctions, RemoteFunctions>(
  {
    hello: (name) => `Hello, ${name}!`,
    add: (a, b) => a + b,
    slowOperation: async (data) => {
      // Simulate slow operation
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return `Processed: ${data}`;
    },
  },
  {
    post: (data) => serverToClient.post(data),
    on: (fn) => clientToServer.on(fn),
    off: (fn) => clientToServer.off(fn),
    // Set acknowledgement timeout (default is 5000ms)
    ackTimeout: 3000,
    // Set function execution timeout
    timeout: 10000,
  }
);

// The server will automatically send ACK when it receives a request
// The client will wait for ACK before considering the call "in progress"

// ============================================
// Feature 3: Builder Pattern
// ============================================
console.log("\n=== Feature 3: Builder Pattern ===");

// Example 1: Basic builder usage
async function builderExample1() {
  console.log("\n--- Builder Example 1: Basic Usage ---");
  try {
    const result = await clientWithMiddleware
      .$builder("hello")
      .params("Alice")
      .execute();
    console.log("Result:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Example 2: Builder with custom timeouts
async function builderExample2() {
  console.log("\n--- Builder Example 2: Custom Timeouts ---");
  try {
    const result = await clientWithMiddleware
      .$builder("add")
      .params(5, 3)
      .timeout(2000) // Function execution timeout
      .ackTimeout(1000) // Acknowledgement timeout
      .execute();
    console.log("Result:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Example 3: Builder with retry
async function builderExample3() {
  console.log("\n--- Builder Example 3: With Retry ---");
  try {
    const result = await clientWithMiddleware
      .$builder("slowOperation")
      .params("important data")
      .timeout(5000)
      .ackTimeout(1000)
      .retry(3) // Retry up to 3 times on failure
      .execute();
    console.log("Result:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Example 4: Full builder chain
async function builderExample4() {
  console.log("\n--- Builder Example 4: Full Chain ---");
  try {
    const result = await clientWithMiddleware
      .$builder("slowOperation")
      .params("test data")
      .timeout(8000) // 8 seconds for function execution
      .ackTimeout(2000) // 2 seconds for acknowledgement
      .retry(2) // Retry up to 2 times
      .execute();
    console.log("Result:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}

// ============================================
// Feature 4: Combined Example
// ============================================
async function combinedExample() {
  console.log("\n=== Combined Example: All Features Together ===");

  // Create client with middleware and custom settings
  const client = createNirpc<RemoteFunctions>(
    {},
    {
      post: (data) => {
        console.log("[Post]", data);
        return Promise.resolve();
      },
      on: (fn) => {
        console.log("[Listener registered]");
      },
      middleware: async (data) => {
        console.log("[Middleware] Encrypting data...");
        // Simulate encryption
        return { encrypted: true, data };
      },
      ackTimeout: 2000,
      timeout: 5000,
    }
  );

  // Use builder pattern with all features
  try {
    await client
      .$builder("hello")
      .params("World")
      .timeout(3000)
      .ackTimeout(1000)
      .retry(3)
      .execute();
  } catch (error) {
    // Expected to fail since we don't have a real server
    console.log("[Expected] No server to respond");
  }
}

// ============================================
// Traditional Usage (still supported)
// ============================================
async function traditionalUsage() {
  console.log("\n=== Traditional Usage (Still Supported) ===");

  try {
    // Direct method call
    const result1 = await clientWithMiddleware.hello("Bob");
    console.log("Direct call result:", result1);

    // Using $call
    const result2 = await clientWithMiddleware.$call("add", 10, 20);
    console.log("$call result:", result2);

    // Using $callEvent (no response expected)
    await clientWithMiddleware.$callEvent("hello", "Charlie");
    console.log("Event sent");
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run examples
async function runExamples() {
  await builderExample1();
  await builderExample2();
  await builderExample3();
  await builderExample4();
  await combinedExample();
  await traditionalUsage();

  // Clean up
  clientWithMiddleware.$close();
  serverWithAck.$close();
}

// Type-safe example showing builder pattern
type ExampleRPC = {
  getUserData(userId: number): Promise<{ id: number; name: string }>;
  updateSettings(settings: { theme: string; language: string }): Promise<boolean>;
};

function typeSafeExample(rpc: ReturnType<typeof createNirpc<ExampleRPC>>) {
  // All type-safe!
  rpc
    .$builder("getUserData")
    .params(123) // Type-checked: must be a number
    .timeout(5000)
    .ackTimeout(1000)
    .retry(2)
    .execute()
    .then((user) => {
      // user is typed as { id: number; name: string }
      console.log(user.name);
    });

  rpc
    .$builder("updateSettings")
    .params({ theme: "dark", language: "en" }) // Type-checked
    .timeout(3000)
    .execute()
    .then((success) => {
      // success is typed as boolean
      console.log(success);
    });
}

// Export for use
export {
  runExamples,
  typeSafeExample,
  clientWithMiddleware,
  serverWithAck,
  type RemoteFunctions,
  type LocalFunctions,
};

// For standalone execution
if (import.meta.main) {
  runExamples().catch(console.error);
}
