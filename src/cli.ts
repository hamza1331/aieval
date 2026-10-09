#!/usr/bin/env node

import { runCli } from "./cliMain.js";

const readStdin = (): Promise<string> =>
  new Promise((resolvePromise, reject) => {
    let chunk = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (data) => {
      chunk += data;
    });
    process.stdin.on("end", () => resolvePromise(chunk));
    process.stdin.on("error", reject);
  });

process.exitCode = await runCli(process.argv.slice(2), {
  stdout: (text) => {
    process.stdout.write(text);
  },
  stderr: (text) => {
    process.stderr.write(text);
  },
  readStdin,
});
