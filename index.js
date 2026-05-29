const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Route admin và player
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

// Load ngân hàng câu hỏi
const questionsData = require('./data/questions.js');

// Gộp câu hỏi từ 4 chương thành mảng phẳng
function buildFlatQuestions(data) {
  const flat = [];
  const chapterKeys = ['chapter1', 'chapter2', 'chapter3', 'chapter4'];
  chapterKeys.forEach((key, chIdx) => {
    const chapter = data[key];
    if (!chapter) return;
    chapter.stages.forEach((stageArr, sIdx) => {
      const globalStage = chIdx * 10 + sIdx + 1;
      stageArr.forEach(q => flat.push({ ...q, stage: globalStage }));
    });
  });
  return flat;
}

const allQuestions = buildFlatQuestions(questionsData);
const keyQuestions = questionsData.keyQuestions || [];

// =====================
// Room Management
// =====================
const rooms = {}; // roomId -> gameState

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function createRoom() {
  let roomId;
  do { roomId = generateRoomId(); } while (rooms[roomId]);

  rooms[roomId] = {
    roomId,
    adminSocketId: null,
    status: 'lobby',
    currentStage: 0,
    players: [],
    teamA: [],
    teamB: [],
    spy: null,
    secretFund: 0,
    timer: null,
    currentKeyQuestion: null,
    keyAnswers: {},
    spyVotes: {},
  };
  return roomId;
}

function getRoom(roomId) {
  return rooms[roomId] || null;
}

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getScores(room) {
  const scoreA = room.teamA.reduce((s, p) => s + p.score, 0);
  const scoreB = room.teamB.reduce((s, p) => s + p.score, 0);
  return { scoreA, scoreB };
}

function getLeaderboard(room) {
  return [...room.players]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score, team: p.team }));
}

// =====================
// Socket.IO
// =====================
io.on('connection', (socket) => {

  // ── ADMIN: tạo phòng ──
  socket.on('adminCreateRoom', () => {
    const roomId = createRoom();
    const room = getRoom(roomId);
    room.adminSocketId = socket.id;
    socket.join('room_' + roomId);
    socket.join('admin_' + roomId);
    socket.emit('roomCreated', roomId);
  });

  // ── PLAYER: join phòng ──
  socket.on('playerJoinRoom', ({ roomId, name }) => {
    const room = getRoom(roomId);
    if (!room) { socket.emit('errorMsg', 'Phòng không tồn tại!'); return; }
    if (room.status !== 'lobby') { socket.emit('errorMsg', 'Phòng đã khóa!'); return; }

    const playerName = (name || '').trim().substring(0, 20);
    if (!playerName) { socket.emit('errorMsg', 'Tên không hợp lệ!'); return; }

    const player = {
      id: socket.id,
      name: playerName,
      score: 0,
      role: 'normal',
      team: null,
      submittedCurrentStage: false,
    };
    room.players.push(player);
    socket.join('room_' + roomId);
    socket.data.roomId = roomId;

    // Thông báo danh sách player cho admin
    io.to('admin_' + roomId).emit('updatePlayerList', room.players);
    socket.emit('joinedRoom', { roomId });
  });

  // ── ADMIN: bắt đầu game ──
  socket.on('adminStartGame', (roomId) => {
    const room = getRoom(roomId);
    if (!room || room.players.length === 0) return;

    room.status = 'playing';
    room.currentStage = 1;
    room.teamA = [];
    room.teamB = [];
    room.spy = null;
    room.secretFund = 0;

    if (room.players.length === 1) {
      room.players[0].team = 'solo';
      io.to(room.players[0].id).emit('roleAssignment', { team: 'solo', isSpy: false });
    } else {
      let shuffled = shuffle([...room.players]);
      if (shuffled.length % 2 !== 0) {
        const spy = shuffled.pop();
        spy.role = 'spy';
        spy.team = 'A';
        room.spy = spy;
        room.teamA.push(spy);
      }
      const half = Math.floor(shuffled.length / 2);
      shuffled.slice(0, half).forEach(p => { p.team = 'A'; room.teamA.push(p); });
      shuffled.slice(half).forEach(p => { p.team = 'B'; room.teamB.push(p); });
      room.players = [...room.teamA, ...room.teamB];

      room.players.forEach(p => {
        io.to(p.id).emit('roleAssignment', { team: p.team, isSpy: p.role === 'spy' });
      });
    }

    // Thông báo cho admin biết game đã bắt đầu
    io.to('admin_' + roomId).emit('gameStarted');
    startStage(roomId, 1);
  });

  // ── PLAYER: nộp bài ──
  socket.on('submitAnswers', ({ roomId, answers }) => {
    const room = getRoom(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.submittedCurrentStage) return;
    player.submittedCurrentStage = true;

    // Tính điểm: dùng _stageAnswers của player (đáp án đã xáo trộn riêng từng người)
    const stageAnswers = player._stageAnswers || {};
    let correct = 0, wrong = 0;

    Object.keys(stageAnswers).forEach(qId => {
      const submitted = answers[qId];
      if (!submitted) return; // bỏ trống không trừ điểm
      if (submitted === stageAnswers[qId]) correct++;
      else wrong++;
    });

    const multiplier = (room.currentStage === 5) ? 2 : 1;
    const earned = (correct * 10 - wrong * 2) * multiplier;
    player.score += Math.max(0, earned);
    if (player.role === 'spy') room.secretFund += Math.max(0, earned);

    const total = Object.keys(stageAnswers).length;
    socket.emit('earlyResult', { correct, total });

    // Kiểm tra tất cả đã nộp chưa
    if (room.players.every(p => p.submittedCurrentStage)) {
      clearInterval(room.timer);
      startIntermission(roomId);
    }
  });

  // ── CHAT ──
  socket.on('sendTeamMessage', ({ roomId, msg }) => {
    const room = getRoom(roomId);
    if (!room || !msg || !msg.trim()) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    const data = { name: player.name, msg: msg.trim().substring(0, 200) };
    room.players
      .filter(p => p.team === player.team)
      .forEach(p => io.to(p.id).emit('receiveTeamMessage', data));
  });

  socket.on('sendGlobalMessage', ({ roomId, msg }) => {
    const room = getRoom(roomId);
    if (!room || !msg || !msg.trim()) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || room.status !== 'intermission') return;
    const data = { name: player.name, msg: msg.trim().substring(0, 200) };
    io.to('room_' + roomId).emit('receiveGlobalMessage', data);
  });

  // ── FINAL: câu hỏi chìa khóa ──
  socket.on('submitKeyAnswer', ({ roomId, answer }) => {
    const room = getRoom(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.team !== 'B') return;
    room.keyAnswers[socket.id] = answer;
  });

  // ── FINAL: vote gián điệp ──
  socket.on('submitSpyVote', ({ roomId, votedPlayerId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    const voter = room.players.find(p => p.id === socket.id);
    if (!voter || voter.team !== 'A') return;
    room.spyVotes[socket.id] = votedPlayerId;
  });

  // ── RESET ──
  socket.on('resetGame', (roomId) => {
    const room = getRoom(roomId);
    if (!room) return;
    clearInterval(room.timer);
    delete rooms[roomId];
    io.to('room_' + roomId).emit('gameReset');
  });

  // ── DISCONNECT ──
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);
    room.teamA   = room.teamA.filter(p => p.id !== socket.id);
    room.teamB   = room.teamB.filter(p => p.id !== socket.id);
    if (room.spy && room.spy.id === socket.id) room.spy = null;
    if (room.status === 'lobby') {
      io.to('admin_' + roomId).emit('updatePlayerList', room.players);
    }
  });
});

// =====================
// Game flow
// =====================
function startStage(roomId, stageNum) {
  const room = getRoom(roomId);
  if (!room) return;

  room.status = 'playing';
  room.currentStage = stageNum;
  room.players.forEach(p => { p.submittedCurrentStage = false; });

  const stageQs = allQuestions.filter(q => q.stage === stageNum);
  const letters = ['A', 'B', 'C', 'D'];

  // Gắn id cho từng câu hỏi trong stage
  stageQs.forEach((q, i) => { q._id = `s${stageNum}_${i}`; });

  // Thông báo admin
  io.to('admin_' + roomId).emit('stageUpdate', {
    stageNum,
    isDouble: stageNum === 5,
    teamA_score: getScores(room).scoreA,
    teamB_score: getScores(room).scoreB,
  });

  // Gửi câu hỏi cho từng player (shuffle riêng, đảo đáp án)
  room.players.forEach(p => {
    const personalQs = shuffle([...stageQs]).map(q => {
      const entries = shuffle(Object.entries(q.options));
      const newOptions = {};
      let newAnswer = '';
      entries.forEach(([origKey, val], i) => {
        newOptions[letters[i]] = val;
        if (origKey === q.answer) newAnswer = letters[i];
      });
      return {
        id: q._id,
        text: q.question,
        choices: entries.map(([origKey, val], i) => ({ key: letters[i], text: val })),
        _answer: newAnswer, // Không gửi cho client, chỉ dùng server-side
      };
    });

    // Lưu đáp án đúng vào server để chấm điểm
    p._stageAnswers = {};
    personalQs.forEach(q => {
      p._stageAnswers[q.id] = q._answer;
      delete q._answer; // Xóa trước khi gửi xuống client
    });

    io.to(p.id).emit('startStage', {
      stageNum,
      isDouble: stageNum === 5,
      questions: personalQs,
    });
  });

  // Timer 90 giây
  let timeLeft = 90;
  room.timer = setInterval(() => {
    io.to('room_' + roomId).emit('timerUpdate', timeLeft);
    timeLeft--;
    if (timeLeft < 0) {
      clearInterval(room.timer);
      startIntermission(roomId);
    }
  }, 1000);
}

function startIntermission(roomId) {
  const room = getRoom(roomId);
  if (!room || room.status === 'intermission') return;
  room.status = 'intermission';
  room.players.forEach(p => { p.submittedCurrentStage = true; });

  const { scoreA, scoreB } = getScores(room);
  const leaderboard = getLeaderboard(room);

  io.to('room_' + roomId).emit('intermissionStart', {
    teamA_score: scoreA,
    teamB_score: scoreB,
    leaderboard,
  });

  let timeLeft = 15;
  room.timer = setInterval(() => {
    io.to('room_' + roomId).emit('timerUpdate', timeLeft);
    timeLeft--;
    if (timeLeft < 0) {
      clearInterval(room.timer);
      const next = room.currentStage + 1;
      if (next > 10) startEndgame(roomId);
      else startStage(roomId, next);
    }
  }, 1000);
}

function startEndgame(roomId) {
  const room = getRoom(roomId);
  if (!room) return;
  room.status = 'endgame';

  const kq = shuffle([...keyQuestions])[0] || null;
  room.currentKeyQuestion = kq;
  room.keyAnswers = {};
  room.spyVotes  = {};

  const { scoreA, scoreB } = getScores(room);

  // Admin
  io.to('admin_' + roomId).emit('finalPhaseStart', {
    spyFund: room.secretFund,
    spyName: room.spy ? room.spy.name : null,
    teamA_score: scoreA,
    teamB_score: scoreB,
    leaderboard: getLeaderboard(room),
  });

  // Player: thông báo phase final
  room.players.forEach(p => {
    io.to(p.id).emit('finalPhaseStart', {
      spyFund: room.secretFund,
      teamAPlayers: room.teamA.map(x => ({ id: x.id, name: x.name })),
    });
  });

  // Gửi câu hỏi chìa khóa cho Đội B
  if (kq) {
    const letters = ['A', 'B', 'C', 'D'];
    const choices = Object.entries(kq.options).map(([key, text]) => ({ key, text }));
    room.players.filter(p => p.team === 'B').forEach(p => {
      io.to(p.id).emit('teamBKeyQuestion', {
        text: kq.question,
        choices,
      });
    });
  }

  setTimeout(() => resolveEndgame(roomId), 61000);
}

function resolveEndgame(roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  const kq = room.currentKeyQuestion;
  let teamBWon = false;

  if (kq && room.secretFund > 0 && room.teamB.length > 0) {
    const correct = room.teamB.filter(p => room.keyAnswers[p.id] === kq.answer).length;
    if (correct > room.teamB.length / 2) {
      teamBWon = true;
      const bonus = Math.round(room.secretFund / room.teamB.length);
      room.teamB.forEach(p => { p.score += bonus; });
    }
  }

  let spyCaught = false;
  if (room.spy) {
    const votes = Object.values(room.spyVotes);
    const counts = {};
    votes.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top && top[0] === room.spy.id) {
      spyCaught = true;
      const nonSpy = room.teamA.filter(p => p.role !== 'spy');
      const bonus = nonSpy.length > 0 ? Math.round(room.secretFund / nonSpy.length) : 0;
      nonSpy.forEach(p => { p.score += bonus; });
    }
  }

  const { scoreA, scoreB } = getScores(room);
  const winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'draw';

  // Admin: kết quả cuối
  io.to('admin_' + roomId).emit('finalPhaseResult', {
    teamB_success: teamBWon,
    teamA_success: spyCaught,
  });

  // Player: màn hình vinh danh
  io.to('room_' + roomId).emit('gameOver', {
    winningTeam: winner,
    topPlayers: getLeaderboard(room).slice(0, 3),
    spyName: room.spy ? room.spy.name : null,
    spyCaught,
    teamBWon,
    scoreA,
    scoreB,
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
  console.log(`Player: http://localhost:${PORT}/play`);
});
