import { homedir } from "node:os";
import { join, delimiter } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import cli from "@tauri-apps/cli";

// A newly installed Rust toolchain need not require restarting the parent editor.
const cargoBin = join(homedir(), ".cargo", "bin");
const pathKey =
  Object.keys(process.env).find((key) => key.toLowerCase() === "path") ||
  "PATH";
if (existsSync(cargoBin))
  process.env[pathKey] = cargoBin + delimiter + (process.env[pathKey] || "");
const [action = "dev", ...args] = process.argv.slice(2);
if (action === "dev") {
  const config = JSON.parse(readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
  const productName = "GitGoblin (development)";
  args.unshift("--config", JSON.stringify({
    productName,
    app: { windows: config.app.windows.map(window => ({ ...window, title: productName })) },
  }));
}
if (action === "test") {
  const result = spawnSync(
    "cargo",
    ["test", "--manifest-path", "src-tauri/Cargo.toml", ...args],
    { stdio: "inherit" },
  );
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
} else {
  await cli.run([action, ...args], "gitgoblin");
}
