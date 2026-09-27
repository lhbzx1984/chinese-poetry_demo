#!/usr/bin/env bash
# ============================================================
# 诗境 · 一键部署脚本（腾讯云 Linux 服务器）
# 用法（root 或 sudo）：
#   bash deploy-tencent.sh
# 可选环境变量：
#   AGNES_API_KEY=sk-xxx   （AI 配图/译文/短片所需；留空可稍后在 .env.local 填）
#   APP_DIR=/opt/shijing   （安装目录，默认 /opt/shijing）
#   PORT=3000              （服务端口，默认 3000）
# 功能：Node 24 安装 → 代码获取（GitHub 失败自动走国内镜像）→ 数据集下载
#       → 数据库构建 → 依赖安装 → 生产构建 → pm2 守护 → 防火墙提醒
# 支持系统：Ubuntu / Debian / TencentOS / CentOS / RHEL（x86_64）
# ============================================================
set -uo pipefail

APP_DIR="${APP_DIR:-/opt/shijing}"
PORT="${PORT:-3000}"
NODE_VERSION_PREFIX="v24."
REPO_HTTPS="https://github.com/lhbzx1984/chinese-poetry_demo.git"
REPO_ZIP="https://ghproxy.net/https://github.com/lhbzx1984/chinese-poetry_demo/archive/refs/heads/main.zip"
DATASET_ZIP="https://ghproxy.net/https://github.com/chinese-poetry/chinese-poetry/archive/refs/heads/master.zip"
NPM_REGISTRY="https://registry.npmmirror.com"

log()  { echo -e "\033[1;33m[诗境部署]\033[0m $*"; }
fail() { echo -e "\033[1;31m[失败]\033[0m $*"; exit 1; }
[[ $EUID -ne 0 ]] && command -v sudo >/dev/null && SUDO="sudo" || SUDO=""

# ---------- 0. 基础工具 ----------
log "安装基础工具（git curl unzip）…"
if command -v apt-get >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  $SUDO apt-get update -y -qq
  $SUDO apt-get install -y -qq git curl unzip xz-utils ca-certificates
elif command -v dnf >/dev/null; then
  $SUDO dnf install -y -q git curl unzip xz ca-certificates
elif command -v yum >/dev/null; then
  $SUDO yum install -y -q git curl unzip xz ca-certificates
fi

# ---------- 1. 内存检查与 swap（小内存机器构建 Next 需要） ----------
MEM_MB=$(free -m | awk '/^Mem:/{print $2}')
SWAP_MB=$(free -m | awk '/^Swap:/{print $2}')
if [ $((MEM_MB + SWAP_MB)) -lt 3800 ]; then
  log "内存偏小（${MEM_MB}MB），创建 2G swap 以保障构建…"
  if [ ! -f /swapfile ]; then
    $SUDO dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
    $SUDO chmod 600 /swapfile
    $SUDO mkswap /swapfile >/dev/null
  fi
  $SUDO swapon /swapfile 2>/dev/null || true
  grep -q swapfile /etc/fstab 2>/dev/null || echo "/swapfile none swap sw 0 0" | $SUDO tee -a /etc/fstab >/dev/null
fi

# ---------- 2. Node 24（npmmirror 二进制直装，国内最快；失败退回 NodeSource） ----------
node_ok() { command -v node >/dev/null && [ "$(node -p 'parseInt(process.versions.node)')" -ge 24 ]; }
if node_ok; then
  log "Node $(node -v) 已满足，跳过安装"
else
  log "安装 Node.js 24…"
  NODE_VER=$(curl -fsSL "https://registry.npmmirror.com/-/binary/node/latest-v24.x/" | grep -oP 'node-v24\.[0-9.]+-linux-x64\.tar\.xz' | head -1 || true)
  if [ -n "${NODE_VER:-}" ]; then
    curl -fsSL --retry 3 -o /tmp/node.tar.xz "https://registry.npmmirror.com/-/binary/node/latest-v24.x/${NODE_VER}"
    $SUDO mkdir -p /usr/local/node24
    $SUDO tar -xJf /tmp/node.tar.xz -C /usr/local/node24 --strip-components=1
    $SUDO ln -sf /usr/local/node24/bin/node /usr/local/bin/node
    $SUDO ln -sf /usr/local/node24/bin/npm  /usr/local/bin/npm
    $SUDO ln -sf /usr/local/node24/bin/npx  /usr/local/bin/npx
    rm -f /tmp/node.tar.xz
  else
    if command -v apt-get >/dev/null; then
      curl -fsSL https://deb.nodesource.com/setup_24.x | $SUDO bash -
      $SUDO apt-get install -y -qq nodejs
    else
      fail "Node 安装失败，请手动安装 Node.js 24"
    fi
  fi
  node_ok || fail "Node 24 安装后仍不可用"
  log "Node $(node -v) 就绪"
fi

# ---------- 3. 代码（GitHub 失败自动走国内镜像；重跑时 git pull，data/ 不受影响） ----------
log "获取项目代码 → ${APP_DIR}"
$SUDO mkdir -p "$APP_DIR"
$SUDO chown -R "$(whoami)" "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --rebase 2>/dev/null || log "git pull 失败（不影响已有数据），继续用现有代码"
else
  git clone -q "$REPO_HTTPS" "$APP_DIR" 2>/dev/null \
    || git clone -q "https://gh-proxy.com/$REPO_HTTPS" "$APP_DIR" 2>/dev/null \
    || { log "clone 失败，改用镜像 ZIP…"
         curl -fsSL --retry 3 -o /tmp/code.zip "$REPO_ZIP"
         $SUDO unzip -qo /tmp/code.zip -d /tmp/code
         cp -a /tmp/code/chinese-poetry_demo-main/. "$APP_DIR/"
         rm -rf /tmp/code /tmp/code.zip
         git -C "$APP_DIR" init -q 2>/dev/null || true; }
  [ -f "$APP_DIR/package.json" ] || fail "代码获取失败"
fi
cd "$APP_DIR"

# ---------- 4. 数据集（chinese-poetry，约 95MB）+ 诗词数据库 ----------
if [ ! -d data/chinese-poetry/json ] && [ ! -d data/chinese-poetry/全唐诗 ]; then
  log "下载 chinese-poetry 数据集（约 95MB，视带宽 1-5 分钟）…"
  curl -fsSL --retry 5 -o data/cp.zip "$DATASET_ZIP" || fail "数据集下载失败，可手动重试"
  unzip -qo data/cp.zip -d data
  mv data/chinese-poetry-master data/chinese-poetry
  rm -f data/cp.zip
else
  log "数据集已存在，跳过下载"
fi
if [ ! -f data/poetry.db ]; then
  log "构建诗词数据库（约 1-2 分钟）…"
  npm run build:db || fail "数据库构建失败"
else
  log "诗词数据库已存在，跳过构建"
fi

# ---------- 5. 依赖安装 ----------
log "安装依赖（npmmirror 源）…"
npm ci --registry="$NPM_REGISTRY" 2>/dev/null || npm install --registry="$NPM_REGISTRY"

# ---------- 6. 环境变量（AI 能力） ----------
if [ ! -f .env.local ]; then
  printf '%s\n' "AGNES_API_KEY=${AGNES_API_KEY:-}" "AI_API_BASE_URL=https://apihub.agnes-ai.com/v1" "IMAGE_MODEL=agnes-image-2.5-flash" "IMAGE_SIZE=1344x768" "TEXT_MODEL=agnes-3.0-flash" "VIDEO_MODEL=agnes-video-2.5-flash" > .env.local
  [ -n "${AGNES_API_KEY:-}" ] && log ".env.local 已写入 AGNES_API_KEY" || log "未提供 AGNES_API_KEY：AI 配图/短片暂不可用，稍后编辑 ${APP_DIR}/.env.local 填入后 pm2 restart shijing"
else
  log ".env.local 已存在，保留原有配置"
fi

# ---------- 7. 生产构建 ----------
log "生产构建（约 1-3 分钟）…"
NEXT_TELEMETRY_DISABLED=1 npm run build || fail "构建失败"

# ---------- 8. pm2 守护 ----------
if ! command -v pm2 >/dev/null; then
  npm i -g pm2 --registry="$NPM_REGISTRY"
fi
pm2 delete shijing >/dev/null 2>&1 || true
NEXT_TELEMETRY_DISABLED=1 PORT="$PORT" pm2 start npm --name shijing -- start
pm2 save >/dev/null
pm2 startup 2>/dev/null | tail -1 | bash 2>/dev/null || log "pm2 开机自启需手动执行上面提示的命令"

# ---------- 9. 主机防火墙（云上还需在控制台安全组放行） ----------
if command -v ufw >/dev/null && ufw status | grep -q "active"; then
  $SUDO ufw allow "$PORT/tcp" && log "ufw 已放行 $PORT"
elif command -v firewall-cmd >/dev/null && firewall-cmd --state 2>/dev/null | grep -q running; then
  $SUDO firewall-cmd --permanent --add-port="$PORT/tcp" && $SUDO firewall-cmd --reload && log "firewalld 已放行 $PORT"
fi

IP=$(curl -fsSL --max-time 5 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
cat <<EOF

============================================================
  ✅ 部署完成
  访问地址：  http://${IP}:${PORT}
  项目目录：  ${APP_DIR}
  常用命令：  pm2 logs shijing      查看日志
              pm2 restart shijing  重启服务
              pm2 monit            资源监控
  数据目录：  ${APP_DIR}/data  （诗词库/配图缓存/影片，升级代码不会丢失）
------------------------------------------------------------
  还需手动完成（云控制台）：
  1. 腾讯云【安全组】放行 TCP ${PORT} 端口入站
  2. 公网开放时建议：Nginx 反代 + Basic Auth（项目无登录，谨防 AI 额度被盗用）
  3. AI 配图/短片需在 .env.local 配置 AGNES_API_KEY（可稍后补配）
============================================================
EOF
