/**
 * Example: Simple In-Memory RPC
 * 
 * This example demonstrates the RPC library using in-memory message passing.
 * Perfect for understanding how the library works without external dependencies.
 */

import { createNirpc } from "./index";

interface ServerFunctions {
  add: (a: number, b: number) => number;
  greet: (name: string) => string;
  slowOperation: () => Promise<string>;
  failingOperation: () => never;
}

interface ClientFunctions {
  notify: (message: string) => void;
  onProgress: (percent: number) => void;
}

// Create a simple message bus to simulate client-server communication
class MessageBus {
  private serverHandler?: (data: any) => void;
  private clientHandler?: (data: any) => void;

  sendToServer(data: any) {
    setTimeout(() => {
      this.serverHandler?.(data);
    }, 0);
  }

  sendToClient(data: any) {
    setTimeout(() => {
      this.clientHandler?.(data);
    }, 0);
  }

  onServerMessage(handler: (data: any) => void) {
    this.serverHandler = handler;
  }

  onClientMessage(handler: (data: any) => void) {
    this.clientHandler = handler;
  }
}

async function runSimpleExample() {
  console.log("\n=== Simple In-Memory RPC Example ===\n");

  const bus = new MessageBus();

  // ===== SERVER SIDE =====
  const serverFunctions: ServerFunctions = {
    add: (a: number, b: number) => {
      console.log(`[Server] Computing ${a} + ${b}`);
      return a + b;
    },

    greet: (name: string) => {
      console.log(`[Server] Greeting ${name}`);
      return `Hello, ${name}!`;
    },

    slowOperation: async () => {
      console.log("[Server] Starting slow operation...");
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log("[Server] Slow operation complete");
      return "Operation completed successfully";
    },

    failingOperation: () => {
      console.log("[Server] This will fail!");
      throw new Error("Intentional failure");
    },
  };

  const server = createNirpc<ClientFunctions, ServerFunctions>(
    serverFunctions,
    {
      post: async (data) => {
        bus.sendToClient(data);
      },
      on: (fn) => {
        bus.onServerMessage(fn);
      },
      middleware: async (req) => {
        console.log(`[Server Middleware] Calling client.${req.m}`);
        return req;
      },
    }
  );

  // ===== CLIENT SIDE =====
  const clientFunctions: ClientFunctions = {
    notify: (message: string) => {
      console.log(`[Client] Notification: ${message}`);
    },

    onProgress: (percent: number) => {
      console.log(`[Client] Progress: ${percent}%`);
    },
  };

  const client = createNirpc<ServerFunctions, ClientFunctions>(
    clientFunctions,
    {
      post: async (data) => {
        bus.sendToServer(data);
      },
      on: (fn) => {
        bus.onClientMessage(fn);
      },
      middleware: async (req) => {
        console.log(`[Client Middleware] Calling server.${req.m}`);
        return req;
      },
      ackTimeout: 1000,
      timeout: 5000,
      onAckTimeoutError: (functionName, args) => {
        console.error(`[Client] No acknowledgement for ${functionName}`);
        return false;
      },
    }
  );

  // ===== EXAMPLES =====

  // Example 1: Simple function call
  console.log("\n--- Example 1: Simple Call ---");
  const sum = await client.add(10, 20);
  console.log(`Result: ${sum}\n`);

  // Example 2: Using $call
  console.log("--- Example 2: Using $call ---");
  const greeting = await client.$call("greet", "Alice");
  console.log(`Result: ${greeting}\n`);

  // Example 3: Builder pattern with timeout
  console.log("--- Example 3: Builder Pattern ---");
  const result = await client
    .$builder("slowOperation")
    .timeout(2000)
    .ackTimeout(500)
    .execute();
  console.log(`Result: ${result}\n`);

  // Example 4: Builder with retry
  console.log("--- Example 4: Retry on Failure ---");
  try {
    await client
      .$builder("failingOperation")
      .timeout(1000)
      .retry(2)
      .execute();
  } catch (error: any) {
    console.log(`Caught error after retries: ${error.message}\n`);
  }

  // Example 5: Fire and forget
  console.log("--- Example 5: Fire and Forget ---");
  await client.greet.asEvent("Bob");
  console.log("Event sent (no response expected)\n");

  // Example 6: Server calling client
  console.log("--- Example 6: Server -> Client Call ---");
  await server.$call("notify", "Hello from server!");
  await server.$call("onProgress", 75);
  console.log();

  // Example 7: Multiple calls with builder
  console.log("--- Example 7: Multiple Calls ---");
  const results = await Promise.all([
    client.$builder("add").params(1, 2).execute(),
    client.$builder("add").params(3, 4).execute(),
    client.$builder("greet").params("Charlie").execute(),
  ]);
  console.log(`Results: ${JSON.stringify(results)}\n`);

  // Cleanup
  client.$close();
  server.$close();
  console.log("=== Example Complete ===\n");
}

// Run if this is the main file
if (import.meta.main) {
  runSimpleExample().catch(console.error);
}

export { runSimpleExample };
