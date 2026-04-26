/* Run untrusted world code in a real V8 isolate (isolated-vm).
 *
 * Each world JS file gets a fresh Context inside a shared Isolate. The guest
 * realm has no `process`, no `require`, no `Buffer` — just standard V8
 * built-ins (Math, JSON, Date, etc.) plus what we explicitly inject.
 *
 * Host objects (Player, Room, Item, Game, ...) are exposed to the guest as
 * Proxy wrappers backed by an object id table on the host side. Property
 * gets/sets and method calls round-trip through a single host bridge
 * Reference. This preserves the existing API shape (player.write,
 * room.broadcast, player.inventory.push, _.each over host arrays, etc.)
 * without giving the guest any way to reach into the host realm.
 *
 * Object identity is preserved via a WeakMap keyed by the host object, so the
 * same host object always packs to the same id — `===` comparisons of host
 * objects in guest code work as expected (used by underscore's _.without).
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ivm from 'isolated-vm';

const REF_KEY = '__nv_ref__';
const FN_KEY = '__nv_fn__';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UNDERSCORE_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'node_modules', 'underscore', 'underscore.js'),
  'utf8',
);

// Bootstrap runs inside the guest. Defines wrap/unwrap/makeProxy and
// __guestCall (the host's hook to call back into guest functions). All API
// globals (command, room, item, ...) are then installed by the host using the
// id table set up here.
const BOOTSTRAP = `
(function() {
  const REF_KEY = ${JSON.stringify(REF_KEY)};
  const FN_KEY = ${JSON.stringify(FN_KEY)};

  const proxyByObjId = new Map();
  const objIdByProxy = new WeakMap();
  const fnTable = new Map();
  let nextFnId = 1;

  function isPlainTagged(value, key) {
    return value !== null && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key);
  }

  function wrap(value) {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;
    if (isPlainTagged(value, REF_KEY)) {
      const id = value[REF_KEY];
      let p = proxyByObjId.get(id);
      if (!p) {
        p = makeProxy(id);
        proxyByObjId.set(id, p);
        objIdByProxy.set(p, id);
      }
      return p;
    }
    // Plain data passed across the boundary (e.g., a literal style object
    // from host code). Walk it so any nested host refs become proxies.
    if (Array.isArray(value)) return value.map(wrap);
    const out = {};
    for (const k of Object.keys(value)) out[k] = wrap(value[k]);
    return out;
  }

  function unwrap(value) {
    if (value === null || value === undefined) return value;
    // Proxies of host objects use a function as target, so they're
    // typeof === 'function'. Check the objIdByProxy map first, *before*
    // treating any function as a guest callback to register.
    if ((typeof value === 'object' || typeof value === 'function') && objIdByProxy.has(value)) {
      return { [REF_KEY]: objIdByProxy.get(value) };
    }
    if (typeof value === 'function') {
      const id = nextFnId++;
      fnTable.set(id, value);
      return { [FN_KEY]: id };
    }
    if (typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(unwrap);
    const out = {};
    for (const k of Object.keys(value)) out[k] = unwrap(value[k]);
    return out;
  }

  function callHost(op, args) {
    return __host.applySync(undefined, [op, args], {
      arguments: { copy: true },
      result: { copy: true },
    });
  }

  function makeProxy(objId) {
    // Function-typed target so the proxy is callable (host obj might be a fn).
    const target = function () {};
    return new Proxy(target, {
      get(_t, prop) {
        if (prop === '__nv_objId__') return objId;
        if (typeof prop === 'symbol') {
          // Symbols don't transfer across isolates. Return undefined; the
          // few well-known symbols (e.g. Symbol.iterator) will simply not
          // be provided by host objects, which matches the existing API.
          return undefined;
        }
        return wrap(callHost('get', [objId, prop]));
      },
      set(_t, prop, value) {
        if (typeof prop === 'symbol') return true;
        callHost('set', [objId, prop, unwrap(value)]);
        return true;
      },
      has(_t, prop) {
        if (typeof prop === 'symbol') return false;
        return callHost('has', [objId, prop]);
      },
      deleteProperty(_t, prop) {
        if (typeof prop === 'symbol') return true;
        callHost('delete', [objId, prop]);
        return true;
      },
      ownKeys(target) {
        // Proxy invariant: must include every non-configurable own key of
        // the target. The target is a function expression, so 'arguments',
        // 'caller', and 'prototype' are non-configurable own keys and have
        // to be in the result. They are non-enumerable on the target, so
        // Object.keys() filters them out via getOwnPropertyDescriptor.
        const hostKeys = callHost('ownKeys', [objId]);
        const targetKeys = Reflect.ownKeys(target).filter((k) => typeof k === 'string');
        return Array.from(new Set([...hostKeys, ...targetKeys]));
      },
      getOwnPropertyDescriptor(target, prop) {
        if (typeof prop === 'symbol') return undefined;
        // For non-configurable own props on the target, the descriptor we
        // return must match the target's. Forward those directly so the
        // invariant check passes.
        const targetDesc = Reflect.getOwnPropertyDescriptor(target, prop);
        if (targetDesc && targetDesc.configurable === false) return targetDesc;
        if (!callHost('has', [objId, prop])) return undefined;
        return { configurable: true, enumerable: true, writable: true, value: wrap(callHost('get', [objId, prop])) };
      },
      apply(_t, thisArg, args) {
        const thisId = thisArg && objIdByProxy.has(thisArg) ? objIdByProxy.get(thisArg) : null;
        return wrap(callHost('call', [objId, thisId, args.map(unwrap)]));
      },
      construct(_t, args) {
        return wrap(callHost('construct', [objId, args.map(unwrap)]));
      },
    });
  }

  // Host calls this to invoke a guest function previously passed across.
  globalThis.__guestCall = function (fnId, args) {
    const fn = fnTable.get(fnId);
    if (!fn) throw new Error('Unknown guest function id: ' + fnId);
    const wrapped = (args || []).map(wrap);
    const result = fn.apply(undefined, wrapped);
    return unwrap(result);
  };

  // Exposed so the host can install API globals after bootstrap.
  globalThis.__nv_wrap = wrap;
  globalThis.__nv_unwrap = unwrap;
  globalThis.__nv_makeProxy = makeProxy;
})();
`;

export class Sandbox {
  constructor() {
    this.isolate = new ivm.Isolate({ memoryLimit: 128 });
  }

  // Run `code` (string) as a fresh module. `globals` is a dict of names to
  // host values that should appear as guest globals. Functions become
  // callable proxies; other objects become property-access proxies.
  // `consoleLog` is called for `console.log` from the guest.
  // Returns nothing on success; throws if the script throws.
  runModule({ code, filename, globals, consoleLog, scriptTimeoutMs = 5000 }) {
    const context = this.isolate.createContextSync();
    const jail = context.global;

    const objectTable = new Map();   // objId → host value
    const objectIds = new WeakMap(); // host value → objId (identity preservation)
    let nextObjId = 1;

    const register = (value) => {
      if (value === null || value === undefined) return null;
      if (typeof value !== 'object' && typeof value !== 'function') return null;
      if (objectIds.has(value)) return objectIds.get(value);
      const id = nextObjId++;
      objectTable.set(id, value);
      objectIds.set(value, id);
      return id;
    };

    const lookup = (id) => {
      if (!objectTable.has(id)) {
        throw new Error(`Unknown host object id: ${id}`);
      }
      return objectTable.get(id);
    };

    // pack: host value → transferable form for the guest.
    const pack = (value) => {
      if (value === null || value === undefined) return value;
      const t = typeof value;
      if (t === 'object' || t === 'function') {
        return { [REF_KEY]: register(value) };
      }
      // Primitive — pass as-is. We let isolated-vm handle BigInt, etc.
      return value;
    };

    // unpack: transferred guest value → host value.
    // Resolves ref tags to host objects, fn tags to host-callable thunks
    // that bridge to __guestCall, and walks plain arrays/objects.
    const unpack = (value) => {
      if (value === null || value === undefined) return value;
      if (typeof value !== 'object') return value;
      if (Array.isArray(value)) return value.map(unpack);
      if (Object.prototype.hasOwnProperty.call(value, REF_KEY)) {
        return lookup(value[REF_KEY]);
      }
      if (Object.prototype.hasOwnProperty.call(value, FN_KEY)) {
        const fnId = value[FN_KEY];
        // Lazy-resolved guestCall reference (it's defined by bootstrap which
        // runs after these helpers are wired up).
        return (...args) => {
          const guestCall = jail.getSync('__guestCall', { reference: true });
          const packedArgs = args.map(pack);
          const result = guestCall.applySync(undefined, [fnId, packedArgs], {
            arguments: { copy: true },
            result: { copy: true },
          });
          return unpack(result);
        };
      }
      const out = {};
      for (const k of Object.keys(value)) out[k] = unpack(value[k]);
      return out;
    };

    // The single host bridge. Guest invokes this for every cross-realm op.
    const host = (op, args) => {
      switch (op) {
        case 'get': {
          const [objId, prop] = args;
          return pack(lookup(objId)[prop]);
        }
        case 'set': {
          const [objId, prop, value] = args;
          lookup(objId)[prop] = unpack(value);
          return undefined;
        }
        case 'has': {
          const [objId, prop] = args;
          return prop in lookup(objId);
        }
        case 'delete': {
          const [objId, prop] = args;
          delete lookup(objId)[prop];
          return undefined;
        }
        case 'ownKeys': {
          const obj = lookup(args[0]);
          // Reflect.ownKeys returns symbols too; filter to strings since
          // symbols can't cross the isolate boundary.
          return Reflect.ownKeys(obj).filter((k) => typeof k === 'string');
        }
        case 'call': {
          const [objId, thisId, callArgs] = args;
          const fn = lookup(objId);
          const thisArg = thisId == null ? undefined : lookup(thisId);
          return pack(fn.apply(thisArg, callArgs.map(unpack)));
        }
        case 'construct': {
          const [objId, callArgs] = args;
          const Ctor = lookup(objId);
          // eslint-disable-next-line new-cap
          return pack(new Ctor(...callArgs.map(unpack)));
        }
        case 'consoleLog': {
          const [argsArr] = args;
          consoleLog(...argsArr.map(unpack));
          return undefined;
        }
        default:
          throw new Error(`Unknown host op: ${op}`);
      }
    };

    jail.setSync('__host', new ivm.Reference(host));
    // Run bootstrap to wire up wrap/unwrap/makeProxy/__guestCall.
    context.evalSync(BOOTSTRAP, { filename: 'sandbox-bootstrap.js' });

    // Install console as a plain (non-Proxy) object — V8's inspector
    // integration rejects assigning a Proxy to globalThis.console with a
    // cryptic "32-bit number" error.
    context.evalSync(
      `globalThis.console = { log: function() {
         var args = Array.prototype.slice.call(arguments);
         __host.applySync(undefined, ['consoleLog', [args.map(__nv_unwrap)]], {
           arguments: { copy: true },
         });
       } };`,
      { filename: 'sandbox-console.js' },
    );

    // Install API globals (command, room, item, ...). Each is registered as
    // a host object; its id is materialised in the guest as a proxy.
    const apiIds = {};
    for (const [name, value] of Object.entries(globals)) {
      apiIds[name] = register(value);
    }
    const apiSetup = Object.entries(apiIds)
      .map(([name, id]) => `globalThis[${JSON.stringify(name)}] = __nv_wrap({ ${JSON.stringify(REF_KEY)}: ${id} });`)
      .join('\n');
    context.evalSync(apiSetup, { filename: 'sandbox-api-setup.js' });

    // Inject underscore as guest-side library so iteration helpers (_.each,
    // _.without, _.keys, ...) operate on host objects through our Proxy
    // without crossing the isolate boundary for control flow.
    context.evalSync(UNDERSCORE_SRC + '\n;globalThis._ = _;', {
      filename: 'underscore.js',
    });

    // Finally, run the user's module. Suffix `;undefined;` so the script's
    // final expression is a transferable value — the world module's last
    // expression is often a proxy (e.g. `room(...)` returns the room) and
    // isolated-vm cannot transfer a Proxy back across the isolate boundary.
    const script = this.isolate.compileScriptSync(`${code}\n;undefined;`, { filename });
    try {
      script.runSync(context, { timeout: scriptTimeoutMs });
    } finally {
      // Note: we deliberately do not release the context here — long-lived
      // handlers registered by the module need the context to stay alive so
      // that __guestCall keeps working. The context (and its object table)
      // becomes unreachable when the loader replaces the WorldModule, at
      // which point V8 will GC it.
    }
  }
}
