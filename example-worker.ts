/**
 * Example: RPC with Worker Threads
 * 
 * This example demonstrates using the RPC library with Bun's Worker API
 * to communicate between main thread and worker threads.
 */

import { createNirpc } from "./index";

// Define the interfaces for type safety
interface WorkerFunctions {
  heavyComputation: (n: number) => number;
  processData: (data: string[]) => string;
  asyncTask: () => Promise<string>;
}

interface MainFunctions {
  log: (message: string) => void;
  getStatus: () => string;
}

// Check if we're in the worker thread
if (typeof self !== "undefined" && "postMessage" in self) {
  // WORKER THREAD CODE
  console.log("[Worker] Starting...");

  const workerFunctions: WorkerFunctions = {
    heavyComputation: (n: number) => {
      console.log(`[Worker] Computing factorial of ${n}`);
      let result = 1;
      for (let i = 2; i <= n; i++) {
        result *= i;
      }
      return result;
    },

    processData: (data: string[]) => {
      console.log(`[Worker] Processing ${data.length} items`);
      return data.map((s) => s.toUpperCase()).join(", ");
    },

    asyncTask: async () => {
      console.log("[Worker] Starting async task");
      await new Promise((resolve) => setTimeout(resolve, 100));
      return "Async task completed!";
    },
  };

  // Create RPC instance for worker
  const rpc = createNirpc<MainFunctions, WorkerFunctions>(workerFunctions, {
    post: async (data) => {
      self.postMessage(data);
    },
    on: (fn) => {
      self.onmessage = (event) => {
        fn(event.data);
      };
    },
    middleware: async (req) => {
      console.log(`[Worker Middleware] Calling main.${req.m}`);
      return req;
    },
  });

  // Worker can call main thread functions
  setTimeout(() => {
    rpc.$call("log", "[Worker] I'm alive!").catch(console.error);
  }, 100);

  console.log("[Worker] Ready to receive messages");
}

// MAIN THREAD CODE
export async function runWorkerExample() {
  console.log("\n=== Worker Example ===\n");

  const worker = new Worker(import.meta.url);

  const mainFunctions: MainFunctions = {
    log: (message: string) => {
      console.log(`[Main] Received log: ${message}`);
    },
    getStatus: () => {
      return "Main thread is running";
    },
  };

  // Create RPC instance for main thread
  const rpc = createNirpc<WorkerFunctions, MainFunctions>(mainFunctions, {
    post: async (data) => {
      worker.postMessage(data);
    },
    on: (fn) => {
      worker.onmessage = (event) => {
        fn(event.data);
      };
    },
    middleware: async (req) => {
      console.log(`[Main Middleware] Preparing to call worker.${req.m}`);
      return req;
    },
    ackTimeout: 1000,
    timeout: 5000,
    onAckTimeoutError: (functionName) => {
      console.error(`[Main] No ACK for ${functionName}`);
      return false;
    },
  });

  // Wait a bit for worker to initialize
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Example 1: Simple call
  console.log("\n1. Simple call:");
  const factorial = await rpc.$call("heavyComputation", 5);
  console.log(`   Result: ${factorial}`);

  // Example 2: Using builder pattern with timeout
  console.log("\n2. Builder pattern with custom timeout:");
  const processed = await rpc
    .$builder("processData")
    .params(["hello", "world", "from", "worker"])
    .timeout(2000)
    .ackTimeout(500)
    .execute();
  console.log(`   Result: ${processed}`);

  // Example 3: Async task with retry
  console.log("\n3. Async task with retry:");
  const asyncResult = await rpc
    .$builder("asyncTask")
    .timeout(3000)
    .retry(2)
    .execute();
  console.log(`   Result: ${asyncResult}`);

  // Example 4: Fire and forget
  console.log("\n4. Fire and forget (no response expected):");
  await rpc.processData.asEvent(["fire", "and", "forget"]);
  console.log("   Event sent!");

  // Cleanup
  await new Promise((resolve) => setTimeout(resolve, 100));
  worker.terminate();
  console.log("\n[Main] Worker terminated");
}

// Run if this is the main file
if (import.meta.main && typeof self === "undefined") {
  runWorkerExample().catch(console.error);
}
