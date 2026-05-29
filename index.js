const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Định tuyến giao diện
app.get('/admin', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin.html')); });
app.get('/play', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'player.html')); });

// Tải ngân hàng câu hỏi gốc
const questionsData = require('./data/questions.js');

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
const rooms = {};

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function getScores(room) {
  const scoreA = room.teamA.reduce((s, p) => s + p.score, 0);
  const scoreB = room.teamB.reduce((s, p) => s + p.score, 0);
  return { scoreA, scoreB };
}

function getLeaderboard(room) {
  return [...room.players]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ id: p.id, name: p.name, score: p.score, team: p.team }));
}

io.on('connection', (socket) => {
  // ADMIN: Tạo phòng & Sinh mã QR
  socket.on('adminCreateRoom', () => {
    const roomId = generateRoomId();
    rooms[roomId] = {
      roomId, adminSocketId: socket.id, status: 'lobby', currentStage: 0,
      players: [], teamA: [], teamB: [], spy: null, secretFund: 0, timer: null
    };
    socket.join('room_' + roomId);
    socket.join('admin_' + roomId);
    socket.emit('roomCreated', roomId);
  });

  // PLAYER: Tham gia phòng bằng Code hoặc Link QR
  socket.on('playerJoinRoom', ({ roomId, name }) => {
    const room = rooms[roomId.toUpperCase()];
    if (!room || room.status !== 'lobby') {
      return socket.emit('errorMsg', 'Phòng không tồn tại hoặc đã khóa!');
    }
    const playerName = (name || '').trim().substring(0, 20);
    if (!playerName) return socket.emit('errorMsg', 'Tên không hợp lệ!');

    const player = {
      id: socket.id, name: playerName, score: 0, role: 'normal', team: null,
      submittedCurrentStage: false, _stageAnswers: {}, _answeredCount: 0
    };
    room.players.push(player);
    socket.join('room_' + roomId.toUpperCase());
    socket.data.roomId = roomId.toUpperCase();

    io.to('admin_' + room.roomId).emit('updatePlayerList', room.players);
    socket.emit('joinedRoom', { roomId: room.roomId });
  });

  // ADMIN: Kích hoạt trận đấu
  socket.on('adminStartGame', (roomId) => {
    const room = rooms[roomId];
    if (!room || room.players.length === 0) return;
    room.status = 'playing';
    
    // Chia đội ngẫu nhiên và phân vai Gián điệp ẩn danh
    let shuffled = [...room.players].sort(() => Math.random() - 0.5);
    if (shuffled.length > 2 && shuffled.length % 2 !== 0) {
      room.spy = shuffled.pop();
      room.spy.role = 'spy'; room.spy.team = 'A';
      room.teamA.push(room.spy);
    }
    const half = Math.floor(shuffled.length / 2);
    shuffled.slice(0, half).forEach(p => { p.team = 'A'; room.teamA.push(p); });
    shuffled.slice(half).forEach(p => { p.team = 'B'; room.teamB.push(p); });
    room.players = [...room.teamA, ...room.teamB];

    room.players.forEach(p => {
      io.to(p.id).emit('roleAssignment', { team: p.team || 'solo', isSpy: p.role === 'spy' });
    });

    io.to('admin_' + roomId).emit('gameStarted');
    startStage(roomId, 1);
  });

  // CƠ CHẾ MỚI: CHẤM ĐIỂM TỪNG CÂU HỎI VÀ ĐẨY BIẾN ĐỘNG REALTIME LÊN ADMIN
  socket.on('submitSingleAnswer', ({ roomId, questionId, answer }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.submittedCurrentStage) return;

    const correctAnswer = player._stageAnswers[questionId];
    const isCorrect = (answer === correctAnswer);

    const multiplier = (room.currentStage === 5) ? 2 : 1;
    const points = isCorrect ? (10 * multiplier) : (-2 * multiplier);
    player.score = Math.max(0, player.score + points);

    if (player.role === 'spy' && isCorrect) {
      room.secretFund += 10 * multiplier;
    }

    player._answeredCount++;
    socket.emit('singleAnswerResult', {
      questionId, isCorrect,
      points: points >= 0 ? `+${points}` : `${points}`,
      currentScore: player.score
    });

    // Admin nhận dữ liệu điểm nhảy số liên tục theo thời gian thực
    const { scoreA, scoreB } = getScores(room);
    io.to('admin_' + roomId).emit('realtimeScoreUpdate', {
      scoreA, scoreB, players: getLeaderboard(room)
    });

    // Nếu người chơi hoàn thành tất cả câu hỏi trong Stage hiện tại
    const totalQs = Object.keys(player._stageAnswers).length;
    if (player._answeredCount >= totalQs) {
      player.submittedCurrentStage = true;
    }

    if (room.players.every(p => p.submittedCurrentStage)) {
      clearInterval(room.timer);
      startIntermission(roomId);
    }
  });

  // NHẬN TIN NHẮN TỪ PHÒNG CHAT GIẢI LAO 30S CÔNG KHAI
  socket.on('sendGlobalMessage', ({ roomId, msg }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'intermission' || !msg || !msg.trim()) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    io.to('room_' + roomId).emit('receiveGlobalMessage', {
      name: player.name,
      msg: msg.trim().substring(0, 150),
      team: player.team
    });
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
    io.to('admin_' + roomId).emit('updatePlayerList', rooms[roomId].players);
  });
});

function startStage(roomId, stageNum) {
  const room = rooms[roomId];
  if (!room) return;
  room.status = 'playing';
  
  const stageQs = allQuestions.filter(q => q.stage === stageNum);
  const letters = ['A', 'B', 'C', 'D'];

  io.to('admin_' + roomId).emit('stageUpdate', { stageNum, isDouble: stageNum === 5 });

  room.players.forEach(p => {
    p.submittedCurrentStage = false;
    p._answeredCount = 0;
    p._stageAnswers = {};

    const randomizedQs = stageQs.map((q, idx) => {
      const qId = `s${stageNum}_q${idx}`;
      const optionsArr = Object.entries(q.options).sort(() => Math.random() - 0.5);
      const choices = optionsArr.map(([key, text], i) => ({ key: letters[i], text }));
      const correctOriginalKey = q.answer;
      const foundNewKey = choices.find(c => optionsArr.find(([k]) => k === correctOriginalKey)[1] === c.text)?.key;
      
      p._stageAnswers[qId] = foundNewKey || 'A';
      return { id: qId, text: q.question, choices };
    });

    io.to(p.id).emit('startStage', { stageNum, isDouble: stageNum === 5, questions: randomizedQs });
  });

  // Hồi phục đồng hồ đếm ngược 60s
  let timeLeft = 60;
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

function startIntermission(roomId) {
  const room = rooms[roomId];
  if (!room || room.status === 'intermission') return;
  room.status = 'intermission';
  room.players.forEach(p => p.submittedCurrentStage = true);

  const { scoreA, scoreB } = getScores(room);
  io.to('room_' + roomId).emit('intermissionStart', {
    scoreA, scoreB, leaderboard: getLeaderboard(room)
  });

  // Kích hoạt 30s nghỉ giải lao
  let timeLeft = 30;
  clearInterval(room.timer);
  room.timer = setInterval(() => {
    io.to('room_' + roomId).emit('timerUpdate', timeLeft);
    timeLeft--;
    if (timeLeft < 0) {
      clearInterval(room.timer);
      const next = room.currentStage + 1;
      if (next > 10) io.to('room_' + roomId).emit('gameOver', { winningTeam: scoreA > scoreB ? 'A' : 'B', topPlayers: getLeaderboard(room).slice(0, 3) });
      else startStage(roomId, next);
    }
  }, 1000);
}
