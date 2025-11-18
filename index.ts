export type ArgumentsType<T> = T extends (...args: infer A) => any ? A : never;
export type ReturnType<T> = T extends (...args: any) => infer R ? R : never;
export type PromisifyFn<T> = ReturnType<T> extends Promise<any>
  ? T
  : (...args: ArgumentsType<T>) => Promise<Awaited<ReturnType<T>>>;
export type Thenable<T> = T | PromiseLike<T>;

export type NirpcResolver = (
  name: string,
  resolved: (...args: unknown[]) => unknown
) => Thenable<((...args: unknown[]) => unknown) | undefined>;

export interface ChannelOptions {
  /**
   * Function to post raw message
   */
  post: (data: any, ...extras: any[]) => any | Promise<any>;
  /**
   * Listener to receive raw message
   */
  on: (fn: (data: any, ...extras: any[]) => void) => any | Promise<any>;
  /**
   * Clear the listener when `$close` is called
   */
  off?: (fn: (data: any, ...extras: any[]) => void) => any | Promise<any>;
  /**
   * Custom function to serialize data
   *
   * by default it passes the data as-is
   */
  serialize?: (data: any) => any;
  /**
   * Custom function to deserialize data
   *
   * by default it passes the data as-is
   */
  deserialize?: (data: any) => any;

  /**
   * Call the methods with the RPC context or the original functions object
   */
  bind?: "rpc" | "functions";
}

export interface EventOptions<Remote> {
  /**
   * Names of remote functions that do not need response.
   */
  eventNames?: (keyof Remote)[];

  /**
   * Maximum timeout for waiting for response, in milliseconds.
   *
   * @default 60_000
   * @deprecated use `functionTimeout` instead.
   */
  timeout?: number;
  /**
   * Maximum timeout for waiting for a function response, in milliseconds.
   *
   * @default 60_000
   */
  functionTimeout?: number;
  /**
   * Maximum timeout for waiting for acknowledgement from the receiver, in milliseconds.
   *
   * @default 5_000
   */
  ackTimeout?: number;
  /**
   * Default retry count for builder-based calls.
   *
   * @default 0
   */
  retry?: number;

  /**
   * Custom resolver to resolve function to be called
   *
   * For advanced use cases only
   */
  resolver?: NirpcResolver;

  /**
   * Hook triggered before an event is sent to the remote
   *
   * @param req - Request parameters
   * @param next - Function to continue the request
   * @param resolve - Function to resolve the response directly
   */
  onRequest?: (
    req: Request,
    next: (req?: Request) => Promise<any>,
    resolve: (res: any) => void
  ) => void | Promise<void>;

  /**
   * Custom error handler
   *
   * @deprecated use `onFunctionError` and `onGeneralError` instead
   */
  onError?: (error: Error, functionName: string, args: any[]) => boolean | void;

  /**
   * Custom error handler for errors occurred in local functions being called
   *
   * @returns `true` to prevent the error from being thrown
   */
  onFunctionError?: (
    error: Error,
    functionName: string,
    args: any[]
  ) => boolean | void;

  /**
   * Custom error handler for errors occurred during serialization or messsaging
   *
   * @returns `true` to prevent the error from being thrown
   */
  onGeneralError?: (
    error: Error,
    functionName?: string,
    args?: any[]
  ) => boolean | void;

  /**
   * Custom error handler for timeouts
   *
   * @returns `true` to prevent the error from being thrown
   */
  onTimeoutError?: (functionName: string, args: any[]) => boolean | void;
  /**
   * Middleware executed before a request is sent. Return a new request to override what gets sent.
   */
  initialMiddleware?: (
    req: Request
  ) => Promise<Request | void> | Request | void;
}

export type NirpcOptions<Remote> = EventOptions<Remote> & ChannelOptions;

export type NirpcFn<T> = PromisifyFn<T> & {
  /**
   * Send event without asking for response
   */
  asEvent: (...args: ArgumentsType<T>) => Promise<void>;
};

type RpcBuilderExecute<
  RemoteFunctions,
  Method extends keyof RemoteFunctions
> = {
  (): Promise<Awaited<ReturnType<RemoteFunctions[Method]>>>;
  (
    ...args: ArgumentsType<RemoteFunctions[Method]>
  ): Promise<Awaited<ReturnType<RemoteFunctions[Method]>>>;
};

export interface RpcCallBuilder<
  RemoteFunctions,
  Method extends keyof RemoteFunctions | undefined = undefined
> {
  method: <K extends keyof RemoteFunctions>(
    name: K
  ) => RpcCallBuilder<RemoteFunctions, K>;
  params: Method extends keyof RemoteFunctions
    ? (
        ...args: ArgumentsType<RemoteFunctions[Method]>
      ) => RpcCallBuilder<RemoteFunctions, Method>
    : never;
  timeout: (
    ms: number
  ) => RpcCallBuilder<RemoteFunctions, Method>;
  ackTimeout: (
    ms: number
  ) => RpcCallBuilder<RemoteFunctions, Method>;
  retry: (count: number) => RpcCallBuilder<RemoteFunctions, Method>;
  execute: Method extends keyof RemoteFunctions
    ? RpcBuilderExecute<RemoteFunctions, Method>
    : never;
}

export interface NirpcGroupFn<T> {
  /**
   * Call the remote function and wait for the result.
   */
  (...args: ArgumentsType<T>): Promise<Awaited<ReturnType<T>>[]>;
  /**
   * Send event without asking for response
   */
  asEvent: (...args: ArgumentsType<T>) => Promise<void>;
}

export interface NirpcReturnBuiltin<
  RemoteFunctions,
  LocalFunctions = Record<string, never>
> {
  /**
   * Raw functions object
   */
  $functions: LocalFunctions;
  /**
   * Whether the RPC is closed
   */
  readonly $closed: boolean;
  /**
   * Close the RPC connection
   */
  $close: (error?: Error) => void;
  /**
   * Reject pending calls
   */
  $rejectPendingCalls: (handler?: PendingCallHandler) => Promise<void>[];
  /**
   * Call the remote function and wait for the result.
   * An alternative to directly calling the function
   */
  $call: <K extends keyof RemoteFunctions>(
    method: K,
    ...args: ArgumentsType<RemoteFunctions[K]>
  ) => Promise<Awaited<ReturnType<RemoteFunctions[K]>>>;
  /**
   * Same as `$call`, but returns `undefined` if the function is not defined on the remote side.
   */
  $callOptional: <K extends keyof RemoteFunctions>(
    method: K,
    ...args: ArgumentsType<RemoteFunctions[K]>
  ) => Promise<Awaited<ReturnType<RemoteFunctions[K]> | undefined>>;
  /**
   * Send event without asking for response
   */
  $callEvent: <K extends keyof RemoteFunctions>(
    method: K,
    ...args: ArgumentsType<RemoteFunctions[K]>
  ) => Promise<void>;
  /**
   * Call the remote function with the raw options.
   */
  $callRaw: (options: {
    method: string;
    args: unknown[];
    event?: boolean;
    optional?: boolean;
    ackTimeout?: number;
    functionTimeout?: number;
  }) => Promise<Awaited<ReturnType<any>>[]>;
  /**
   * Create a builder chain for calling remote methods with fine-grained control.
   */
  method: <K extends keyof RemoteFunctions>(
    name: K
  ) => RpcCallBuilder<RemoteFunctions, K>;
}

export type NirpcReturn<
  RemoteFunctions,
  LocalFunctions = Record<string, never>
> = {
  [K in keyof RemoteFunctions]: NirpcFn<RemoteFunctions[K]>;
} & NirpcReturnBuiltin<RemoteFunctions, LocalFunctions>;

type PendingCallHandler = (
  options: Pick<PromiseEntry, "method" | "reject">
) => void | Promise<void>;

export interface NirpcGroupReturnBuiltin<RemoteFunctions> {
  /**
   * Call the remote function and wait for the result.
   * An alternative to directly calling the function
   */
  $call: <K extends keyof RemoteFunctions>(
    method: K,
    ...args: ArgumentsType<RemoteFunctions[K]>
  ) => Promise<Awaited<ReturnType<RemoteFunctions[K]>>>;
  /**
   * Same as `$call`, but returns `undefined` if the function is not defined on the remote side.
   */
  $callOptional: <K extends keyof RemoteFunctions>(
    method: K,
    ...args: ArgumentsType<RemoteFunctions[K]>
  ) => Promise<Awaited<ReturnType<RemoteFunctions[K]> | undefined>>;
  /**
   * Send event without asking for response
   */
  $callEvent: <K extends keyof RemoteFunctions>(
    method: K,
    ...args: ArgumentsType<RemoteFunctions[K]>
  ) => Promise<void>;
}

export type NirpcGroupReturn<RemoteFunctions> = {
  [K in keyof RemoteFunctions]: NirpcGroupFn<RemoteFunctions[K]>;
} & NirpcGroupReturnBuiltin<RemoteFunctions>;

export interface NirpcGroup<
  RemoteFunctions,
  LocalFunctions = Record<string, never>
> {
  readonly clients: NirpcReturn<RemoteFunctions, LocalFunctions>[];
  readonly functions: LocalFunctions;
  readonly broadcast: NirpcGroupReturn<RemoteFunctions>;
  updateChannels: (
    fn?: (channels: ChannelOptions[]) => void
  ) => NirpcReturn<RemoteFunctions, LocalFunctions>[];
}

interface PromiseEntry {
  resolve: (arg: any) => void;
  reject: (error: any) => void;
  method: string;
  timeoutId?: ReturnType<typeof setTimeout>;
  ackTimeoutId?: ReturnType<typeof setTimeout>;
  onAck?: () => void;
  acknowledged?: boolean;
}

const TYPE_REQUEST = "q" as const;
const TYPE_RESPONSE = "s" as const;
const TYPE_ACK = "a" as const;

interface Request {
  /**
   * Type
   */
  t: typeof TYPE_REQUEST;
  /**
   * ID
   */
  i?: string;
  /**
   * Method
   */
  m: string;
  /**
   * Arguments
   */
  a: any[];
  /**
   * Optional
   */
  o?: boolean;
}

interface Response {
  /**
   * Type
   */
  t: typeof TYPE_RESPONSE;
  /**
   * Id
   */
  i: string;
  /**
   * Result
   */
  r?: any;
  /**
   * Error
   */
  e?: any;
}

interface Ack {
  /**
   * Type
   */
  t: typeof TYPE_ACK;
  /**
   * Id
   */
  i: string;
}

type RPCMessage = Request | Response | Ack;

export const DEFAULT_TIMEOUT = 60_000; // 1 minute
export const DEFAULT_ACK_TIMEOUT = 5_000; // 5 seconds

function defaultSerialize(i: any) {
  return i;
}
const defaultDeserialize = defaultSerialize;

// Store public APIs locally in case they are overridden later
const { clearTimeout, setTimeout } = globalThis;
const random = Math.random.bind(Math);

export function createNirpc<
  RemoteFunctions = Record<string, never>,
  LocalFunctions extends object = Record<string, never>
>(
  $functions: LocalFunctions,
  options: NirpcOptions<RemoteFunctions>
): NirpcReturn<RemoteFunctions, LocalFunctions> {
  const {
    post,
    on,
    off = () => {},
    eventNames = [],
    serialize = defaultSerialize,
    deserialize = defaultDeserialize,
    resolver,
    bind = "rpc",
    timeout: legacyTimeout = DEFAULT_TIMEOUT,
    functionTimeout: functionTimeoutOption,
    ackTimeout: configuredAckTimeout = DEFAULT_ACK_TIMEOUT,
    retry: configuredRetry = 0,
    initialMiddleware,
  } = options;

  let $closed = false;

  const _rpcPromiseMap = new Map<string, PromiseEntry>();
  let _promiseInit: Promise<any> | any;

  const baseFunctionTimeout =
    typeof functionTimeoutOption === "number"
      ? functionTimeoutOption
      : legacyTimeout;
  const baseAckTimeout = configuredAckTimeout;

  const runInitialMiddleware = async (request: Request) => {
    if (!initialMiddleware) return request;
    const nextRequest = await initialMiddleware(request);
    return (nextRequest ?? request) as Request;
  };

  type CallOverrides = {
    event?: boolean;
    optional?: boolean;
    ackTimeout?: number;
    functionTimeout?: number;
  };

  type BuilderState<
    Method extends keyof RemoteFunctions | undefined = undefined
  > = {
    method?: Method;
    args?: Method extends keyof RemoteFunctions
      ? ArgumentsType<RemoteFunctions[Method]>
      : unknown[];
    ackTimeout?: number;
    functionTimeout?: number;
    retry?: number;
  };

  const defaultRetryCount = Math.max(0, configuredRetry);

  async function _call(
    method: string,
    args: unknown[],
    overrides: CallOverrides = {}
  ) {
    if ($closed)
      throw new Error(`[Nirpc] rpc is closed, cannot call "${method}"`);

    const callOptions = {
      event: overrides.event ?? false,
      optional: overrides.optional ?? false,
      ackTimeout:
        typeof overrides.ackTimeout === "number"
          ? overrides.ackTimeout
          : baseAckTimeout,
      functionTimeout:
        typeof overrides.functionTimeout === "number"
          ? overrides.functionTimeout
          : baseFunctionTimeout,
    };

    const req: Request = { m: method, a: args, t: TYPE_REQUEST };
    if (callOptions.optional) req.o = true;

    const send = async (_req: Request) => post(serialize(_req));
    if (callOptions.event) {
      const outgoingEvent = await runInitialMiddleware(req);
      await send(outgoingEvent);
      return;
    }

    if (_promiseInit) {
      // Wait if `on` is promise
      try {
        await _promiseInit;
      } finally {
        // don't keep resolved promise hanging
        _promiseInit = undefined;
      }
    }

    const {
      promise,
      resolve: resolvePromise,
      reject: rejectPromise,
    } = createPromiseWithResolvers<any>();

    const id = nanoid();
    req.i = id;
    let entryRegistered = false;

    const handler = async (newReq: Request = req) => {
      if (entryRegistered)
        throw new Error(`[Nirpc] request "${method}" already sent.`);
      entryRegistered = true;

      const outgoingRequest = await runInitialMiddleware(newReq);
      const requestId = outgoingRequest.i ?? id;
      outgoingRequest.i = requestId;

      const entry: PromiseEntry = {
        method,
      };

      const cleanup = () => {
        if (entry.timeoutId) clearTimeout(entry.timeoutId as any);
        if (entry.ackTimeoutId) clearTimeout(entry.ackTimeoutId as any);
        _rpcPromiseMap.delete(requestId);
      };

      entry.resolve = (value: any) => {
        cleanup();
        resolvePromise(value);
      };
      entry.reject = (error: any) => {
        cleanup();
        rejectPromise(error);
      };

      const scheduleFunctionTimeout = () => {
        if (callOptions.functionTimeout < 0) return;
        let timeoutHandle = setTimeout(() => {
          const timeoutError = new RpcFunctionTimeoutError(
            method,
            callOptions.functionTimeout
          );
          if (options.onTimeoutError?.(method, args) === true) {
            cleanup();
            return;
          }
          entry.reject(timeoutError);
        }, callOptions.functionTimeout);
        if (typeof timeoutHandle === "object")
          timeoutHandle = timeoutHandle.unref?.();
        entry.timeoutId = timeoutHandle;
      };

      entry.onAck = () => {
        if (entry.acknowledged) return;
        entry.acknowledged = true;
        if (entry.ackTimeoutId) {
          clearTimeout(entry.ackTimeoutId as any);
          entry.ackTimeoutId = undefined;
        }
        scheduleFunctionTimeout();
      };

      const scheduleAckTimeout = () => {
        if (callOptions.ackTimeout < 0) {
          return;
        }
        let ackHandle = setTimeout(() => {
          const ackError = new RpcAckTimeoutError(
            method,
            callOptions.ackTimeout
          );
          if (options.onTimeoutError?.(method, args) === true) {
            cleanup();
            return;
          }
          entry.reject(ackError);
        }, callOptions.ackTimeout);
        if (typeof ackHandle === "object") ackHandle = ackHandle.unref?.();
        entry.ackTimeoutId = ackHandle;
      };

      _rpcPromiseMap.set(requestId, entry);

      scheduleAckTimeout();

      try {
        await send(outgoingRequest);
      } catch (err) {
        const sendError = new RpcSendError(method, err as Error);
        entry.reject(sendError);
        throw sendError;
      }

      if (callOptions.ackTimeout < 0) {
        entry.onAck?.();
      }

      return promise;
    };

    try {
      if (options.onRequest) await options.onRequest(req, handler, resolvePromise);
      else await handler();
    } catch (e) {
      if (options.onGeneralError?.(e as Error) !== true) throw e;
      return;
    }

    return promise;
  }

  const createBuilder = <
    Method extends keyof RemoteFunctions | undefined = undefined
  >(
    builderState: BuilderState<Method> = {} as BuilderState<Method>
  ): RpcCallBuilder<RemoteFunctions, Method> => {
    const update = <
      NextMethod extends keyof RemoteFunctions | undefined
    >(
      patch: Partial<BuilderState<NextMethod>>
    ) =>
      createBuilder<NextMethod>({
        ...(builderState as BuilderState<any>),
        ...(patch as BuilderState<any>),
      });

    const builder = {
      method: <K extends keyof RemoteFunctions>(name: K) =>
        update<K>({ method: name, args: undefined as any }),
      params: ((...builderArgs: unknown[]) => {
        if (!builderState.method)
          throw new Error("[Nirpc] method must be set before params.");
        return update<Method>({
          args: builderArgs as BuilderState<Method>["args"],
        });
      }) as RpcCallBuilder<RemoteFunctions, Method>["params"],
      timeout: (ms: number) =>
        update<Method>({ functionTimeout: ms }),
      ackTimeout: (ms: number) =>
        update<Method>({ ackTimeout: ms }),
      retry: (count: number) =>
        update<Method>({ retry: Math.max(0, Math.floor(count)) }),
      execute: (async (...runtimeArgs: unknown[]) => {
        if (!builderState.method)
          throw new Error("[Nirpc] builder is missing a method name.");
        const argsToUse =
          runtimeArgs.length > 0
            ? runtimeArgs
            : ((builderState.args as unknown[]) ?? []);
        const totalAttempts = Math.max(
          1,
          (builderState.retry ?? defaultRetryCount) + 1
        );
        let lastError: unknown;
        for (let attempt = 0; attempt < totalAttempts; attempt++) {
          try {
            return await _call(builderState.method as string, argsToUse, {
              ackTimeout: builderState.ackTimeout,
              functionTimeout: builderState.functionTimeout,
            });
          } catch (error) {
            lastError = error;
            const shouldRetry =
              error instanceof RpcAckTimeoutError ||
              error instanceof RpcFunctionTimeoutError ||
              error instanceof RpcSendError;
            if (attempt === totalAttempts - 1 || !shouldRetry) {
              throw error;
            }
          }
        }
        throw lastError;
      }) as RpcCallBuilder<RemoteFunctions, Method>["execute"],
    } satisfies RpcCallBuilder<RemoteFunctions, Method>;

    return builder;
  };

  const $call = <K extends keyof RemoteFunctions>(
    method: K,
    ...args: ArgumentsType<RemoteFunctions[K]>
  ) => _call(method as string, args);
  const $callOptional = <K extends keyof RemoteFunctions>(
    method: K,
    ...args: ArgumentsType<RemoteFunctions[K]>
  ) => _call(method as string, args, { optional: true });
  const $callEvent = <K extends keyof RemoteFunctions>(
    method: K,
    ...args: ArgumentsType<RemoteFunctions[K]>
  ) => _call(method as string, args, { event: true });
  const $callRaw = (options: {
    method: string;
    args: unknown[];
    event?: boolean;
    optional?: boolean;
    ackTimeout?: number;
    functionTimeout?: number;
  }) =>
    _call(options.method, options.args, {
      event: options.event,
      optional: options.optional,
      ackTimeout: options.ackTimeout,
      functionTimeout: options.functionTimeout,
    });

  const builtinMethods = {
    $call,
    $callOptional,
    $callEvent,
    $callRaw,
    method: <K extends keyof RemoteFunctions>(name: K) =>
      createBuilder<K>({ method: name } as BuilderState<K>),
    $rejectPendingCalls,
    get $closed() {
      return $closed;
    },
    $close,
    $functions,
  };

  const rpc = new Proxy(
    {},
    {
      get(_, method: string) {
        if (Object.prototype.hasOwnProperty.call(builtinMethods, method))
          return (builtinMethods as any)[method];

        // catch if "createNirpc" is returned from async function
        if (
          method === "then" &&
          !eventNames.includes("then" as any) &&
          !("then" in $functions)
        )
          return undefined;

        const sendEvent = (...args: any[]) =>
          _call(method, args, { event: true });
        if (eventNames.includes(method as any)) {
          sendEvent.asEvent = sendEvent;
          return sendEvent;
        }
        const sendCall = (...args: any[]) => _call(method, args);
        sendCall.asEvent = sendEvent;
        return sendCall;
      },
    }
  ) as NirpcReturn<RemoteFunctions, LocalFunctions>;

  function $close(customError?: Error) {
    $closed = true;
    _rpcPromiseMap.forEach(({ reject, method }) => {
      const error = new Error(`[Nirpc] rpc is closed, cannot call "${method}"`);

      if (customError) {
        customError.cause ??= error;
        return reject(customError);
      }

      reject(error);
    });
    _rpcPromiseMap.clear();
    off(onMessage);
  }

  function $rejectPendingCalls(handler?: PendingCallHandler) {
    const entries = Array.from(_rpcPromiseMap.values());

    const handlerResults = entries.map(({ method, reject }) => {
      if (!handler) {
        return reject(new Error(`[Nirpc]: rejected pending call "${method}".`));
      }

      return handler({ method, reject });
    });

    _rpcPromiseMap.clear();

    return handlerResults;
  }

  async function onMessage(data: any, ...extra: any[]) {
    let msg: RPCMessage;

    try {
      msg = deserialize(data) as RPCMessage;
    } catch (e) {
      if (options.onGeneralError?.(e as Error) !== true) throw e;
      return;
    }

    if (msg.t === TYPE_REQUEST) {
      const { m: method, a: args, o: optional, i: requestId } = msg;
      let result, error: any;
      let fn = await (resolver
        ? resolver(method, ($functions as any)[method])
        : ($functions as any)[method]);

      if (requestId) {
        try {
          await post(serialize(<Ack>{ t: TYPE_ACK, i: requestId }), ...extra);
        } catch (ackError) {
          if (
            options.onGeneralError?.(ackError as Error, method, args) !== true
          )
            throw ackError;
        }
      }

      if (optional) fn ||= () => undefined;

      if (!fn) {
        error = new Error(`[Nirpc] function "${method}" not found`);
      } else {
        try {
          result = await fn.apply(bind === "rpc" ? rpc : $functions, args);
        } catch (e) {
          error = e;
        }
      }

      if (requestId) {
        // Error handling
        if (error && options.onError) options.onError(error, method, args);
        if (error && options.onFunctionError) {
          if (options.onFunctionError(error, method, args) === true) return;
        }

        // Send data
        if (!error) {
          try {
            await post(
              serialize(<Response>{ t: TYPE_RESPONSE, i: requestId, r: result }),
              ...extra
            );
            return;
          } catch (e) {
            error = e;
            if (options.onGeneralError?.(e as Error, method, args) !== true)
              throw e;
          }
        }
        // Try to send error if serialization failed
        try {
          await post(
            serialize(<Response>{ t: TYPE_RESPONSE, i: requestId, e: error }),
            ...extra
          );
        } catch (e) {
          if (options.onGeneralError?.(e as Error, method, args) !== true)
            throw e;
        }
      }
    } else if (msg.t === TYPE_ACK) {
      const promise = _rpcPromiseMap.get(msg.i);
      promise?.onAck?.();
    } else {
      const { i: ack, r: result, e: error } = msg;
      const promise = _rpcPromiseMap.get(ack);
      if (!promise) return;
      if (error) promise.reject(error);
      else promise.resolve(result);
    }
  }

  _promiseInit = on(onMessage);

  return rpc;
}

const cacheMap = new WeakMap<any, any>();
export function cachedMap<T, R>(items: T[], fn: (i: T) => R): R[] {
  return items.map((i) => {
    let r = cacheMap.get(i);
    if (!r) {
      r = fn(i);
      cacheMap.set(i, r);
    }
    return r;
  });
}

export function createNirpcGroup<
  RemoteFunctions = Record<string, never>,
  LocalFunctions extends object = Record<string, never>
>(
  functions: LocalFunctions,
  channels: ChannelOptions[] | (() => ChannelOptions[]),
  options: EventOptions<RemoteFunctions> = {}
): NirpcGroup<RemoteFunctions, LocalFunctions> {
  const getChannels = () =>
    typeof channels === "function" ? channels() : channels;
  const getClients = (channels = getChannels()) =>
    cachedMap(channels, (s) => createNirpc(functions, { ...options, ...s }));

  function _boardcast(
    method: string,
    args: unknown[],
    event?: boolean,
    optional?: boolean
  ) {
    const clients = getClients();
    return Promise.all(
      clients.map((c) => c.$callRaw({ method, args, event, optional }))
    );
  }

  function $call(
    method: string,
    ...args: ArgumentsType<RemoteFunctions[keyof RemoteFunctions]>
  ) {
    return _boardcast(method, args, false);
  }
  function $callOptional(
    method: string,
    ...args: ArgumentsType<RemoteFunctions[keyof RemoteFunctions]>
  ) {
    return _boardcast(method, args, false, true);
  }
  function $callEvent(
    method: string,
    ...args: ArgumentsType<RemoteFunctions[keyof RemoteFunctions]>
  ) {
    return _boardcast(method, args, true);
  }

  const broadcastBuiltin = {
    $call,
    $callOptional,
    $callEvent,
  };

  const broadcastProxy = new Proxy(
    {},
    {
      get(_, method) {
        if (Object.prototype.hasOwnProperty.call(broadcastBuiltin, method))
          return (broadcastBuiltin as any)[method];

        const client = getClients();
        const callbacks = client.map((c) => (c as any)[method]);
        const sendCall = (...args: any[]) => {
          return Promise.all(callbacks.map((i) => i(...args)));
        };
        sendCall.asEvent = async (...args: any[]) => {
          await Promise.all(callbacks.map((i) => i.asEvent(...args)));
        };
        return sendCall;
      },
    }
  ) as NirpcGroupReturn<RemoteFunctions>;

  function updateChannels(fn?: (channels: ChannelOptions[]) => void) {
    const channels = getChannels();
    fn?.(channels);
    return getClients(channels);
  }

  getClients();

  return {
    get clients() {
      return getClients();
    },
    functions,
    updateChannels,
    broadcast: broadcastProxy,
    /**
     * @deprecated use `broadcast`
     */
    // @ts-expect-error deprecated
    boardcast: broadcastProxy,
  };
}

export class RpcAckTimeoutError extends Error {
  readonly code = "ACK_TIMEOUT" as const;
  constructor(method: string, timeout: number) {
    super(`[Nirpc] acknowledgement timeout on "${method}" after ${timeout}ms`);
    this.name = "RpcAckTimeoutError";
  }
}

export class RpcFunctionTimeoutError extends Error {
  readonly code = "FUNCTION_TIMEOUT" as const;
  constructor(method: string, timeout: number) {
    super(`[Nirpc] timeout on calling "${method}" after ${timeout}ms`);
    this.name = "RpcFunctionTimeoutError";
  }
}

export class RpcSendError extends Error {
  readonly code = "SEND_FAILED" as const;
  constructor(method: string, cause?: Error) {
    super(`[Nirpc] failed to send request for "${method}"`);
    this.name = "RpcSendError";
    if (cause) this.cause = cause;
  }
}

function createPromiseWithResolvers<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
} {
  let resolve: (value: T | PromiseLike<T>) => void;
  let reject: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
}

// port from nanoid
// https://github.com/ai/nanoid
const urlAlphabet =
  "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
function nanoid(size = 21) {
  let id = "";
  let i = size;
  while (i--) id += urlAlphabet[(random() * 64) | 0];
  return id;
}
