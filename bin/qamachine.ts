#!/usr/bin/env node
import { buildProgram } from '../src/composition-root/cli.js';

buildProgram()
  .parseAsync(process.argv)
  .catch((error: unknown) => {
    // Every command's own action already catches and reports its errors;
    // this is only a last-resort net for something escaping that (e.g. a
    // commander parsing failure before any action ran).
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
