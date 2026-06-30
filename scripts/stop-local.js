const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pidFile = path.join(root, "server.pid");

if (!fs.existsSync(pidFile)) {
  console.log("没有找到 server.pid。");
  process.exit(0);
}

const pid = Number(fs.readFileSync(pidFile, "utf8").trim());
if (!Number.isInteger(pid) || pid <= 0) {
  console.log("server.pid 内容无效。");
  process.exit(0);
}

try {
  process.kill(pid);
  fs.unlinkSync(pidFile);
  console.log(`已停止本地服务，PID：${pid}`);
} catch (error) {
  console.log(`停止失败或进程已退出：${error.message}`);
  try {
    fs.unlinkSync(pidFile);
  } catch {
    // ignore
  }
}

