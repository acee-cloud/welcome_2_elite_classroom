const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.get('/',       (req, res) => { res.sendFile(path.join(__dirname, 'public', 'player.html')); });
app.get('/admin',  (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin.html')); });
app.get('/player', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'player.html')); });

app.use(express.static(path.join(__dirname, 'public')));
// ─────────────────────────────────────────────────────────────────────────────

// ─── CÀI ĐẶT TRẬN ĐẤU ─────────────────────────────────────────────────────
const TOTAL_STAGES        = 5;   // Tổng số vòng
const QUESTIONS_PER_STAGE = 5;   // Số câu mỗi vòng
const FINAL_STAGE         = 5;   // Vòng cuối: nhân đôi điểm + thời gian 50s
const TIMER_NORMAL        = 60;  // Giây cho vòng thường
const TIMER_FINAL         = 50;  // Giây cho vòng 5 (rút ngắn)
const INTERMISSION_TIME   = 15;  // Giây nghỉ giải lao
// ──────────────────────────────────────────────────────────────────────────────

// Tải toàn bộ kho câu hỏi một lần khi server khởi động
const questionsData = require('./data/questions.js');

const CHAPTER_KEYS = ['chapter1', 'chapter2', 'chapter3', 'chapter4'];

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
function pickRoundQuestions(totalRounds = 5) {
  const pools = CHAPTER_KEYS
    .map(key => {
      const chapter = questionsData[key];
      if (!chapter) return [];
      const qs = [];
      chapter.stages.forEach(stageArr => {
        stageArr.forEach(q => qs.push({ ...q }));
      });
      return qs.sort(() => Math.random() - 0.5);
    })
    .filter(pool => pool.length > 0);

  if (!pools.length) return [];

  const numChapters = pools.length;
  const pointers    = new Array(numChapters).fill(0);

  const getNext = (ci) => {
    const pool = pools[ci];
    if (!pool.length) return null;
    const q = pool[pointers[ci] % pool.length];
    pointers[ci]++;
    return q;
  };

  const base  = Math.floor(QUESTIONS_PER_STAGE / numChapters);
  const extra = QUESTIONS_PER_STAGE % numChapters;

  const rounds = [];
  for (let r = 0; r < totalRounds; r++) {
    const roundQs = [];
    const chapterOrder = [...Array(numChapters).keys()].sort(() => Math.random() - 0.5);

    chapterOrder.forEach((ci, orderIdx) => {
      const count = base + (orderIdx < extra ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const q = getNext(ci);
        if (q) roundQs.push(q);
      }
    });

    rounds.push(roundQs.sort(() => Math.random() - 0.5));
  }

  return rounds;
}
// ─────────────────────────────────────────────────────────────────────────────

const rooms = {};

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function createRoomState(roomId, adminSocketId) {
  return {
    roomId,
    adminSocketId,
    status: 'lobby',
    currentStage: 0,
    totalStages: 5,  // Sẽ được cập nhật khi Admin bấm Bắt đầu
    finalStage: 5,   // Sẽ được cập nhật khi Admin bấm Bắt đầu
    players: [],
    teamA: [],
    teamB: [],
    teamC: null,
    bonusTeamA: 0,
    bonusTeamB: 0,
    timer: null,
    stageStartTime: 0,
    roundQuestions: [] // Chờ Admin nhập số vòng rồi mới bốc câu hỏi
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

  // ── PLAYER: Xác minh phòng tồn tại (bước 1 nhập mã phòng) ─────────────────
  socket.on('verifyRoom', (roomId, callback) => {
    const rId = (roomId || '').toUpperCase().trim();
    const room = rooms[rId];
    if (typeof callback !== 'function') return;
    if (!room) {
      return callback({ success: false, message: 'Phòng không tồn tại! Kiểm tra lại mã phòng.' });
    }
    if (room.status !== 'lobby') {
      return callback({ success: false, message: 'Trận đấu đã bắt đầu, không thể vào phòng!' });
    }
    callback({ success: true, roomId: rId });
  });

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
    if (!room) {
      return socket.emit('joinError', 'Phòng không tồn tại! Kiểm tra lại mã phòng.');
    }
    if (room.status !== 'lobby') {
      return socket.emit('joinError', 'Trận đấu đã bắt đầu, không thể vào phòng!');
    }
    const playerName = (name || '').trim().substring(0, 20);
    if (!playerName) return socket.emit('joinError', 'Tên không hợp lệ!');

    const playerAvatar = (avatar || 'default_animal');

    // ✅ Chia đội cân bằng tự động
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

    // ✅ Gửi joinedRoom với thông tin đội ngay lập tức (không cần roleAssignment riêng)
    socket.emit('joinedRoom', { roomId: room.roomId, team: assignedTeam });

    // ✅ Gửi roleAssignment ngay sau joinedRoom để player hiển thị đội
    socket.emit('roleAssignment', { team: assignedTeam });

    io.to('room_' + rId).emit('updatePlayerList', room.players.map(p => ({
      id: p.id, name: p.name, avatar: p.avatar, team: p.team
    })));

    // ✅ Cập nhật lobby cho tất cả player trong phòng (hiển thị sảnh chờ)
    io.to('room_' + rId).emit('lobbyUpdate', {
      players: room.players.map(p => ({
        id: p.id, name: p.name, avatar: typeof p.avatar === 'object' ? p.avatar.emoji : p.avatar,
        team: p.team, score: p.score
      })),
      totalCount: room.players.length
    });
  });

  // ── ADMIN: Bắt đầu trận ────────────────────────────────────────────────────
  socket.on('adminStartGame', (data) => {
    const roomId = data.roomId;
    const totalRounds = data.totalRounds || 5; // Lấy số vòng từ Admin, mặc định là 5 nếu lỗi
    
    const room = rooms[roomId];
    if (!room || room.players.length === 0) return;

    // Cập nhật số vòng chơi vào trạng thái phòng
    room.status = 'playing';
    room.totalStages = totalRounds;
    room.finalStage = totalRounds; 
    
    // Bây giờ mới bốc câu hỏi theo đúng số vòng Admin yêu cầu
    room.roundQuestions = pickRoundQuestions(totalRounds);

    io.to('admin_' + roomId).emit('gameStarted', { totalStages: room.totalStages });
    io.to('room_' + roomId).emit('gameStarted', { totalStages: room.totalStages });

    startStage(roomId, 1);
  });
  
  // ── PLAYER: Nộp câu trả lời từng câu ───────────────────────────────────────
  socket.on('submitSingleAnswer', ({ roomId, questionId, answer }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.submittedCurrentStage) return;

    const currentQData = player._stageAnswers[questionId];
    if (!currentQData) return;

    const timeTakenForThisQ = (Date.now() - room.stageStartTime) / 1000;
    player.totalTimeTaken += parseFloat(timeTakenForThisQ.toFixed(2));

    const isCorrect = (answer === currentQData.correctKey);

    const isFinalStage = (room.currentStage === room.finalStage);
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
      questionId,
      isCorrect,
      pointsDelta: points,                          // số nguyên (có dấu)
      chosenAnswer: answer,                         // phím player đã chọn
      correctAnswer: currentQData.correctKey,       // phím đúng
      currentScore: player.score
    });

    const { scoreA, scoreB, scoreC } = getScores(room);
    io.to('admin_' + roomId).emit('realtimeScoreUpdate', {
      scoreA, scoreB, scoreC, players: getLeaderboard(room)
    });

    // Cập nhật điểm real-time cho tất cả player trong phòng
    io.to('room_' + roomId).emit('scoreUpdate', {
      playerId: socket.id,
      personalScore: player.score,
      delta: points,
      teamScores: { A: scoreA, B: scoreB }
    });

    const totalQs = Object.keys(player._stageAnswers).length;
    if (player._answeredCount >= totalQs) {
      player.submittedCurrentStage = true;
    }

    if (room.players.length > 0 && room.players.every(p => p.submittedCurrentStage)) {
      clearInterval(room.timer);
      startIntermission(roomId);
    }
  });

  // ── PHÒNG CHAT (LOBBY) ──────────────────────────────────────────────────────
  socket.on('sendLobbyMessage', ({ roomId, msg }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'lobby' || !msg?.trim()) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    io.to('room_' + roomId).emit('receiveLobbyMessage', {
      name: player.name,
      msg: msg.trim().substring(0, 150),
      team: player.team
    });
  });

  // ── PHÒNG CHAT (GIẢI LAO) ─────────────────────────────────────────────────
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

  // ── PLAYER: Kết nối lại sau khi mất mạng ───────────────────────────────────
  socket.on('playerRejoin', ({ roomId, name, avatar, team }) => {
    const rId = (roomId || '').toUpperCase().trim();
    const room = rooms[rId];
    if (!room) return;

    socket.data.roomId = rId;
    socket.join('room_' + rId);

    // Tìm player theo tên+đội và cập nhật socket.id mới
    const player = room.players.find(p => p.name === name && p.team === team);
    if (player) {
      const oldId = player.id;
      player.id = socket.id;
      const teamArr = team === 'A' ? room.teamA : room.teamB;
      const tp = teamArr.find(p => p.id === oldId);
      if (tp) tp.id = socket.id;
    }

    // Cập nhật lại lobby nếu còn đang chờ
    if (room.status === 'lobby') {
      socket.emit('joinedRoom', { roomId: rId, team });
      socket.emit('roleAssignment', { team });
      io.to('room_' + rId).emit('lobbyUpdate', {
        players: room.players.map(p => ({
          id: p.id, name: p.name,
          avatar: typeof p.avatar === 'object' ? p.avatar.emoji : p.avatar,
          team: p.team, score: p.score
        })),
        totalCount: room.players.length
      });
      io.to('room_' + rId).emit('updatePlayerList', room.players.map(p => ({
        id: p.id, name: p.name, avatar: p.avatar, team: p.team
      })));
    }
  });

  // ── ADMIN: Reset phòng ─────────────────────────────────────────────────────
  socket.on('adminResetGame', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    clearInterval(room.timer);
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

    // Cập nhật sảnh chờ cho player còn lại
    if (room.status === 'lobby') {
      io.to('room_' + roomId).emit('lobbyUpdate', {
        players: room.players.map(p => ({
          id: p.id, name: p.name,
          avatar: typeof p.avatar === 'object' ? p.avatar.emoji : p.avatar,
          team: p.team, score: p.score
        })),
        totalCount: room.players.length
      });
    }

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

  const isFinalStage = (stageNum === room.finalStage);
  const timeLimit    = isFinalStage ? TIMER_FINAL : TIMER_NORMAL;
  const letters      = ['A', 'B', 'C', 'D'];

  const stageQs = room.roundQuestions[stageNum - 1];

  io.to('admin_' + roomId).emit('stageUpdate', {
    stageNum, totalStages: room.totalStages,
    isDouble: isFinalStage,
    questionCount: QUESTIONS_PER_STAGE,
    timeLimit
  });

  room.players.forEach(p => {
    p.submittedCurrentStage = false;
    p._answeredCount        = 0;
    p._stageAnswers         = {};

    const shuffledQs = [...stageQs].sort(() => Math.random() - 0.5);

    const randomizedQs = shuffledQs.map((q, idx) => {
      const qId = `s${stageNum}_q${idx}`;

      const optionsArr = Object.entries(q.options).sort(() => Math.random() - 0.5);
      const choices    = optionsArr.map(([, text], i) => ({ key: letters[i], text }));

      const correctText  = q.options[q.answer];
      const correctKey   = choices.find(c => c.text === correctText)?.key || letters[0];

      p._stageAnswers[qId] = { id: qId, text: q.question, choices, correctKey };
      return { id: qId, text: q.question, choices };
    });

    p.lastDelta = 0;
    io.to(p.id).emit('startStage', {
      stageNum, totalStages: room.totalStages,
      isDouble: isFinalStage,
      questions: randomizedQs,
      timeLimit
    });
  });

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

// ─── GIẢI LAO / KẾT THÚC VÒNG ───────────────────────────────────────────────
function startIntermission(roomId) {
  const room = rooms[roomId];
  if (!room || room.status === 'intermission') return;
  room.status = 'intermission';
  room.players.forEach(p => (p.submittedCurrentStage = true));

  const { scoreA, scoreB, scoreC } = getScores(room);

  // ✅ Nếu vừa xong vòng cuối → kết thúc game ngay, KHÔNG giải lao
  if (room.currentStage >= room.totalStages) {
    endGameFinal(roomId);
    return;
  }

  io.to('room_' + roomId).emit('intermissionStart', {
    scoreA, scoreB, scoreC,
    leaderboard: getLeaderboard(room),
    currentStage: room.currentStage,
    totalStages: room.totalStages
  });

  let timeLeft = INTERMISSION_TIME;
  clearInterval(room.timer);
  room.timer = setInterval(() => {
    io.to('room_' + roomId).emit('timerUpdate', timeLeft);
    timeLeft--;
    if (timeLeft < 0) {
      clearInterval(room.timer);
      startStage(roomId, room.currentStage + 1);
    }
  }, 1000);
}

// ─── KẾT THÚC TRẬN ─────────────────────────────────────────────────────────
function endGameFinal(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  const { scoreA, scoreB } = getScores(room);

  room.status = 'finished';

  room.players.forEach(p => {
    io.to(p.id).emit('gameSummaryReport', p.history);
  });

  io.to('room_' + roomId).emit('gameOver', {
    winningTeam: scoreA === scoreB ? 'Hòa' : (scoreA > scoreB ? 'A' : 'B'),
    scoreA, scoreB,
    topPlayers: getLeaderboard(room).slice(0, 5)
  });
  // Admin đã ở trong room_ channel nên nhận được gameOver ở trên rồi,
  // không cần emit riêng cho admin_ để tránh kích hoạt handler 2 lần.
}

// ─── KHỞI ĐỘNG SERVER ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại port ${PORT}`);
  console.log(`📚 Kho câu hỏi: ${countAllQuestions()} câu (${CHAPTER_KEYS.length} chương) | Mỗi trận dùng ${TOTAL_STAGES * QUESTIONS_PER_STAGE} câu`);
});
