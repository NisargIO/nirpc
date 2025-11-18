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
   */
  timeout?: number;

  /**
   * Maximum timeout for waiting for acknowledgement, in milliseconds.
   *
   * @default 5_000
   */
  ackTimeout?: number;

  /**
   * Custom resolver to resolve function to be called
   *
   * For advanced use cases only
   */
  resolver?: NirpcResolver;

  /**
   * Middleware that runs before sending any request
   *
   * @param req - Request parameters
   * @returns Modified request or void to continue with original
   */
  middleware?: (req: Request) => Promise<Request | void> | Request | void;

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
   * Custom error handler for acknowledgement timeouts
   *
   * @returns `true` to prevent the error from being thrown
   */
  onAckTimeoutError?: (functionName: string, args: any[]) => boolean | void;
}

export type NirpcOptions<Remote> = EventOptions<Remote> & ChannelOptions;

export type NirpcFn<T> = PromisifyFn<T> & {
  /**
   * Send event without asking for response
   */
  asEvent: (...args: ArgumentsType<T>) => Promise<void>;
};

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
  }) => Promise<Awaited<ReturnType<any>>[]>;
  /**
   * Create a builder for method call with advanced options
   */
  $builder: <K extends keyof RemoteFunctions>(
    method: K
  ) => NirpcCallBuilder<RemoteFunctions[K]>;
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

interface Acknowledgement {
  /**
   * Type
   */
  t: typeof TYPE_ACK;
  /**
   * Id
   */
  i: string;
}

type RPCMessage = Request | Response | Acknowledgement;

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
    timeout = DEFAULT_TIMEOUT,
    ackTimeout = DEFAULT_ACK_TIMEOUT,
    middleware,
  } = options;

  let $closed = false;

  const _rpcPromiseMap = new Map<string, PromiseEntry>();
  let _promiseInit: Promise<any> | any;

  async function _call(
    method: string,
    args: unknown[],
    event?: boolean,
    optional?: boolean,
    callOptions?: {
      timeout?: number;
      ackTimeout?: number;
      retry?: number;
    }
  ) {
    if ($closed)
      throw new Error(`[Nirpc] rpc is closed, cannot call "${method}"`);

    let req: Request = { m: method, a: args, t: TYPE_REQUEST };
    if (optional) req.o = true;

    // Apply middleware if provided
    if (middleware) {
      const modifiedReq = await middleware(req);
      if (modifiedReq) req = modifiedReq;
    }

    const send = async (_req: Request) => post(serialize(_req));
    if (event) {
      await send(req);
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

    // eslint-disable-next-line prefer-const
    let { promise, resolve, reject } = createPromiseWithResolvers<any>();

    const id = nanoid();
    req.i = id;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function handler(newReq: Request = req) {
      const actualTimeout = callOptions?.timeout ?? timeout;
      const actualAckTimeout = callOptions?.ackTimeout ?? ackTimeout;
      
      let ackTimeoutId: ReturnType<typeof setTimeout> | undefined;

      // Set acknowledgement timeout
      if (actualAckTimeout >= 0) {
        ackTimeoutId = setTimeout(() => {
          const entry = _rpcPromiseMap.get(id);
          if (entry && !entry.acknowledged) {
            try {
              const handleResult = options.onAckTimeoutError?.(method, args);
              if (handleResult !== true)
                throw new Error(`[Nirpc] acknowledgement timeout on calling "${method}"`);
            } catch (e) {
              reject(e);
            }
            _rpcPromiseMap.delete(id);
          }
        }, actualAckTimeout);

        if (typeof ackTimeoutId === "object") ackTimeoutId = ackTimeoutId.unref?.();
      }

      // Set function execution timeout
      if (actualTimeout >= 0) {
        timeoutId = setTimeout(() => {
          try {
            const handleResult = options.onTimeoutError?.(method, args);
            if (handleResult !== true)
              throw new Error(`[Nirpc] timeout on calling "${method}"`);
          } catch (e) {
            reject(e);
          }
          _rpcPromiseMap.delete(id);
        }, actualTimeout);

        if (typeof timeoutId === "object") timeoutId = timeoutId.unref?.();
      }

      _rpcPromiseMap.set(id, { resolve, reject, timeoutId, ackTimeoutId, method, acknowledged: false });
      await send(newReq);
      return promise;
    }

    const retryCount = callOptions?.retry ?? 0;
    let lastError: any;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        if (options.onRequest) await options.onRequest(req, handler, resolve);
        else await handler();
        
        const result = await promise;
        const entry = _rpcPromiseMap.get(id);
        if (entry) {
          clearTimeout(entry.timeoutId);
          clearTimeout(entry.ackTimeoutId);
          _rpcPromiseMap.delete(id);
        }
        return result;
      } catch (e) {
        lastError = e;
        const entry = _rpcPromiseMap.get(id);
        if (entry) {
          clearTimeout(entry.timeoutId);
          clearTimeout(entry.ackTimeoutId);
          _rpcPromiseMap.delete(id);
        }
        
        // Don't retry on last attempt
        if (attempt < retryCount) {
          // Generate new id for retry
          const newId = nanoid();
          req.i = newId;
          const newPromise = createPromiseWithResolvers<any>();
          resolve = newPromise.resolve;
          reject = newPromise.reject;
          promise = newPromise.promise;
          continue;
        }
        
        if (options.onGeneralError?.(e as Error) !== true) throw e;
        return;
      }
    }

    if (lastError) throw lastError;
    return promise;
  }

  const $call = <K extends keyof RemoteFunctions>(
    method: K,
    ...args: ArgumentsType<RemoteFunctions[K]>
  ) => _call(method as string, args, false);
  const $callOptional = <K extends keyof RemoteFunctions>(
    method: K,
    ...args: ArgumentsType<RemoteFunctions[K]>
  ) => _call(method as string, args, false, true);
  const $callEvent = <K extends keyof RemoteFunctions>(
    method: K,
    ...args: ArgumentsType<RemoteFunctions[K]>
  ) => _call(method as string, args, true);
  const $callRaw = (options: {
    method: string;
    args: unknown[];
    event?: boolean;
    optional?: boolean;
  }) => _call(options.method, options.args, options.event, options.optional);
  const $builder = <K extends keyof RemoteFunctions>(method: K) =>
    new NirpcCallBuilder<RemoteFunctions[K]>(method as string, _call);

  const builtinMethods = {
    $call,
    $callOptional,
    $callEvent,
    $callRaw,
    $builder,
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

        const sendEvent = (...args: any[]) => _call(method, args, true);
        if (eventNames.includes(method as any)) {
          sendEvent.asEvent = sendEvent;
          return sendEvent;
        }
        const sendCall = (...args: any[]) => _call(method, args, false);
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

    if (msg.t === TYPE_ACK) {
      // Handle acknowledgement
      const { i: ackId } = msg;
      const entry = _rpcPromiseMap.get(ackId);
      if (entry) {
        entry.acknowledged = true;
        clearTimeout(entry.ackTimeoutId);
      }
      return;
    }

    if (msg.t === TYPE_REQUEST) {
      // Send acknowledgement if request has an ID
      if (msg.i) {
        try {
          await post(serialize(<Acknowledgement>{ t: TYPE_ACK, i: msg.i }), ...extra);
        } catch (e) {
          if (options.onGeneralError?.(e as Error) !== true) throw e;
        }
      }
      const { m: method, a: args, o: optional } = msg;
      let result, error: any;
      let fn = await (resolver
        ? resolver(method, ($functions as any)[method])
        : ($functions as any)[method]);

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

      if (msg.i) {
        // Error handling
        if (error && options.onError) options.onError(error, method, args);
        if (error && options.onFunctionError) {
          if (options.onFunctionError(error, method, args) === true) return;
        }

        // Send data
        if (!error) {
          try {
            await post(
              serialize(<Response>{ t: TYPE_RESPONSE, i: msg.i, r: result }),
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
            serialize(<Response>{ t: TYPE_RESPONSE, i: msg.i, e: error }),
            ...extra
          );
        } catch (e) {
          if (options.onGeneralError?.(e as Error, method, args) !== true)
            throw e;
        }
      }
    } else {
      const { i: ack, r: result, e: error } = msg;
      const promise = _rpcPromiseMap.get(ack);
      if (promise) {
        clearTimeout(promise.timeoutId);

        if (error) promise.reject(error);
        else promise.resolve(result);
      }
      _rpcPromiseMap.delete(ack);
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

/**
 * Builder class for creating RPC calls with advanced options
 */
export class NirpcCallBuilder<T> {
  private _method: string;
  private _args: ArgumentsType<T> = [] as any;
  private _timeout?: number;
  private _ackTimeout?: number;
  private _retry?: number;
  private _callFn: (
    method: string,
    args: unknown[],
    event?: boolean,
    optional?: boolean,
    callOptions?: {
      timeout?: number;
      ackTimeout?: number;
      retry?: number;
    }
  ) => Promise<any>;

  constructor(
    method: string,
    callFn: (
      method: string,
      args: unknown[],
      event?: boolean,
      optional?: boolean,
      callOptions?: {
        timeout?: number;
        ackTimeout?: number;
        retry?: number;
      }
    ) => Promise<any>
  ) {
    this._method = method;
    this._callFn = callFn;
  }

  /**
   * Set the method to call (alternative to constructor)
   */
  method(name: string): this {
    this._method = name;
    return this;
  }

  /**
   * Set the parameters for the method call
   */
  params(...args: ArgumentsType<T>): this {
    this._args = args;
    return this;
  }

  /**
   * Set the function execution timeout in milliseconds
   */
  timeout(ms: number): this {
    this._timeout = ms;
    return this;
  }

  /**
   * Set the acknowledgement timeout in milliseconds
   */
  ackTimeout(ms: number): this {
    this._ackTimeout = ms;
    return this;
  }

  /**
   * Set the number of retry attempts
   */
  retry(attempts: number): this {
    this._retry = attempts;
    return this;
  }

  /**
   * Execute the RPC call with configured options
   */
  async execute(): Promise<Awaited<ReturnType<T>>> {
    return this._callFn(this._method, this._args, false, false, {
      timeout: this._timeout,
      ackTimeout: this._ackTimeout,
      retry: this._retry,
    });
  }
}
