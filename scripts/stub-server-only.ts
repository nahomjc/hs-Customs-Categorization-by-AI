/**
 * Lets a test script import modules that start with `import "server-only"`
 * (that package only exists inside Next.js). Import this file FIRST.
 */
import Module from "node:module";

type Loader = (request: string, ...rest: unknown[]) => unknown;
const mod = Module as unknown as { _load: Loader };
const original = mod._load;
mod._load = function (this: unknown, request: string, ...rest: unknown[]) {
  if (request === "server-only") return {};
  return original.call(this, request, ...rest);
};