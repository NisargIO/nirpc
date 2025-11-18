import { createNirpc } from "./index";

// Example 1: Basic usage with builder pattern
interface RemoteFunctions {
  hello(name: string): string;
  add(a: number, b: number): number;
  slowOperation(): Promise<string>;
}

interface LocalFunctions {
  greet(name: string): string;
}

// Create a mock channel for demonstration
const createMockChannel = () => {
  const listeners: Array<(data: any) => void> = [];
  return {
    post: async (data: any) => {
      // Simulate sending to remote
      console.log("Sending:", data);
    },
    on: (fn: (data: any) => void) => {
      listeners.push(fn);
    },
    off: (fn: (data: any) => void) => {
      const index = listeners.indexOf(fn);
      if (index > -1) listeners.splice(index, 1);
    },
  };
};

// Create RPC instance
const localFunctions: LocalFunctions = {
  greet: (name: string) => `Hello, ${name}!`,
};

const channel = createMockChannel();
const rpc = createNirpc<RemoteFunctions, LocalFunctions>(localFunctions, {
  ...channel,
  timeout: 5000,
  ackTimeout: 1000,
  // Initial middleware that runs before any send
  middleware: async (req, next) => {
    console.log(`[Middleware] Processing request for method: ${req.m}`);
    // You can modify the request here if needed
    return await next(req);
  },
  onAckTimeoutError: (functionName) => {
    console.error(`[Error] Acknowledgement timeout for ${functionName}`);
    return false; // throw error
  },
  onTimeoutError: (functionName) => {
    console.error(`[Error] Function timeout for ${functionName}`);
    return false; // throw error
  },
});

// Example 2: Using the builder pattern
async function builderPatternExample() {
  try {
    // Builder pattern with all options
    const result = await rpc
      .$builder("hello")
      .params("World")
      .timeout(2000)
      .ackTimeout(500)
      .retry(3)
      .execute();

    console.log("Result:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Example 3: Using builder with complex parameters
async function builderWithMultipleParams() {
  try {
    const sum = await rpc
      .$builder("add")
      .params(5, 10)
      .timeout(1000)
      .ackTimeout(500)
      .retry(2)
      .execute();

    console.log("Sum:", sum);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Example 4: Builder with retry for unreliable operations
async function builderWithRetry() {
  try {
    const result = await rpc
      .$builder("slowOperation")
      .params()
      .timeout(5000)
      .ackTimeout(1000)
      .retry(5) // Retry up to 5 times
      .execute();

    console.log("Result:", result);
  } catch (error) {
    console.error("Error after retries:", error);
  }
}

// Example 5: Traditional call methods still work
async function traditionalExample() {
  try {
    const result = await rpc.$call("hello", "Traditional");
    console.log("Traditional result:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Example 6: Direct method calls (backward compatible)
async function directCallExample() {
  try {
    const result = await rpc.hello("Direct");
    console.log("Direct call result:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Example 7: Two-way RPC with acknowledgements
async function twoWayRpcExample() {
  // Create two RPC instances that communicate with each other
  const messages: any[] = [];

  const functions1 = {
    ping: (msg: string) => {
      console.log("Received ping:", msg);
      return "pong";
    },
  };

  const functions2 = {
    echo: (msg: string) => {
      console.log("Received echo:", msg);
      return `Echo: ${msg}`;
    },
  };

  const rpc1 = createNirpc<typeof functions2, typeof functions1>(functions1, {
    post: async (data) => {
      messages.push({ from: "rpc1", to: "rpc2", data });
      // Simulate async message delivery
      setTimeout(() => {
        const msg = messages.shift();
        if (msg) {
          // Simulate receiving message on rpc2
          console.log("Message delivered from rpc1 to rpc2");
        }
      }, 10);
    },
    on: (fn) => {
      // In a real scenario, this would listen to actual messages
    },
    ackTimeout: 1000,
    middleware: async (req, next) => {
      console.log(`[RPC1 Middleware] Sending ${req.m}`);
      return await next(req);
    },
  });

  const rpc2 = createNirpc<typeof functions1, typeof functions2>(functions2, {
    post: async (data) => {
      messages.push({ from: "rpc2", to: "rpc1", data });
      setTimeout(() => {
        const msg = messages.shift();
        if (msg) {
          console.log("Message delivered from rpc2 to rpc1");
        }
      }, 10);
    },
    on: (fn) => {
      // In a real scenario, this would listen to actual messages
    },
    ackTimeout: 1000,
    middleware: async (req, next) => {
      console.log(`[RPC2 Middleware] Sending ${req.m}`);
      return await next(req);
    },
  });

  // Make calls between RPCs
  try {
    const result = await rpc1
      .$builder("echo")
      .params("Hello from RPC1")
      .timeout(2000)
      .ackTimeout(500)
      .retry(2)
      .execute();

    console.log("RPC1 received:", result);
  } catch (error) {
    console.error("RPC1 error:", error);
  }
}

// Run examples
console.log("=== Running Examples ===\n");

// Note: These examples demonstrate the API but won't actually work
// without proper RPC setup with real channels
console.log("Example 1: Builder Pattern");
builderPatternExample();

console.log("\nExample 2: Builder with Multiple Params");
builderWithMultipleParams();

console.log("\nExample 3: Builder with Retry");
builderWithRetry();

console.log("\nExample 4: Traditional Call");
traditionalExample();

console.log("\nExample 5: Direct Call");
directCallExample();

console.log("\nExample 6: Two-Way RPC");
twoWayRpcExample();
