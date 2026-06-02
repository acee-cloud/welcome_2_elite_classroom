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

// ─── CÀI ĐẶT TRẬN ĐẤU ────────────────────────────────────────────────────────
const QUESTIONS_PER_STAGE = 5;
const TIMER_NORMAL        = 50;
const TIMER_FINAL         = 40;
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
    stageTimeLeft: 0,
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
      totalTimeTaken: 0, lastDelta: 0, history: [],
      _lastAnswerTime: 0
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

    player.score = player.score + points;
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

      // Gửi earlyIntermission cho player này: chỉ báo ra sảnh chờ, chưa có đếm ngược
      // Thời gian nghỉ 15s chỉ bắt đầu khi TẤT CẢ player hoàn thành
      const { scoreA: sA, scoreB: sB } = getScores(room);
      socket.emit('earlyIntermission', {
        scoreA: sA, scoreB: sB,
        leaderboard: getLeaderboard(room),
        currentStage: room.currentStage,
        totalStages: room.totalStages
      });
    }

    // Nếu TẤT CẢ player đã xong → bắt đầu giải lao ngay
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
  // Player hoàn thành sớm (submittedCurrentStage=true) hoặc đang trong giải lao đều được chat
  socket.on('sendGlobalMessage', ({ roomId, msg }) => {
    const room = rooms[roomId];
    if (!room || !msg?.trim()) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const canChat = room.status === 'intermission' ||
                    (room.status === 'playing' && player.submittedCurrentStage);
    if (!canChat) return;

    io.to('room_' + roomId).emit('receiveGlobalMessage', {
      name: player.name,
      msg: msg.trim().substring(0, 150),
      team: player.team
    });
  });

  // ── PLAYER: Kết nối lại sau khi mất mạng ──────────────────────────────────────
  socket.on('playerRejoin', ({ roomId, name, avatar, team }) => {
    const rId = (roomId || '').toUpperCase().trim();
    const room = rooms[rId];
    if (!room) return;

    socket.data.roomId = rId;
    socket.join('room_' + rId);

    const player = room.players.find(p => p.name === name && p.team === team);
    if (player) {
      const oldId = player.id;
      player.id = socket.id;
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
      socket.emit('gameStarted', { totalStages: room.totalStages });
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
        totalStages: room.totalStages,
        totalTime: INTERMISSION_TIME
      });
    }
  });

  // ── ADMIN: Reset phòng ────────────────────────────────────────────────────────
  socket.on('adminResetGame', (oldRoomId) => {
    const room = rooms[oldRoomId];
    if (!room) return;

    clearInterval(room.timer);

    const newRoomId = generateRoomId();

    io.to('room_' + oldRoomId).emit('roomResetByAdmin', { newRoomId });
    io.to('admin_' + oldRoomId).emit('roomResetByAdmin', { newRoomId });

    io.in('room_' + oldRoomId).socketsLeave('room_' + oldRoomId);
    io.in('admin_' + oldRoomId).socketsLeave('admin_' + oldRoomId);

    delete rooms[oldRoomId];

    rooms[newRoomId] = createRoomState(newRoomId, socket.id);
    socket.join('room_' + newRoomId);
    socket.join('admin_' + newRoomId);
    socket.data.adminRoomId = newRoomId;

    socket.emit('roomCreated', newRoomId);
  });

  // ── ADMIN: Yêu cầu báo cáo toàn trận ────────────────────────────────────────
  socket.on('adminRequestReport', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    const report = room.players.map(p => ({
      name: p.name,
      team: p.team,
      score: p.score,
      totalTimeTaken: p.totalTimeTaken,
      history: p.history
    }));
    socket.emit('fullReportData', report);
  });

  // ── Ngắt kết nối ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const adminRoomId = socket.data.adminRoomId;
    if (adminRoomId && rooms[adminRoomId] && rooms[adminRoomId].adminSocketId === socket.id) {
      const adminRoom = rooms[adminRoomId];
      clearInterval(adminRoom.timer);
      io.to('room_' + adminRoomId).emit('roomResetByAdmin', { newRoomId: null });
      io.in('room_' + adminRoomId).socketsLeave('room_' + adminRoomId);
      io.in('admin_' + adminRoomId).socketsLeave('admin_' + adminRoomId);
      delete rooms[adminRoomId];
      return;
    }

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

  room.stageTimeLeft = timeLimit;
  let timeLeft = timeLimit;
  clearInterval(room.timer);
  room.timer = setInterval(() => {
    room.stageTimeLeft = timeLeft;
    io.to('room_' + roomId).emit('timerUpdate', timeLeft);
    timeLeft--;
    if (timeLeft < 0) {
      room.stageTimeLeft = 0;
      clearInterval(room.timer);
      startIntermission(roomId);
    }
  }, 1000);
}

// ─── GIẢI LAO / KẾT THÚC VÒNG ────────────────────────────────────────────────
function startIntermission(roomId) {
  const room = rooms[roomId];
  if (!room || room.status === 'intermission' || room.status === 'finished') return;
  room.status = 'intermission';

  // Xử lý câu chưa trả lời → tính như bỏ qua (trừ điểm)
  const isFinalRound = (room.currentStage === room.finalStage);
  room.players.forEach(p => {
    if (!p.submittedCurrentStage) {
      Object.values(p._stageAnswers).forEach(q => {
        if (!q.answered) {
          q.answered = true;
          const pts   = isFinalRound ? -5 : -3;
          p.score     = p.score + pts;
          p.lastDelta = pts;
          p._answeredCount++;
          p.history.push({
            questionText:  q.text,
            choices:       q.choices,
            chosenAnswer:  '(bỏ qua)',
            correctAnswer: q.correctKey,
            isCorrect:     false,
            pointsDelta:   pts,
            skipped:       true
          });
        }
      });
    }
    p.submittedCurrentStage = true;
  });

  const { scoreA, scoreB } = getScores(room);

  io.to('admin_' + roomId).emit('realtimeScoreUpdate', {
    scoreA, scoreB, players: getLeaderboard(room)
  });

  if (room.currentStage >= room.totalStages) {
    endGameFinal(roomId);
    return;
  }

  room.stageTimeLeft = 0;

  // Thời gian nghỉ luôn cố định là INTERMISSION_TIME (không có bonus)
  // Đồng hồ đếm ngược chỉ bắt đầu khi TẤT CẢ player đã hoàn thành (hoặc hết giờ)
  io.to('room_' + roomId).emit('intermissionStart', {
    scoreA, scoreB,
    leaderboard: getLeaderboard(room),
    currentStage: room.currentStage,
    totalStages:  room.totalStages,
    totalTime:    INTERMISSION_TIME
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
function endGameFinal(roomId) {
  const room = rooms[roomId];
  if (!room) return;

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
}

// ─── KHỞI ĐỘNG SERVER ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅  Server đang chạy tại port ${PORT}`);
  console.log(`📚 Kho câu hỏi: ${countAllQuestions()} câu (${CHAPTER_KEYS.length} chương)`);
});
