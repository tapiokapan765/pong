const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = process.env.PORT || 3000;
app.use(express.static("public"));

// ==========================
// ゲームデータ
// ==========================
let players = {}; // { id: {x, y, width, height, score} }
let ball = { x: 400, y: 300, vx: 4, vy: 3 };
let gameStarted = false;

// ==========================
// ソケット通信
// ==========================
io.on("connection", (socket) => {
  console.log("接続:", socket.id);

  if (Object.keys(players).length >= 2) {
    socket.emit("full");
    socket.disconnect(true);
    return;
  }

  const isLeft = Object.keys(players).length === 0;
  players[socket.id] = {
    x: isLeft ? 50 : 750,
    y: 300,
    width: 20,
    height: 1000,
    score: 0,
  };

  console.log("プレイヤー参加:", socket.id);

  if (Object.keys(players).length === 2) {
    gameStarted = true;
  }

  socket.on("move", (y) => {
    if (players[socket.id]) {
      players[socket.id].y = y;
    }
  });

  socket.on("disconnect", () => {
    console.log("切断:", socket.id);
    delete players[socket.id];
    gameStarted = false;
    resetBall(4);
  });
});

// ==========================
// 固定フレーム制御
// ==========================
const FPS = 60;
const FRAME_TIME = 1000 / FPS;
let lastTime = Date.now();

function gameLoop() {
  const now = Date.now();
  let delta = now - lastTime;

  while (delta >= FRAME_TIME) {
    updateGame();
    delta -= FRAME_TIME;
    lastTime += FRAME_TIME;
  }

  broadcastState();
}

function updateGame() {
  if (!gameStarted) return;

  // ボール移動
  ball.x += ball.vx;
  ball.y += ball.vy;

  // 上下壁反射
  if (ball.y < 0 || ball.y > 600) ball.vy *= -1;

  // パドル判定
  for (let id in players) {
    let p = players[id];
    if (
      ball.x < p.x + p.width / 2 &&
      ball.x > p.x - p.width / 2 &&
      ball.y < p.y + p.height / 2 &&
      ball.y > p.y - p.height / 2
    ) {
      // 速度増加
      const speedIncrease = 0.5;
      ball.vx += ball.vx > 0 ? speedIncrease : -speedIncrease;
      ball.vy += ball.vy > 0 ? speedIncrease : -speedIncrease;

      // 反射角調整
      let relativeIntersectY = (ball.y - p.y) / (p.height / 2); // -1~1
      let maxBounceAngle = Math.PI / 3; // 60度
      let bounceAngle = relativeIntersectY * maxBounceAngle;

      const speed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
      const direction = ball.vx > 0 ? 1 : -1;
      ball.vx = speed * Math.cos(bounceAngle) * -direction;
      ball.vy = speed * Math.sin(bounceAngle);
    }
  }

  // ゴール判定
  if (ball.x < 0) {
    const rightPlayer = Object.values(players).find((p) => p.x > 400);
    if (rightPlayer) rightPlayer.score++;
    resetBall(-4);
  }
  if (ball.x > 800) {
    const leftPlayer = Object.values(players).find((p) => p.x < 400);
    if (leftPlayer) leftPlayer.score++;
    resetBall(4);
  }
}

// 状態送信
function broadcastState() {
  io.emit("state", { players, ball });
}

// ボールリセット
function resetBall(dir) {
  ball = { x: 400, y: 300, vx: dir, vy: 3 };
}

// ==========================
// 60FPS固定ループ開始
// ==========================
setInterval(gameLoop, 1000 / 60);

// ==========================
// サーバ起動
// ==========================
server.listen(port, () => {
  console.log(`サーバ起動: http://localhost:${port}`);
});