const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const ExcelJS = require('exceljs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.get('/',       (req, res) => { res.sendFile(path.join(__dirname, 'public', 'player.html')); });
app.get('/admin',  (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin.html')); });
app.get('/player', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'player.html')); });
app.use(express.static(path.join(__dirname, 'public')));

// ─── CÀI ĐẶT TRẬN ĐẤU ────────────────────────────────────────────────────────
const QUESTIONS_PER_STAGE = 5;
const TIMER_NORMAL        = 50;   // Giảm từ 60 → 50s
const TIMER_FINAL         = 40;   // Giảm từ 50 → 40s
const INTERMISSION_TIME   = 15;

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

// ─── CHỌN CÂU HỎI CÂN BẰNG THEO CHƯƠNG ──────────────────────────────────────
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

const rooms = {};

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id;
  do {
    id = '';
    for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms[id]);
  return id;
}

function createRoomState(roomId, adminSocketId) {
  return {
    roomId,
    adminSocketId,
    status: 'lobby',
    currentStage: 0,
    totalStages: 5,
    finalStage: 5,
    players: [],
    teamA: [],
    teamB: [],
    timer: null,
    stageStartTime: 0,
    roundQuestions: []
  };
}

// ─── ĐIỂM TRUNG BÌNH MỖI ĐỘI ─────────────────────────────────────────────────
function getScores(room) {
  const lenA = room.teamA.length || 1;
  const lenB = room.teamB.length || 1;
  const scoreA = parseFloat((room.teamA.reduce((s, p) => s + p.score, 0) / lenA).toFixed(1));
  const scoreB = parseFloat((room.teamB.reduce((s, p) => s + p.score, 0) / lenB).toFixed(1));
  return { scoreA, scoreB };
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

  // ── PLAYER: Xác minh phòng tồn tại ──────────────────────────────────────────
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

  // ── ADMIN: Tạo phòng mới ──────────────────────────────────────────────────────
  socket.on('adminCreateRoom', () => {
    const roomId = generateRoomId();
    rooms[roomId] = createRoomState(roomId, socket.id);
    socket.join('room_' + roomId);
    socket.join('admin_' + roomId);
    socket.data.adminRoomId = roomId;
    socket.emit('roomCreated', roomId);
  });

  // ── PLAYER: Tham gia phòng ────────────────────────────────────────────────────
  socket.on('playerJoinRoom', ({ roomId, name, avatar, email }) => {
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

    // Validate email
    const playerEmail = (email || '').trim().toLowerCase();
    if (!playerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(playerEmail)) {
      return socket.emit('joinError', 'Email không hợp lệ! Vui lòng nhập email đúng định dạng.');
    }

    const playerAvatar = (avatar || 'default_animal');

    const countA = room.teamA.length;
    const countB = room.teamB.length;
    let assignedTeam;
    if (countA < countB)      assignedTeam = 'A';
    else if (countB < countA) assignedTeam = 'B';
    else                      assignedTeam = Math.random() < 0.5 ? 'A' : 'B';

    const player = {
      id: socket.id, name: playerName, avatar: playerAvatar,
      email: playerEmail,
      score: 0, team: assignedTeam,
      submittedCurrentStage: false, _stageAnswers: {}, _answeredCount: 0,
      totalTimeTaken: 0, lastDelta: 0, history: [],
      _lastAnswerTime: 0,
      doneEarly: false   // flag: hoàn thành sớm trước khi hết giờ
    };

    room.players.push(player);
    (assignedTeam === 'A' ? room.teamA : room.teamB).push(player);

    socket.join('room_' + rId);
    socket.data.roomId = rId;

    socket.emit('joinedRoom', { roomId: room.roomId, team: assignedTeam });
    socket.emit('roleAssignment', { team: assignedTeam });

    io.to('room_' + rId).emit('updatePlayerList', room.players.map(p => ({
      id: p.id, name: p.name, avatar: p.avatar, team: p.team
    })));

    io.to('room_' + rId).emit('lobbyUpdate', {
      players: room.players.map(p => ({
        id: p.id, name: p.name,
        avatar: typeof p.avatar === 'object' ? p.avatar.emoji : p.avatar,
        team: p.team, score: p.score
      })),
      totalCount: room.players.length
    });
  });

  // ── ADMIN: Bắt đầu trận (với số vòng tuỳ chọn) ────────────────────────────────
  socket.on('adminStartGame', (data) => {
    const roomId = data.roomId;
    const totalRounds = Math.max(1, Math.min(50, parseInt(data.totalRounds) || 5));

    const room = rooms[roomId];
    if (!room || room.players.length === 0) return;

    room.status = 'playing';
    room.totalStages = totalRounds;
    room.finalStage  = totalRounds;

    room.roundQuestions = pickRoundQuestions(totalRounds);

    io.to('admin_' + roomId).emit('gameStarted', { totalStages: room.totalStages });
    io.to('room_'  + roomId).emit('gameStarted', { totalStages: room.totalStages });

    startStage(roomId, 1);
  });

  // ── PLAYER: Nộp câu trả lời từng câu ──────────────────────────────────────────
  socket.on('submitSingleAnswer', ({ roomId, questionId, answer }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.submittedCurrentStage) return;

    const currentQData = player._stageAnswers[questionId];
    if (!currentQData || currentQData.answered) return;
    currentQData.answered = true;

    const now = Date.now();
    const sinceLastAnswer = (now - (player._lastAnswerTime || room.stageStartTime)) / 1000;
    player._lastAnswerTime = now;
    player.totalTimeTaken += parseFloat(sinceLastAnswer.toFixed(2));

    const isCorrect    = (answer === currentQData.correctKey);
    const isFinalStage = (room.currentStage === room.finalStage);

    const points = isCorrect
      ? (isFinalStage ? 20 : 10)
      : (isFinalStage ? -5 : -3);

    player.score = Math.max(0, player.score + points);
    player.lastDelta = points;

    player.history.push({
      questionText:  currentQData.text,
      choices:       currentQData.choices,
      chosenAnswer:  answer,
      correctAnswer: currentQData.correctKey,
      isCorrect,
      pointsDelta:   points
    });

    player._answeredCount++;

    socket.emit('singleAnswerResult', {
      questionId,
      isCorrect,
      pointsDelta:   points,
      chosenAnswer:  answer,
      correctAnswer: currentQData.correctKey,
      currentScore:  player.score
    });

    const { scoreA, scoreB } = getScores(room);

    io.to('admin_' + roomId).emit('realtimeScoreUpdate', {
      scoreA, scoreB, players: getLeaderboard(room)
    });

    io.to('room_' + roomId).emit('scoreUpdate', {
      playerId:      socket.id,
      personalScore: player.score,
      delta:         points,
      teamScores:    { A: scoreA, B: scoreB }
    });

    const totalQs = Object.keys(player._stageAnswers).length;
    if (player._answeredCount >= totalQs) {
      player.submittedCurrentStage = true;
      player.doneEarly = true;
      // Gửi riêng cho player này để chuyển về màn hình giải lao sớm
      socket.emit('playerDoneEarly', {
        message: 'Bạn đã hoàn thành tất cả câu hỏi! Đang chờ vòng kết thúc...'
      });
    }

    if (room.players.length > 0 && room.players.every(p => p.submittedCurrentStage)) {
      clearInterval(room.timer);
      startIntermission(roomId);
    }
  });

  // ── PLAYER MOVE ───────────────────────────────────────────────────────────────
  socket.on('playerMove', ({ roomId, x, y }) => {
    if (!roomId || !rooms[roomId]) return;
    socket.to('room_' + roomId).emit('playerMoved', { playerId: socket.id, x, y });
  });

  // ── CHAT SẢNH CHỜ ─────────────────────────────────────────────────────────────
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

  // ── CHAT GIẢI LAO ─────────────────────────────────────────────────────────────
  // FIX: chỉ cho chat khi status là 'intermission' (không phải lobby)
  socket.on('sendGlobalMessage', ({ roomId, msg }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'intermission' || !msg?.trim()) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    io.to('room_' + roomId).emit('receiveGlobalMessage', {
      name: player.name,
      msg: msg.trim().substring(0, 150),
      team: player.team
    });
  });

  // ── PLAYER: Kết nối lại sau khi mất mạng ──────────────────────────────────────
  socket.on('playerRejoin', ({ roomId, name, avatar, team, email }) => {
    const rId = (roomId || '').toUpperCase().trim();
    const room = rooms[rId];
    if (!room) return;

    socket.data.roomId = rId;
    socket.join('room_' + rId);

    const player = room.players.find(p => p.name === name && p.team === team);
    if (player) {
      const oldId = player.id;
      player.id = socket.id;
      // Cập nhật email nếu chưa có
      if (email && !player.email) player.email = email.trim().toLowerCase();
      const teamArr = team === 'A' ? room.teamA : room.teamB;
      const tp = teamArr.find(p => p.id === oldId);
      if (tp) tp.id = socket.id;
    }

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
    } else if (room.status === 'playing' && player) {
      // FIX: Gửi lại trạng thái game cho player rejoin
      socket.emit('gameStarted', { totalStages: room.totalStages });
      const letters = ['A', 'B', 'C', 'D'];
      const questionsForPlayer = Object.values(player._stageAnswers).map(q => ({
        id: q.id, text: q.text, choices: q.choices
      }));
      socket.emit('startStage', {
        stageNum: room.currentStage,
        totalStages: room.totalStages,
        isDouble: room.currentStage === room.finalStage,
        questions: questionsForPlayer,
        timeLimit: room.currentStage === room.finalStage ? TIMER_FINAL : TIMER_NORMAL
      });
    } else if (room.status === 'intermission') {
      const { scoreA, scoreB } = getScores(room);
      socket.emit('gameStarted', { totalStages: room.totalStages });
      socket.emit('intermissionStart', {
        scoreA, scoreB,
        leaderboard: getLeaderboard(room),
        currentStage: room.currentStage,
        totalStages: room.totalStages
      });
    }
  });

  // ── ADMIN: Reset phòng ────────────────────────────────────────────────────────
  // FIX: Tạo roomId MỚI, kick tất cả player khỏi phòng cũ, xóa phòng cũ
  socket.on('adminResetGame', (oldRoomId) => {
    const room = rooms[oldRoomId];
    if (!room) return;

    // Dừng timer
    clearInterval(room.timer);

    // Tạo roomId mới
    const newRoomId = generateRoomId();

    // Thông báo tất cả player (bao gồm cả admin nếu ở trong room_) phải thoát
    // Gửi newRoomId để client biết (admin dùng để tạo QR mới)
    io.to('room_' + oldRoomId).emit('roomResetByAdmin', { newRoomId });
    io.to('admin_' + oldRoomId).emit('roomResetByAdmin', { newRoomId });

    // Kick tất cả socket khỏi các socket rooms cũ
    io.in('room_' + oldRoomId).socketsLeave('room_' + oldRoomId);
    io.in('admin_' + oldRoomId).socketsLeave('admin_' + oldRoomId);

    // Xóa phòng cũ
    delete rooms[oldRoomId];

    // Tạo phòng mới với roomId mới và cho admin vào
    rooms[newRoomId] = createRoomState(newRoomId, socket.id);
    socket.join('room_' + newRoomId);
    socket.join('admin_' + newRoomId);
    socket.data.adminRoomId = newRoomId;

    // Gửi thông tin phòng mới cho admin
    socket.emit('roomCreated', newRoomId);
  });

  // ── Ngắt kết nối ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    // ── Xử lý khi ADMIN ngắt kết nối (reload trang / đóng tab) ─────────────
    const adminRoomId = socket.data.adminRoomId;
    if (adminRoomId && rooms[adminRoomId] && rooms[adminRoomId].adminSocketId === socket.id) {
      const adminRoom = rooms[adminRoomId];
      clearInterval(adminRoom.timer);
      // Thông báo tất cả player bị kick vì admin rời phòng
      io.to('room_' + adminRoomId).emit('roomResetByAdmin', { newRoomId: null });
      // Kick tất cả socket khỏi room
      io.in('room_' + adminRoomId).socketsLeave('room_' + adminRoomId);
      io.in('admin_' + adminRoomId).socketsLeave('admin_' + adminRoomId);
      // Xóa phòng khỏi bộ nhớ
      delete rooms[adminRoomId];
      return; // Không cần xử lý player bên dưới vì phòng đã bị xóa
    }

    // ── Xử lý khi PLAYER ngắt kết nối ───────────────────────────────────────
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];
    room.players = room.players.filter(p => p.id !== socket.id);
    room.teamA   = room.teamA.filter(p => p.id !== socket.id);
    room.teamB   = room.teamB.filter(p => p.id !== socket.id);

    io.to('room_' + roomId).emit('updatePlayerList', room.players.map(p => ({
      id: p.id, name: p.name, avatar: p.avatar, team: p.team
    })));

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

// ─── BẮT ĐẦU VÒNG ─────────────────────────────────────────────────────────────
function startStage(roomId, stageNum) {
  const room = rooms[roomId];
  if (!room) return;

  if (!room.roundQuestions[stageNum - 1]) {
    console.error(`[ERROR] Vòng ${stageNum} không có câu hỏi! Kết thúc game sớm.`);
    endGameFinal(roomId);
    return;
  }

  room.status         = 'playing';
  room.currentStage   = stageNum;
  room.stageStartTime = Date.now();

  const isFinalStage = (stageNum === room.finalStage);
  const timeLimit    = isFinalStage ? TIMER_FINAL : TIMER_NORMAL;
  const letters      = ['A', 'B', 'C', 'D'];
  const stageQs      = room.roundQuestions[stageNum - 1];

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
    p._lastAnswerTime       = Date.now();
    p.doneEarly             = false;

    const shuffledQs   = [...stageQs].sort(() => Math.random() - 0.5);
    const randomizedQs = shuffledQs.map((q, idx) => {
      const qId = `s${stageNum}_q${idx}`;

      const optionsArr = Object.entries(q.options).sort(() => Math.random() - 0.5);
      const choices    = optionsArr.map(([, text], i) => ({ key: letters[i], text }));

      const correctText = q.options[q.answer];
      const correctKey  = choices.find(c => c.text === correctText)?.key || letters[0];

      p._stageAnswers[qId] = { id: qId, text: q.question, choices, correctKey, answered: false };
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

// ─── GIẢI LAO / KẾT THÚC VÒNG ────────────────────────────────────────────────
function startIntermission(roomId) {
  const room = rooms[roomId];
  // FIX: Guard chống double-call (cả 'intermission' lẫn 'finished')
  if (!room || room.status === 'intermission' || room.status === 'finished') return;
  room.status = 'intermission';

  const isFinalStage = (room.currentStage === room.finalStage);

  // Xử lý các câu hỏi chưa trả lời: tính như câu sai và trừ điểm
  room.players.forEach(p => {
    if (!p.submittedCurrentStage) {
      // Duyệt qua các câu chưa trả lời
      Object.values(p._stageAnswers).forEach(qData => {
        if (!qData.answered) {
          qData.answered = true;
          const penaltyPoints = isFinalStage ? -5 : -3;
          p.score = Math.max(0, p.score + penaltyPoints);
          p.lastDelta = penaltyPoints;

          // Thêm vào history với flag skipped
          p.history.push({
            questionText:  qData.text,
            choices:       qData.choices,
            chosenAnswer:  null,
            correctAnswer: qData.correctKey,
            isCorrect:     false,
            pointsDelta:   penaltyPoints,
            skipped:       true
          });
        }
      });
      p.submittedCurrentStage = true;
    }
    p.doneEarly = false;  // reset cho vòng tiếp theo
  });

  const { scoreA, scoreB } = getScores(room);

  // Gửi cập nhật điểm realtime cho admin sau khi xử lý câu bỏ qua
  io.to('admin_' + roomId).emit('realtimeScoreUpdate', {
    scoreA, scoreB, players: getLeaderboard(room)
  });

  if (room.currentStage >= room.totalStages) {
    endGameFinal(roomId);
    return;
  }

  io.to('room_' + roomId).emit('intermissionStart', {
    scoreA, scoreB,
    leaderboard: getLeaderboard(room),
    currentStage: room.currentStage,
    totalStages:  room.totalStages
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

// ─── KẾT THÚC TRẬN ───────────────────────────────────────────────────────────
async function endGameFinal(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  // FIX: Đặt status 'finished' trước để tránh gọi lại
  room.status = 'finished';

  const { scoreA, scoreB } = getScores(room);

  room.players.forEach(p => {
    io.to(p.id).emit('gameSummaryReport', p.history);
  });

  io.to('room_' + roomId).emit('gameOver', {
    winningTeam: scoreA === scoreB ? 'Hòa' : (scoreA > scoreB ? 'A' : 'B'),
    scoreA, scoreB,
    topPlayers: getLeaderboard(room).slice(0, 5)
  });

  // ── TẠO FILE EXCEL KẾT QUẢ ────────────────────────────────────────────────
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PhysicsGame';
    workbook.created = new Date();

    // ── Sheet 1: Bảng xếp hạng tổng ──────────────────────────────────────────
    const sheetRanking = workbook.addWorksheet('Bảng Xếp Hạng', {
      pageSetup: { fitToPage: true, fitToWidth: 1 }
    });
    sheetRanking.columns = [
      { header: 'Hạng',        key: 'rank',       width: 8  },
      { header: 'Tên',         key: 'name',        width: 22 },
      { header: 'Email',       key: 'email',       width: 30 },
      { header: 'Đội',         key: 'team',        width: 8  },
      { header: 'Điểm',        key: 'score',       width: 10 },
      { header: 'Thời gian (s)',key: 'time',        width: 14 },
    ];

    // Style header
    sheetRanking.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });

    const lb = getLeaderboard(room);
    lb.forEach((p, i) => {
      const row = sheetRanking.addRow({
        rank:  i + 1,
        name:  p.name,
        email: room.players.find(pl => pl.name === p.name)?.email || '',
        team:  `Đội ${p.team}`,
        score: p.score,
        time:  parseFloat(p.totalTimeTaken.toFixed(1))
      });
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle' };
      });
      // Màu theo đội
      const teamColor = p.team === 'A' ? 'FFFFE0E0' : 'FFE0F4FF';
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: teamColor } };
      });
    });

    // ── Sheet 2+: Chi tiết từng player ───────────────────────────────────────
    // Tạo 1 sheet tổng hợp chi tiết
    const sheetDetail = workbook.addWorksheet('Chi Tiết Câu Hỏi', {
      pageSetup: { fitToPage: true, fitToWidth: 1 }
    });
    sheetDetail.columns = [
      { header: 'Tên',              key: 'name',      width: 22 },
      { header: 'Email',            key: 'email',     width: 30 },
      { header: 'Đội',              key: 'team',      width: 8  },
      { header: 'STT Câu',          key: 'qNum',      width: 10 },
      { header: 'Nội dung câu hỏi', key: 'question',  width: 50 },
      { header: 'Đáp án đúng',      key: 'correct',   width: 20 },
      { header: 'Học sinh chọn',    key: 'chosen',    width: 20 },
      { header: 'Kết quả',          key: 'result',    width: 14 },
      { header: 'Điểm +/-',         key: 'points',    width: 10 },
      { header: 'Ghi chú',          key: 'note',      width: 18 },
    ];

    // Style header
    sheetDetail.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });

    // Sắp xếp player theo đội rồi theo tên
    const sortedPlayers = [...room.players].sort((a, b) => {
      if (a.team !== b.team) return a.team.localeCompare(b.team);
      return a.name.localeCompare(b.name);
    });

    sortedPlayers.forEach(p => {
      p.history.forEach((h, idx) => {
        const isSkipped = h.skipped || (h.chosenAnswer === null || h.chosenAnswer === undefined);
        // Tìm text đáp án đúng và câu đã chọn
        const correctChoice = (h.choices || []).find(c => c.key === h.correctAnswer);
        const correctText   = correctChoice ? `${h.correctAnswer}. ${correctChoice.text}` : (h.correctAnswer || '');
        let chosenText = '(bỏ qua)';
        if (!isSkipped && h.chosenAnswer) {
          const chosenChoice = (h.choices || []).find(c => c.key === h.chosenAnswer);
          chosenText = chosenChoice ? `${h.chosenAnswer}. ${chosenChoice.text}` : h.chosenAnswer;
        }

        const row = sheetDetail.addRow({
          name:     p.name,
          email:    p.email || '',
          team:     `Đội ${p.team}`,
          qNum:     idx + 1,
          question: h.questionText || '',
          correct:  correctText,
          chosen:   chosenText,
          result:   isSkipped ? 'Bỏ qua' : (h.isCorrect ? 'Đúng' : 'Sai'),
          points:   h.pointsDelta !== undefined ? h.pointsDelta : (h.isCorrect ? 10 : -3),
          note:     isSkipped ? '⚠ Hết giờ / Bỏ qua' : ''
        });

        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
          };
          cell.alignment = { vertical: 'middle', wrapText: true };
        });

        // Màu nền theo kết quả
        let bgColor = 'FFFFFFFF';
        if (isSkipped)      bgColor = 'FFFFF0CC';   // vàng nhạt – bỏ qua
        else if (h.isCorrect) bgColor = 'FFE6FFEE'; // xanh nhạt – đúng
        else                bgColor = 'FFFFE6E6';   // đỏ nhạt – sai

        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        });
      });
    });

    // Tạo buffer và gửi cho admin
    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = buffer.toString('base64');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `KetQua_PhysicsGame_${roomId}_${timestamp}.xlsx`;

    io.to('admin_' + roomId).emit('gameResultExcel', {
      filename,
      data: base64
    });

  } catch (err) {
    console.error('[Excel] Lỗi khi tạo file Excel:', err);
  }
}

// ─── KHỞI ĐỘNG SERVER ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅  Server đang chạy tại port ${PORT}`);
  console.log(`📚 Kho câu hỏi: ${countAllQuestions()} câu (${CHAPTER_KEYS.length} chương)`);
});
