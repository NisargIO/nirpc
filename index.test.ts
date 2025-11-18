import { test, expect, describe, beforeEach, mock } from "bun:test";
import { createNirpc, NirpcCallBuilder, DEFAULT_TIMEOUT, DEFAULT_ACK_TIMEOUT } from "./index";

describe("RPC Core Functionality", () => {
  test("should create RPC instance", () => {
    const localFunctions = {
      ping: () => "pong",
    };

    const rpc = createNirpc(localFunctions, {
      post: async (data) => {},
      on: (fn) => {},
    });

    expect(rpc).toBeDefined();
    expect(rpc.$functions).toBe(localFunctions);
    expect(rpc.$closed).toBe(false);
  });

  test("should call local function when receiving request", async () => {
    let messageHandler: any;
    const localFunctions = {
      add: (a: number, b: number) => a + b,
    };

    let sentData: any;
    const rpc = createNirpc(localFunctions, {
      post: async (data) => {
        sentData = data;
      },
      on: (fn) => {
        messageHandler = fn;
      },
    });

    // Simulate receiving a request
    await messageHandler({
      t: "q",
      i: "test123",
      m: "add",
      a: [5, 10],
    });

    // Should send back response
    expect(sentData).toBeDefined();
    expect(sentData.t).toBe("s");
    expect(sentData.i).toBe("test123");
    expect(sentData.r).toBe(15);
  });

  test("should handle async local functions", async () => {
    let messageHandler: any;
    const localFunctions = {
      asyncAdd: async (a: number, b: number) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return a + b;
      },
    };

    let sentData: any;
    const rpc = createNirpc(localFunctions, {
      post: async (data) => {
        sentData = data;
      },
      on: (fn) => {
        messageHandler = fn;
      },
    });

    await messageHandler({
      t: "q",
      i: "async123",
      m: "asyncAdd",
      a: [3, 7],
    });

    expect(sentData.r).toBe(10);
  });
});

describe("Acknowledgement Protocol", () => {
  test("should send acknowledgement when receiving request", async () => {
    let messageHandler: any;
    const sentMessages: any[] = [];

    const rpc = createNirpc(
      {
        test: () => "result",
      },
      {
        post: async (data) => {
          sentMessages.push(data);
        },
        on: (fn) => {
          messageHandler = fn;
        },
      }
    );

    await messageHandler({
      t: "q",
      i: "req123",
      m: "test",
      a: [],
    });

    // Should send ACK first, then response
    expect(sentMessages.length).toBe(2);
    expect(sentMessages[0].t).toBe("a"); // ACK
    expect(sentMessages[0].i).toBe("req123");
    expect(sentMessages[1].t).toBe("s"); // Response
    expect(sentMessages[1].i).toBe("req123");
  });

  test("should handle acknowledgement timeout", async () => {
    let messageHandler: any;
    const rpc = createNirpc<{ test: () => string }>(
      {},
      {
        post: async (data) => {
          // Don't send anything back
        },
        on: (fn) => {
          messageHandler = fn;
        },
        ackTimeout: 100,
      }
    );

    const promise = rpc.$call("test");
    
    // Wait for ack timeout
    await expect(promise).rejects.toThrow("acknowledgement timeout");
  });

  test("should clear ack timeout when acknowledgement received", async () => {
    let messageHandler: any;
    let postCallback: any;

    const rpc = createNirpc<{ test: () => string }>(
      {},
      {
        post: async (data) => {
          postCallback = data;
        },
        on: (fn) => {
          messageHandler = fn;
        },
        ackTimeout: 1000,
        timeout: 2000,
      }
    );

    const promise = rpc.$call("test");

    // Simulate receiving ACK
    await messageHandler({
      t: "a",
      i: postCallback.i,
    });

    // Simulate receiving response
    await messageHandler({
      t: "s",
      i: postCallback.i,
      r: "success",
    });

    const result = await promise;
    expect(result).toBe("success");
  });

  test("should call onAckTimeoutError handler", async () => {
    let ackTimeoutCalled = false;
    const rpc = createNirpc<{ test: () => string }>(
      {},
      {
        post: async (data) => {},
        on: (fn) => {},
        ackTimeout: 50,
        onAckTimeoutError: (functionName, args) => {
          ackTimeoutCalled = true;
          expect(functionName).toBe("test");
          return false;
        },
      }
    );

    await expect(rpc.$call("test")).rejects.toThrow();
    expect(ackTimeoutCalled).toBe(true);
  });
});

describe("Middleware", () => {
  test("should call middleware before sending request", async () => {
    let middlewareCalled = false;
    let messageHandler: any;

    const rpc = createNirpc<{ test: (x: number) => string }>(
      {},
      {
        post: async (data) => {},
        on: (fn) => {
          messageHandler = fn;
        },
        middleware: async (req) => {
          middlewareCalled = true;
          expect(req.m).toBe("test");
          expect(req.a).toEqual([42]);
          return req;
        },
      }
    );

    rpc.$call("test", 42).catch(() => {});
    
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(middlewareCalled).toBe(true);
  });

  test("should allow middleware to modify request", async () => {
    let messageHandler: any;
    let sentRequest: any;

    const rpc = createNirpc<{ test: (x: number) => string }>(
      {},
      {
        post: async (data) => {
          sentRequest = data;
        },
        on: (fn) => {
          messageHandler = fn;
        },
        middleware: async (req) => {
          // Modify the request
          return {
            ...req,
            a: [req.a[0] * 2], // Double the argument
          };
        },
      }
    );

    rpc.$call("test", 10).catch(() => {});
    
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sentRequest.a).toEqual([20]);
  });

  test("middleware should work with builder pattern", async () => {
    let middlewareCalled = false;
    let messageHandler: any;

    const rpc = createNirpc<{ test: (x: number) => number }>(
      {},
      {
        post: async (data) => {},
        on: (fn) => {
          messageHandler = fn;
        },
        middleware: async (req) => {
          middlewareCalled = true;
          return req;
        },
      }
    );

    rpc.$builder("test").params(42).execute().catch(() => {});
    
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(middlewareCalled).toBe(true);
  });
});

describe("Builder Pattern", () => {
  test("should create builder instance", () => {
    const rpc = createNirpc<{ test: () => string }>(
      {},
      {
        post: async (data) => {},
        on: (fn) => {},
      }
    );

    const builder = rpc.$builder("test");
    expect(builder).toBeInstanceOf(NirpcCallBuilder);
  });

  test("should chain builder methods", () => {
    const rpc = createNirpc<{ test: (x: number, y: string) => string }>(
      {},
      {
        post: async (data) => {},
        on: (fn) => {},
      }
    );

    const builder = rpc
      .$builder("test")
      .params(42, "hello")
      .timeout(1000)
      .ackTimeout(500)
      .retry(3);

    expect(builder).toBeInstanceOf(NirpcCallBuilder);
  });

  test("should execute builder with custom timeout", async () => {
    let messageHandler: any;
    let sentRequest: any;

    const rpc = createNirpc<{ test: () => string }>(
      {},
      {
        post: async (data) => {
          sentRequest = data;
        },
        on: (fn) => {
          messageHandler = fn;
        },
        timeout: 5000,
      }
    );

    const promise = rpc.$builder("test").timeout(100).execute();

    // Don't send response, let it timeout
    await expect(promise).rejects.toThrow("timeout");
  });

  test("should execute builder with params", async () => {
    let messageHandler: any;
    let sentRequest: any;

    const rpc = createNirpc<{ add: (a: number, b: number) => number }>(
      {},
      {
        post: async (data) => {
          sentRequest = data;
          // Simulate response
          messageHandler({
            t: "a",
            i: data.i,
          });
          messageHandler({
            t: "s",
            i: data.i,
            r: 15,
          });
        },
        on: (fn) => {
          messageHandler = fn;
        },
      }
    );

    const result = await rpc.$builder("add").params(5, 10).execute();

    expect(sentRequest.a).toEqual([5, 10]);
    expect(result).toBe(15);
  });
});

describe("Retry Logic", () => {
  test("should retry on timeout", async () => {
    let callCount = 0;
    let messageHandler: any;

    const rpc = createNirpc<{ test: () => string }>(
      {},
      {
        post: async (data) => {
          callCount++;
        },
        on: (fn) => {
          messageHandler = fn;
        },
        timeout: 50,
      }
    );

    const promise = rpc.$builder("test").timeout(50).retry(2).execute();

    await expect(promise).rejects.toThrow();
    
    // Should have tried 3 times (initial + 2 retries)
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(callCount).toBe(3);
  });

  test("should support configuring retry count", () => {
    const rpc = createNirpc<{ test: () => string }>(
      {},
      {
        post: async (data) => {},
        on: (fn) => {},
      }
    );

    // Builder should accept retry configuration
    const builder = rpc.$builder("test").retry(5);
    expect(builder).toBeInstanceOf(NirpcCallBuilder);
  });

  test("should not retry if no retry count specified", async () => {
    let callCount = 0;

    const rpc = createNirpc<{ test: () => string }>(
      {},
      {
        post: async (data) => {
          callCount++;
        },
        on: (fn) => {},
        timeout: 50,
      }
    );

    await expect(rpc.$builder("test").timeout(50).execute()).rejects.toThrow();
    
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(callCount).toBe(1);
  });
});

describe("Traditional API Compatibility", () => {
  test("should work with direct function calls", async () => {
    let messageHandler: any;

    const rpc = createNirpc<{ hello: (name: string) => string }>(
      {},
      {
        post: async (data) => {
          setTimeout(() => {
            messageHandler({
              t: "a",
              i: data.i,
            });
            messageHandler({
              t: "s",
              i: data.i,
              r: `Hello ${data.a[0]}`,
            });
          }, 10);
        },
        on: (fn) => {
          messageHandler = fn;
        },
      }
    );

    const result = await rpc.hello("World");
    expect(result).toBe("Hello World");
  });

  test("should work with $call", async () => {
    let messageHandler: any;

    const rpc = createNirpc<{ add: (a: number, b: number) => number }>(
      {},
      {
        post: async (data) => {
          setTimeout(() => {
            messageHandler({
              t: "a",
              i: data.i,
            });
            messageHandler({
              t: "s",
              i: data.i,
              r: 15,
            });
          }, 10);
        },
        on: (fn) => {
          messageHandler = fn;
        },
      }
    );

    const result = await rpc.$call("add", 5, 10);
    expect(result).toBe(15);
  });

  test("should work with asEvent", async () => {
    let sentRequest: any;

    const rpc = createNirpc<{ notify: (msg: string) => void }>(
      {},
      {
        post: async (data) => {
          sentRequest = data;
        },
        on: (fn) => {},
      }
    );

    await rpc.notify.asEvent("test message");

    expect(sentRequest.m).toBe("notify");
    expect(sentRequest.a).toEqual(["test message"]);
    expect(sentRequest.i).toBeUndefined(); // Events don't have IDs
  });
});

describe("Error Handling", () => {
  test("should handle function errors", async () => {
    let messageHandler: any;
    let sentData: any;

    const rpc = createNirpc(
      {
        errorFunc: () => {
          throw new Error("Test error");
        },
      },
      {
        post: async (data) => {
          sentData = data;
        },
        on: (fn) => {
          messageHandler = fn;
        },
      }
    );

    await messageHandler({
      t: "q",
      i: "err123",
      m: "errorFunc",
      a: [],
    });

    expect(sentData.t).toBe("s");
    expect(sentData.i).toBe("err123");
    expect(sentData.e).toBeDefined();
    expect(sentData.e.message).toBe("Test error");
  });

  test("should call onFunctionError handler", async () => {
    let errorHandlerCalled = false;
    let messageHandler: any;

    const rpc = createNirpc(
      {
        errorFunc: () => {
          throw new Error("Test error");
        },
      },
      {
        post: async (data) => {},
        on: (fn) => {
          messageHandler = fn;
        },
        onFunctionError: (error, functionName, args) => {
          errorHandlerCalled = true;
          expect(error.message).toBe("Test error");
          expect(functionName).toBe("errorFunc");
          return true; // Suppress error
        },
      }
    );

    await messageHandler({
      t: "q",
      i: "err123",
      m: "errorFunc",
      a: [],
    });

    expect(errorHandlerCalled).toBe(true);
  });

  test("should handle timeout errors", async () => {
    const rpc = createNirpc<{ slowFunc: () => string }>(
      {},
      {
        post: async (data) => {
          // Don't respond
        },
        on: (fn) => {},
        timeout: 50,
      }
    );

    await expect(rpc.$call("slowFunc")).rejects.toThrow("timeout");
  });
});

describe("Close and Cleanup", () => {
  test("should close RPC connection", () => {
    const rpc = createNirpc(
      {},
      {
        post: async (data) => {},
        on: (fn) => {},
      }
    );

    expect(rpc.$closed).toBe(false);
    rpc.$close();
    expect(rpc.$closed).toBe(true);
  });

  test("should reject pending calls on close", async () => {
    let messageHandler: any;

    const rpc = createNirpc<{ test: () => string }>(
      {},
      {
        post: async (data) => {},
        on: (fn) => {
          messageHandler = fn;
        },
      }
    );

    const promise = rpc.$call("test");
    
    // Close before response
    rpc.$close();

    await expect(promise).rejects.toThrow("rpc is closed");
  });

  test("should not allow calls after close", async () => {
    const rpc = createNirpc<{ test: () => string }>(
      {},
      {
        post: async (data) => {},
        on: (fn) => {},
      }
    );

    rpc.$close();

    await expect(rpc.$call("test")).rejects.toThrow("rpc is closed");
  });
});
