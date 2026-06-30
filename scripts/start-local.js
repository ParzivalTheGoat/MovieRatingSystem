const fs = require("fs");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const port = Number(process.env.PORT || 3000);
const pidFile = path.join(root, "server.pid");
const outFile = path.join(root, "server.log");
const errFile = path.join(root, "server.err.log");

function isPortOpen(targetPort) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: targetPort });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(600, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

(async () => {
  if (await isPortOpen(port)) {
    console.log(`服务已经在 http://127.0.0.1:${port} 运行。`);
    process.exit(0);
  }

  const out = fs.openSync(outFile, "a");
  const err = fs.openSync(errFile, "a");
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    detached: true,
    stdio: ["ignore", out, err],
    env: { ...process.env, PORT: String(port) },
  });
  child.unref();
  fs.writeFileSync(pidFile, String(child.pid), "utf8");

  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (await isPortOpen(port)) {
      console.log(`服务启动成功：http://127.0.0.1:${port}`);
      console.log(`PID：${child.pid}`);
      process.exit(0);
    }
  }

  console.error(`服务启动超时，请查看 ${errFile}`);
  process.exit(1);
})();

