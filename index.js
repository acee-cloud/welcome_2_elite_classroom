const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Route admin va player
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

// Load ngan hang cau hoi
const questionsData = require('./data/questions.js');

// Gop cau hoi tu cac chuong thanh mang phang de xao tron
function buildFlatQuestions(data) {
  const flat = [];
  const chapterKeys = ['chapter1', 'chapter2', 'chapter3', 'chapter4'];
  chapterKeys.forEach((key) => {
    const chapter = data[key];
    if (!chapter) return;
    chapter.stages.forEach((stageArr) => {
      stageArr.forEach(q => flat.push({ ...q }));
    });
  });
  return flat;
}

const allQuestions = buildFlatQuestions(questionsData);

// =====================
// Room Management
// =====================
const rooms = {};

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
    teamC: [], // Doi danh cho nguoi bi le
    gameQuestions: [], 
    stageStartTime: null,
    timer: null,
    essayAnswers: [],
    currentEssayQuestion: null,
    essayBonusDetails: null
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
  const scoreC = room.teamC.reduce((s, p) => s + p.score, 0);
  return { scoreA, scoreB, scoreC };
}

// Uu tien diem cao, neu bang diem thi tong thoi gian it hon (nhanh hon) xep tren
function getLeaderboard(room) {
  return [...room.players]
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (a.totalCompletionTime || 0) - (b.totalCompletionTime || 0);
    })
    .map((p, i) => ({
      rank: i + 1,
      id: p.id,
      name: p.name,
      score: p.score,
      team: p.team,
      lastDelta: p.lastDelta || 0,
      lastCompletionTime: p.lastCompletionTime || 0,
      totalCompletionTime: p.totalCompletionTime || 0
    }));
}

// =====================
// Socket.IO
// =====================
io.on('connection', (socket) => {

  // Admin: tao phong
  socket.on('adminCreateRoom', () => {
    const roomId = createRoom();
    const room = getRoom(roomId);
    room.adminSocketId = socket.id;
    socket.join('room_' + roomId);
    socket.join('admin_' + roomId);
    socket.emit('roomCreated', roomId);
  });

  // Player: join phong
  socket.on('playerJoinRoom', ({ roomId, name }) => {
    const room = getRoom(roomId);
    if (!room) { socket.emit('errorMsg', 'Phong khong ton tai!'); return; }
    if (room.status !== 'lobby') { socket.emit('errorMsg', 'Phong da khoa!'); return; }

    const playerName = (name || '').trim().substring(0, 20);
    if (!playerName) { socket.emit('errorMsg', 'Ten khong hop le!'); return; }

    const player = {
      id: socket.id,
      name: playerName,
      score: 0,
      team: null,
      submittedCurrentStage: false,
      lastDelta: 0,
      lastCompletionTime: 0,
      totalCompletionTime: 0
    };
    room.players.push(player);
    socket.join('room_' + roomId);
    socket.data.roomId = roomId;

    io.to('admin_' + roomId).emit('updatePlayerList', room.players);
    socket.emit('joinedRoom', { roomId });
  });

  // Admin: bat dau game
  socket.on('adminStartGame', (roomId) => {
    const room = getRoom(roomId);
    if (!room || room.players.length === 0) return;

    room.status = 'playing';
    room.currentStage = 1;
    room.teamA = [];
    room.teamB = [];
    room.teamC = [];
    room.essayAnswers = [];
    room.essayBonusDetails = null;
    
    // Xao tron toan bo cau hoi 1 lan va cat ra cho tung vong
    room.gameQuestions = shuffle([...allQuestions]);

    if (room.players.length === 1) {
      room.players[0].team = 'solo';
      io.to(room.players[0].id).emit('roleAssignment', { team: 'solo' });
    } else {
      let shuffledPlayers = shuffle([...room.players]);
      shuffledPlayers.forEach(p => {
        p.score = 0;
        p.totalCompletionTime = 0;
        p.lastDelta = 0;
        p.lastCompletionTime = 0;
      });

      // Neu le thanh vien thi dua nguoi cuoi cung vao Doi C
      if (shuffledPlayers.length % 2 !== 0) {
        const playerC = shuffledPlayers.pop();
        playerC.team = 'C';
        room.teamC.push(playerC);
      }
      
      const half = Math.floor(shuffledPlayers.length / 2);
      shuffledPlayers.slice(0, half).forEach(p => { p.team = 'A'; room.teamA.push(p); });
      shuffledPlayers.slice(half).forEach(p => { p.team = 'B'; room.teamB.push(p); });
      
      room.players = [...room.teamA, ...room.teamB, ...room.teamC];

      room.players.forEach(p => {
        io.to(p.id).emit('roleAssignment', { team: p.team });
      });
    }

    io.to('admin_' + roomId).emit('gameStarted');
    startStage(roomId, 1);
  });

  // Player: nop bai giua cac vong
  socket.on('submitAnswers', ({ roomId, answers }) => {
    const room = getRoom(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.submittedCurrentStage) return;
    player.submittedCurrentStage = true;

    const duration = room.stageStartTime ? (Date.now() - room.stageStartTime) / 1000 : 0;
    player.lastCompletionTime = Number(duration.toFixed(2));
    player.totalCompletionTime = Number(((player.totalCompletionTime || 0) + duration).toFixed(2));

    const stageAnswers = player._stageAnswers || {};
    let correct = 0, wrong = 0;

    Object.keys(stageAnswers).forEach(qId => {
      const submitted = answers[qId];
      if (!submitted) return; 
      if (submitted === stageAnswers[qId]) correct++;
      else wrong++;
    });

    // Vong 10 nhan doi diem khi tra loi dung, sai van bi -2
    let correctPoints = room.currentStage === 10 ? 20 : 10;
    let wrongPoints = 2;

    const delta = (correct * correctPoints - wrong * wrongPoints);
    player.score += delta;
    if (player.score < 0) player.score = 0; // Khong de diem am
    player.lastDelta = delta;

    const total = Object.keys(stageAnswers).length;
    socket.emit('earlyResult', { correct, total, delta, currentScore: player.score });

    io.to('admin_' + roomId).emit('playerSubmittedUpdate', {
      id: player.id,
      name: player.name,
      team: player.team,
      lastCompletionTime: player.lastCompletionTime,
      lastDelta: player.lastDelta,
      score: player.score
    });

    if (room.players.every(p => p.submittedCurrentStage)) {
      clearInterval(room.timer);
      startIntermission(roomId);
    }
  });

  // VONG TU LUAN: Doi C dat cau hoi
  socket.on('submitEssayQuestion', ({ roomId, questionText }) => {
    const room = getRoom(roomId);
    if (!room || room.status !== 'essay_round') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.team !== 'C') return;

    room.currentEssayQuestion = questionText.trim();

    io.to('room_' + roomId).emit('essayRoundBroadcastQuestion', {
      questionText: room.currentEssayQuestion,
      creatorName: player.name
    });
  });

  // VONG TU LUAN: Doi A/B nop cau tra loi
  socket.on('submitEssayAnswer', ({ roomId, answerText }) => {
    const room = getRoom(roomId);
    if (!room || room.status !== 'essay_round') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || (player.team !== 'A' && player.team !== 'B')) return;

    const answerData = {
      playerId: player.id,
      name: player.name,
      team: player.team,
      answerText: answerText.trim(),
      timestamp: Date.now()
    };
    room.essayAnswers.push(answerData);

    if (room.teamC[0]) {
      io.to(room.teamC[0].id).emit('essayRoundNewAnswer', answerData);
    }
    io.to('admin_' + roomId).emit('essayRoundNewAnswer', answerData);
  });

  // VONG TU LUAN: Doi C chon nguoi tra loi dung dau tien
  socket.on('chooseBestEssayAnswer', ({ roomId, playerId }) => {
    const room = getRoom(roomId);
    if (!room || room.status !== 'essay_round') return;
    const chooser = room.players.find(p => p.id === socket.id);
    if (!chooser || chooser.team !== 'C') return;

    const chosen = room.essayAnswers.find(ans => ans.playerId === playerId);
    if (!chosen) return;

    const totalBonus = room.teamC[0].score;
    const winnerPlayer = room.players.find(p => p.id === chosen.playerId);
    
    if (winnerPlayer) {
      winnerPlayer.score += totalBonus;
    }

    room.essayBonusDetails = {
      winningTeam: chosen.team,
      winnerName: chosen.name,
      bonusPoints: totalBonus
    };

    startEndgame(roomId);
  });

  // Admin Reset
  socket.on('resetGame', (roomId) => {
    const room = getRoom(roomId);
    if (!room) return;
    clearInterval(room.timer);
    delete rooms[roomId];
    io.to('room_' + roomId).emit('gameReset');
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);
    room.teamA   = room.teamA.filter(p => p.id !== socket.id);
    room.teamB   = room.teamB.filter(p => p.id !== socket.id);
    room.teamC   = room.teamC.filter(p => p.id !== socket.id);

    if (room.status === 'lobby') {
      io.to('admin_' + roomId).emit('updatePlayerList', room.players);
    }
  });
});

function startStage(roomId, stageNum) {
  const room = getRoom(roomId);
  if (!room) return;

  room.status = 'playing';
  room.currentStage = stageNum;
  room.stageStartTime = Date.now();

  room.players.forEach(p => { 
    p.submittedCurrentStage = false; 
    p.lastDelta = 0;
    p.lastCompletionTime = 0;
  });

  const startIdx = (stageNum - 1) * 5;
  let stageQs = room.gameQuestions.slice(startIdx, startIdx + 5);
  if (stageQs.length < 5) {
    stageQs = shuffle([...allQuestions]).slice(0, 5); 
  }

  const letters = ['A', 'B', 'C', 'D'];
  stageQs.forEach((q, i) => { q._id = `s${stageNum}_${i}`; });

  const { scoreA, scoreB, scoreC } = getScores(room);

  io.to('admin_' + roomId).emit('stageUpdate', {
    stageNum,
    isDouble: stageNum === 10,
    teamA_score: scoreA,
    teamB_score: scoreB,
    teamC_score: scoreC,
  });

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
        _answer: newAnswer,
      };
    });

    p._stageAnswers = {};
    personalQs.forEach(q => {
      p._stageAnswers[q.id] = q._answer;
      delete q._answer;
    });

    io.to(p.id).emit('startStage', {
      stageNum,
      isDouble: stageNum === 10,
      questions: personalQs,
    });
  });

  // Giam thoi gian xuong 60s
  let timeLeft = 60;
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
  
  room.players.forEach(p => { 
    if (!p.submittedCurrentStage) {
      p.submittedCurrentStage = true;
      p.lastCompletionTime = 60;
      p.totalCompletionTime = Number(((p.totalCompletionTime || 0) + 60).toFixed(2));
      p.lastDelta = 0;
    }
  });

  const { scoreA, scoreB, scoreC } = getScores(room);
  const leaderboard = getLeaderboard(room);

  io.to('room_' + roomId).emit('intermissionStart', {
    teamA_score: scoreA,
    teamB_score: scoreB,
    teamC_score: scoreC,
    leaderboard,
  });

  let timeLeft = 10;
  room.timer = setInterval(() => {
    io.to('room_' + roomId).emit('timerUpdate', timeLeft);
    timeLeft--;
    if (timeLeft < 0) {
      clearInterval(room.timer);
      const next = room.currentStage + 1;
      if (next > 10) {
        if (room.teamC.length > 0) {
          startEssayRound(roomId);
        } else {
          startEndgame(roomId);
        }
      } else {
        startStage(roomId, next);
      }
    }
  }, 1000);
}

function startEssayRound(roomId) {
  const room = getRoom(roomId);
  if (!room) return;
  room.status = 'essay_round';
  room.essayAnswers = [];

  const { scoreC } = getScores(room);

  io.to('admin_' + roomId).emit('essayRoundStart', {
    creatorName: room.teamC[0].name,
    scoreC
  });

  io.to(room.teamC[0].id).emit('essayRoundRequestQuestion', {
    scoreC
  });

  room.players.filter(p => p.team === 'A' || p.team === 'B').forEach(p => {
    io.to(p.id).emit('essayRoundWaitingQuestion', {
      creatorName: room.teamC[0].name
    });
  });
}

function startEndgame(roomId) {
  const room = getRoom(roomId);
  if (!room) return;
  room.status = 'endgame';

  const { scoreA, scoreB, scoreC } = getScores(room);
  let winner = 'draw';
  if (scoreA > scoreB) winner = 'A';
  else if (scoreB > scoreA) winner = 'B';

  const leaderboard = getLeaderboard(room);

  io.to('room_' + roomId).emit('gameOver', {
    winningTeam: winner,
    topPlayers: leaderboard.slice(0, 3),
    scoreA,
    scoreB,
    scoreC,
    essayBonusDetails: room.essayBonusDetails
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
