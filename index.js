const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ─── ROUTES ──────────────────────────────────────────────────────────────────
// Route '/' → player join page: nhập mã phòng để vào (giống /player)
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'player.html')); });
app.get('/admin',  (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin.html')); });
app.get('/player', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'player.html')); });

app.use(express.static(path.join(__dirname, 'public')));
// ─────────────────────────────────────────────────────────────────────────────

// ─── CÀI ĐẶT TRẬN ĐẤU ─────────────────────────────────────────────────────
const TOTAL_STAGES       = 5;   // Tổng số vòng (giảm từ 10 xuống 5)
const QUESTIONS_PER_STAGE = 5;  // Số câu mỗi vòng
const FINAL_STAGE        = 5;   // Vòng cuối: nhân đôi điểm + thời gian 50s
const TIMER_NORMAL       = 60;  // Giây cho vòng thường
const TIMER_FINAL        = 50;  // Giây cho vòng 5 (rút ngắn)
const INTERMISSION_TIME  = 15;  // Giây nghỉ giải lao
// ──────────────────────────────────────────────────────────────────────────────

// Tải toàn bộ kho câu hỏi một lần khi server khởi động
const questionsData = require('./data/questions.js');

const CHAPTER_KEYS = ['chapter1', 'chapter2', 'chapter3', 'chapter4'];

// Đếm tổng số câu để log khi khởi động
function countAllQuestions() {
  let total = 0;
  CHAPTER_KEYS.forEach(key => {
    const ch = questionsData[key];
    if (!ch) return;
    ch.stages.forEach(arr => { total += arr.length; });
  });
  return total;
}

// ─── CHỌN CÂU HỎI CÂN BẰNG THEO CHƯƠNG ─────────────────────────────────────
// Mỗi vòng đảm bảo có câu hỏi từ TẤT CẢ các chương (chapter1..chapter4).
// Thuật toán:
//   1. Xáo trộn độc lập từng pool chương → câu trong chương không lặp trước khi vòng lại
//   2. Mỗi vòng: lấy ít nhất 1 câu/chương, câu "dư" (5 mod 4 = 1) được trao cho
//      một chương ngẫu nhiên khác nhau mỗi vòng
//   3. Xáo trộn thứ tự chương mỗi vòng + xáo trộn lần cuối trong vòng
// Kết quả: mỗi vòng luôn có đủ nội dung các chương, không bao giờ thiếu chương nào.
function pickRoundQuestions() {
  // Xây pool riêng cho từng chương, xáo trộn độc lập
  const pools = CHAPTER_KEYS
    .map(key => {
      const chapter = questionsData[key];
      if (!chapter) return [];
      const qs = [];
      chapter.stages.forEach(stageArr => {
        stageArr.forEach(q => qs.push({ ...q }));
      });
      return qs.sort(() => Math.random() - 0.5); // xáo trộn trong chương
    })
    .filter(pool => pool.length > 0);

  if (!pools.length) return [];

  const numChapters = pools.length;
  const pointers    = new Array(numChapters).fill(0);

  // Lấy câu tiếp theo từ pool ci, vòng lại nếu đã dùng hết
  const getNext = (ci) => {
    const pool = pools[ci];
    if (!pool.length) return null;
    const q = pool[pointers[ci] % pool.length];
    pointers[ci]++;
    return q;
  };

  // base  = số câu tối thiểu mỗi chương đóng góp mỗi vòng  (= 1 khi 4 ch / 5 câu)
  // extra = số chương được cộng thêm 1 câu để đủ QUESTIONS_PER_STAGE (= 1)
  const base  = Math.floor(QUESTIONS_PER_STAGE / numChapters);
  const extra = QUESTIONS_PER_STAGE % numChapters;

  const rounds = [];
  for (let r = 0; r < TOTAL_STAGES; r++) {
    const roundQs = [];

    // Xáo thứ tự chương mỗi vòng → tránh cố định vị trí câu hỏi theo chương
    const chapterOrder = [...Array(numChapters).keys()].sort(() => Math.random() - 0.5);

    chapterOrder.forEach((ci, orderIdx) => {
      // Chương đứng đầu orderIdx < extra được thêm 1 câu "dư"
      const count = base + (orderIdx < extra ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const q = getNext(ci);
        if (q) roundQs.push(q);
      }
    });

    // Xáo trộn lần cuối trong vòng → thứ tự câu hoàn toàn ngẫu nhiên
    rounds.push(roundQs.sort(() => Math.random() - 0.5));
  }

  return rounds; // rounds[0] = vòng 1 … rounds[TOTAL_STAGES-1] = vòng cuối
}
// ─────────────────────────────────────────────────────────────────────────────

const rooms = {};

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// Tạo trạng thái phòng mới — câu hỏi được chọn lại mỗi lần
function createRoomState(roomId, adminSocketId) {
  return {
    roomId,
    adminSocketId,
    status: 'lobby',
    currentStage: 0,
    players: [],
    teamA: [],
    teamB: [],
    teamC: null,
    bonusTeamA: 0,
    bonusTeamB: 0,
    timer: null,
    stageStartTime: 0,
    fastPhase: { questionText: '', active: false, submissions: [] },
    // ★ Câu hỏi được chọn ngẫu nhiên mới hoàn toàn cho mỗi phòng/lượt chơi
    roundQuestions: pickRoundQuestions()
  };
}

function getScores(room) {
  const scoreA = room.teamA.reduce((s, p) => s + p.score, 0) + room.bonusTeamA;
  const scoreB = room.teamB.reduce((s, p) => s + p.score, 0) + room.bonusTeamB;
  const scoreC = room.teamC ? room.teamC.score : 0;
  return { scoreA, scoreB, scoreC };
}

function getLeaderboard(room) {
  return [...room.players]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.totalTimeTaken - b.totalTimeTaken;
    })
    .map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      team: p.team,
      totalTimeTaken: p.totalTimeTaken,
      lastDelta: p.lastDelta || 0
    }));
}

io.on('connection', (socket) => {

  // ── ADMIN: Tạo phòng mới ────────────────────────────────────────────────────
  socket.on('adminCreateRoom', () => {
    const roomId = generateRoomId();
    rooms[roomId] = createRoomState(roomId, socket.id);
    socket.join('room_' + roomId);
    socket.join('admin_' + roomId);
    socket.emit('roomCreated', roomId);
  });

  // ── PLAYER: Tham gia phòng ──────────────────────────────────────────────────
  socket.on('playerJoinRoom', ({ roomId, name, avatar }) => {
    const rId = roomId.toUpperCase();
    const room = rooms[rId];
    if (!room || room.status !== 'lobby') {
      return socket.emit('errorMsg', 'Phòng không tồn tại hoặc trận đấu đã bắt đầu!');
    }
    const playerName = (name || '').trim().substring(0, 20);
    if (!playerName) return socket.emit('errorMsg', 'Tên không hợp lệ!');

    const playerAvatar = (avatar || 'default_animal').trim();

    // Chia đội cân bằng tự động
    const countA = room.teamA.length;
    const countB = room.teamB.length;
    let assignedTeam;
    if (countA < countB)      assignedTeam = 'A';
    else if (countB < countA) assignedTeam = 'B';
    else                      assignedTeam = Math.random() < 0.5 ? 'A' : 'B';

    const player = {
      id: socket.id, name: playerName, avatar: playerAvatar,
      score: 0, team: assignedTeam,
      submittedCurrentStage: false, _stageAnswers: {}, _answeredCount: 0,
      totalTimeTaken: 0, lastDelta: 0, history: []
    };

    room.players.push(player);
    (assignedTeam === 'A' ? room.teamA : room.teamB).push(player);

    socket.join('room_' + rId);
    socket.data.roomId = rId;

    socket.emit('joinedRoom', { roomId: room.roomId, team: assignedTeam });

    io.to('room_' + rId).emit('updatePlayerList', room.players.map(p => ({
      id: p.id, name: p.name, avatar: p.avatar, team: p.team
    })));
  });

  // ── ADMIN: Bắt đầu trận ────────────────────────────────────────────────────
  socket.on('adminStartGame', (roomId) => {
    const room = rooms[roomId];
    if (!room || room.players.length === 0) return;

    room.status = 'playing';

    room.players.forEach(p => {
      io.to(p.id).emit('roleAssignment', { team: p.team });
    });

    // Gửi kèm tổng số vòng để UI hiển thị thanh tiến trình
    io.to('admin_' + roomId).emit('gameStarted', { totalStages: TOTAL_STAGES });
    io.to('room_' + roomId).emit('gameStarted', { totalStages: TOTAL_STAGES });
    startStage(roomId, 1);
  });

  // ── PLAYER: Nộp câu trả lời từng câu ───────────────────────────────────────
  socket.on('submitSingleAnswer', ({ roomId, questionId, answer }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.submittedCurrentStage) return;

    const currentQData = player._stageAnswers[questionId];
    if (!currentQData) return; // questionId không hợp lệ, bỏ qua

    const timeTakenForThisQ = (Date.now() - room.stageStartTime) / 1000;
    player.totalTimeTaken += parseFloat(timeTakenForThisQ.toFixed(2));

    const isCorrect = (answer === currentQData.correctKey);

    // ★ Vòng 5 (FINAL_STAGE): điểm đúng ×2 → +20, sai -3
    const isFinalStage = (room.currentStage === FINAL_STAGE);
    const points = isCorrect ? (isFinalStage ? 20 : 10) : -3;

    player.score = Math.max(0, player.score + points);
    player.lastDelta = points;

    player.history.push({
      questionText: currentQData.text,
      choices: currentQData.choices,
      chosenAnswer: answer,
      correctAnswer: currentQData.correctKey,
      isCorrect,
      pointsDelta: points
    });

    player._answeredCount++;

    socket.emit('singleAnswerResult', {
      questionId, isCorrect,
      points: points >= 0 ? `+${points}` : `${points}`,
      currentScore: player.score
    });

    // Cập nhật bảng điểm realtime cho Admin
    const { scoreA, scoreB, scoreC } = getScores(room);
    io.to('admin_' + roomId).emit('realtimeScoreUpdate', {
      scoreA, scoreB, scoreC, players: getLeaderboard(room)
    });

    const totalQs = Object.keys(player._stageAnswers).length;
    if (player._answeredCount >= totalQs) {
      player.submittedCurrentStage = true;
    }

    // Nếu mọi người đã nộp bài → kết thúc vòng ngay, không đợi hết giờ
    if (room.players.length > 0 && room.players.every(p => p.submittedCurrentStage)) {
      clearInterval(room.timer);
      startIntermission(roomId);
    }
  });

  // ── PHÒNG CHAT (Sảnh chờ & Giải lao) ───────────────────────────────────────
  socket.on('sendGlobalMessage', ({ roomId, msg }) => {
    const room = rooms[roomId];
    if (!room || (room.status !== 'lobby' && room.status !== 'intermission') || !msg?.trim()) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    io.to('room_' + roomId).emit('receiveGlobalMessage', {
      name: player.name,
      msg: msg.trim().substring(0, 150),
      team: player.team
    });
  });

  // ── VÒNG CÂU HỎI NHANH TỰ LUẬN (Đội C) ────────────────────────────────────
  socket.on('hostSubmitFastQuestion', ({ roomId, questionText }) => {
    const room = rooms[roomId];
    if (!room || !room.teamC || room.teamC.id !== socket.id) return;

    room.fastPhase.active = true;
    room.fastPhase.questionText = questionText;
    room.fastPhase.submissions = [];

    io.to('room_' + roomId).emit('fastQuestionBroadcast', {
      questionText, hostName: room.teamC.name
    });
  });

  socket.on('playerSubmitFastAnswer', ({ roomId, answerText }) => {
    const room = rooms[roomId];
    if (!room || !room.fastPhase.active) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.team === 'C') return;

    const subItem = { id: socket.id, name: player.name, team: player.team, answerText };
    room.fastPhase.submissions.push(subItem);
    io.to(room.teamC.id).emit('hostReceiveSubmissions', room.fastPhase.submissions);
  });

  socket.on('hostApproveWinner', ({ roomId, winnerSocketId }) => {
    const room = rooms[roomId];
    if (!room || !room.teamC || room.teamC.id !== socket.id || !room.fastPhase.active) return;

    const winner = room.players.find(p => p.id === winnerSocketId);
    if (winner) {
      const rewardPoints = room.teamC.score;
      if (winner.team === 'A') room.bonusTeamA += rewardPoints;
      if (winner.team === 'B') room.bonusTeamB += rewardPoints;

      io.to('room_' + roomId).emit('fastPhaseEnded', {
        winnerName: winner.name, winningTeam: winner.team, pointsAwarded: rewardPoints
      });
    }
    room.fastPhase.active = false;
    endGameFinal(roomId);
  });

  // ── ADMIN: Reset phòng → câu hỏi được chọn lại ngẫu nhiên ─────────────────
  socket.on('adminResetGame', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    clearInterval(room.timer);

    // ★ createRoomState gọi pickRoundQuestions() → bộ câu hỏi hoàn toàn mới
    rooms[roomId] = createRoomState(roomId, socket.id);
    io.to('room_' + roomId).emit('roomResetByAdmin');
  });

  // ── Xử lý ngắt kết nối ─────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];
    room.players = room.players.filter(p => p.id !== socket.id);
    room.teamA   = room.teamA.filter(p => p.id !== socket.id);
    room.teamB   = room.teamB.filter(p => p.id !== socket.id);
    if (room.teamC?.id === socket.id) room.teamC = null;

    io.to('room_' + roomId).emit('updatePlayerList', room.players.map(p => ({
      id: p.id, name: p.name, avatar: p.avatar, team: p.team
    })));

    // Nếu người còn lại đều đã nộp bài → tự động chuyển sang giải lao
    if (room.status === 'playing' && room.players.length > 0 &&
        room.players.every(p => p.submittedCurrentStage)) {
      clearInterval(room.timer);
      startIntermission(roomId);
    }
  });
});

// ─── BẮT ĐẦU VÒNG ──────────────────────────────────────────────────────────
function startStage(roomId, stageNum) {
  const room = rooms[roomId];
  if (!room) return;

  room.status       = 'playing';
  room.currentStage = stageNum;
  room.stageStartTime = Date.now();

  const isFinalStage = (stageNum === FINAL_STAGE);
  const timeLimit    = isFinalStage ? TIMER_FINAL : TIMER_NORMAL;
  const letters      = ['A', 'B', 'C', 'D'];

  // ★ Lấy 5 câu đã được chọn sẵn cho vòng này (giống nhau cho mọi người chơi)
  const stageQs = room.roundQuestions[stageNum - 1];

  io.to('admin_' + roomId).emit('stageUpdate', {
    stageNum, totalStages: TOTAL_STAGES,
    isDouble: isFinalStage,
    questionCount: QUESTIONS_PER_STAGE,
    timeLimit
  });

  room.players.forEach(p => {
    p.submittedCurrentStage = false;
    p._answeredCount        = 0;
    p._stageAnswers         = {};

    // ★ Xáo trộn THỨ TỰ CÂU HỎI riêng cho từng người chơi
    const shuffledQs = [...stageQs].sort(() => Math.random() - 0.5);

    const randomizedQs = shuffledQs.map((q, idx) => {
      const qId = `s${stageNum}_q${idx}`;

      // ★ Xáo trộn THỨ TỰ ĐÁP ÁN riêng cho từng người chơi
      const optionsArr = Object.entries(q.options).sort(() => Math.random() - 0.5);
      const choices    = optionsArr.map(([, text], i) => ({ key: letters[i], text }));

      // Tìm đáp án đúng sau khi đã xáo trộn
      const correctText  = q.options[q.answer];
      const correctKey   = choices.find(c => c.text === correctText)?.key || letters[0];

      p._stageAnswers[qId] = { id: qId, text: q.question, choices, correctKey };
      return { id: qId, text: q.question, choices };
    });

    p.lastDelta = 0;
    io.to(p.id).emit('startStage', {
      stageNum, totalStages: TOTAL_STAGES,
      isDouble: isFinalStage,
      questions: randomizedQs,
      timeLimit               // client dùng để hiển thị đồng hồ đúng vòng 5
    });
  });

  // ★ Vòng 5 → 50s | Các vòng khác → 60s
  let timeLeft = timeLimit;
  clearInterval(room.timer);
  room.timer = setInterval(() => {
    io.to('room_' + roomId).emit('timerUpdate', timeLeft);
    timeLeft--;
    if (timeLeft < 0) {
      clearInterval(room.timer);
      startIntermission(roomId);
    }
  }, 1000);
}

// ─── GIẢI LAO GIỮA CÁC VÒNG ────────────────────────────────────────────────
function startIntermission(roomId) {
  const room = rooms[roomId];
  if (!room || room.status === 'intermission') return;
  room.status = 'intermission';
  room.players.forEach(p => (p.submittedCurrentStage = true));

  const { scoreA, scoreB, scoreC } = getScores(room);
  io.to('room_' + roomId).emit('intermissionStart', {
    scoreA, scoreB, scoreC,
    leaderboard: getLeaderboard(room),
    currentStage: room.currentStage,
    totalStages: TOTAL_STAGES
  });

  let timeLeft = INTERMISSION_TIME;
  clearInterval(room.timer);
  room.timer = setInterval(() => {
    io.to('room_' + roomId).emit('timerUpdate', timeLeft);
    timeLeft--;
    if (timeLeft < 0) {
      clearInterval(room.timer);
      const next = room.currentStage + 1;

      if (next > TOTAL_STAGES) {
        // ★ Đã qua vòng 5 → kết thúc (hoặc vòng câu hỏi nhanh nếu có Đội C)
        if (room.teamC) {
          room.status = 'fast_phase_running';
          io.to('room_' + roomId).emit('startFastQuestionPhase', {
            hostName: room.teamC.name, hostId: room.teamC.id
          });
        } else {
          endGameFinal(roomId);
        }
      } else {
        startStage(roomId, next);
      }
    }
  }, 1000);
}

// ─── KẾT THÚC TRẬN ─────────────────────────────────────────────────────────
function endGameFinal(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  const { scoreA, scoreB } = getScores(room);

  room.players.forEach(p => {
    io.to(p.id).emit('gameSummaryReport', p.history);
  });

  io.to('room_' + roomId).emit('gameOver', {
    winningTeam: scoreA === scoreB ? 'Hòa' : (scoreA > scoreB ? 'A' : 'B'),
    scoreA, scoreB,
    topPlayers: getLeaderboard(room).slice(0, 5)
  });
}

// ─── KHỞI ĐỘNG SERVER ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server đang chạy tại port ${PORT}`);
  console.log(`Kho câu hỏi: ${countAllQuestions()} câu (${CHAPTER_KEYS.length} chương) | Mỗi trận dùng ${TOTAL_STAGES * QUESTIONS_PER_STAGE} câu − mỗi vòng đủ nội dung tất cả chương`);
});
