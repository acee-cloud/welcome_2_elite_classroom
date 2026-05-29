const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

// Load question bank
const questionsData = require('./data/questions.js');

function buildFlatQuestions(data) {
  const flat = [];
  const chapterKeys = ['chapter1', 'chapter2', 'chapter3', 'chapter4'];
  chapterKeys.forEach((key) => {
    const chapter = data[key];
    if (!chapter) return;
    chapter.stages.forEach((stageArr) => {
      stageArr.forEach(q => flat.push(q));
    });
  });
  return flat;
}

const allQuestionsPool = buildFlatQuestions(questionsData);

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
    teamC: [], // Đội lẻ
    timer: null,
    shuffledQuestions: [],
    essayQuestion: null
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

function getLeaderboard(room) {
  return [...room.players]
    .sort((a, b) => b.score - a.score || a.totalCompletionTime - b.totalCompletionTime)
    .map((p, i) => ({ 
      rank: i + 1, 
      name: p.name, 
      score: p.score, 
      team: p.team,
      lastDelta: p.lastDelta,
      lastCompletionTime: p.lastCompletionTime,
      totalCompletionTime: p.totalCompletionTime
    }));
}

io.on('connection', (socket) => {

  socket.on('adminCreateRoom', () => {
    const roomId = createRoom();
    const room = getRoom(roomId);
    room.adminSocketId = socket.id;
    socket.join('room_' + roomId);
    socket.join('admin_' + roomId);
    socket.emit('roomCreated', roomId);
  });

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
      _currentStageAnswers: {},
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

  socket.on('adminStartGame', (roomId) => {
    const room = getRoom(roomId);
    if (!room || room.players.length === 0) return;

    room.status = 'playing';
    room.currentStage = 1;
    room.teamA = [];
    room.teamB = [];
    room.teamC = [];
    room.shuffledQuestions = shuffle([...allQuestionsPool]);

    if (room.players.length === 1) {
      room.players[0].team = 'SOLO';
      io.to(room.players[0].id).emit('roleAssignment', { team: 'SOLO' });
    } else {
      let shuffled = shuffle([...room.players]);
      if (shuffled.length % 2 !== 0) {
        const playerC = shuffled.pop();
        playerC.team = 'C';
        room.teamC.push(playerC);
      }
      const half = Math.floor(shuffled.length / 2);
      shuffled.slice(0, half).forEach(p => { p.team = 'A'; room.teamA.push(p); });
      shuffled.slice(half).forEach(p => { p.team = 'B'; room.teamB.push(p); });
      room.players = [...room.teamA, ...room.teamB, ...room.teamC];

      room.players.forEach(p => {
        io.to(p.id).emit('roleAssignment', { team: p.team });
      });
    }

    io.to('admin_' + roomId).emit('gameStarted');
    startStage(roomId, 1);
  });

  socket.on('submitSingleAnswer', ({ roomId, questionId, answer, timeTaken }) => {
    const room = getRoom(roomId);
    if (!room || room.status !== 'playing') return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.submittedCurrentStage) return;
    if (player._currentStageAnswers[questionId] !== undefined) return;

    const stageAnswers = player._stageAnswers || {};
    const correctAnswer = stageAnswers[questionId];
    const isCorrect = (answer === correctAnswer);

    const multiplier = (room.currentStage === 10) ? 2 : 1;
    const points = isCorrect ? (10 * multiplier) : -2;

    player.score += points;
    player.lastDelta = points;
    player.lastCompletionTime = timeTaken;
    player.totalCompletionTime += timeTaken;
    
    player._currentStageAnswers[questionId] = answer;

    socket.emit('singleAnswerResult', {
      questionId,
      isCorrect,
      points: points >= 0 ? `+${points}` : `${points}`,
      currentScore: player.score
    });

    const scores = getScores(room);
    io.to('admin_' + roomId).emit('playerSubmittedUpdate', {
      id: player.id,
      name: player.name,
      team: player.team,
      score: player.score,
      lastDelta: points,
      lastCompletionTime: timeTaken,
      teamA_score: scores.scoreA,
      teamB_score: scores.scoreB,
      teamC_score: scores.scoreC
    });

    const totalQs = Object.keys(stageAnswers).length;
    const answeredCount = Object.keys(player._currentStageAnswers).length;
    if (answeredCount >= totalQs) {
      player.submittedCurrentStage = true;
    }

    if (room.players.every(p => p.submittedCurrentStage)) {
      clearInterval(room.timer);
      startIntermission(roomId);
    }
  });

  socket.on('sendGlobalMessage', ({ roomId, msg }) => {
    const room = getRoom(roomId);
    if (!room || !msg || !msg.trim()) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || room.status !== 'intermission') return;
    io.to('room_' + roomId).emit('receiveGlobalMessage', { 
      name: player.name, 
      team: player.team, 
      msg: msg.trim().substring(0, 200) 
    });
  });

  socket.on('submitEssayQuestion', ({ roomId, questionText }) => {
    const room = getRoom(roomId);
    if (!room || room.status !== 'essay') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.team !== 'C') return;

    room.essayQuestion = questionText;
    io.to('room_' + roomId).emit('essayRoundBroadcastQuestion', {
      creatorName: player.name,
      questionText: questionText
    });
  });

  socket.on('submitEssayAnswer', ({ roomId, answerText }) => {
    const room = getRoom(roomId);
    if (!room || room.status !== 'essay') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || (player.team !== 'A' && player.team !== 'B')) return;

    io.to('room_' + roomId).emit('essayRoundNewAnswer', {
      playerId: player.id,
      name: player.name,
      team: player.team,
      answerText: answerText
    });
  });

  socket.on('chooseBestEssayAnswer', ({ roomId, playerId }) => {
    const room = getRoom(roomId);
    if (!room || room.status !== 'essay') return;
    const creator = room.players.find(p => p.id === socket.id);
    if (!creator || creator.team !== 'C') return;

    const winner = room.players.find(p => p.id === playerId);
    if (winner) {
      const bonus = creator.score;
      winner.score += bonus;
      resolveEndgame(roomId, { winnerName: winner.name, winningTeam: winner.team, bonusPoints: bonus });
    }
  });

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
    room.teamA = room.teamA.filter(p => p.id !== socket.id);
    room.teamB = room.teamB.filter(p => p.id !== socket.id);
    room.teamC = room.teamC.filter(p => p.id !== socket.id);
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
  room.players.forEach(p => { 
    p.submittedCurrentStage = false; 
    p._currentStageAnswers = {};
    p.lastCompletionTime = 0;
  });

  const startIndex = (stageNum - 1) * 5;
  const stageQs = room.shuffledQuestions.slice(startIndex, startIndex + 5);
  const letters = ['A', 'B', 'C', 'D'];

  stageQs.forEach((q, i) => { q._id = `s${stageNum}_${i}`; });

  const scores = getScores(room);
  io.to('admin_' + roomId).emit('stageUpdate', {
    stageNum,
    isDouble: stageNum === 10,
    teamA_score: scores.scoreA,
    teamB_score: scores.scoreB,
    teamC_score: scores.scoreC,
    players: room.players
  });

  room.players.forEach(p => {
    const personalQs = stageQs.map(q => {
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
  room.players.forEach(p => { p.submittedCurrentStage = true; });

  const scores = getScores(room);
  const leaderboard = getLeaderboard(room);

  io.to('room_' + roomId).emit('intermissionStart', {
    teamA_score: scores.scoreA,
    teamB_score: scores.scoreB,
    teamC_score: scores.scoreC,
    leaderboard,
  });

  let timeLeft = 30;
  room.timer = setInterval(() => {
    io.to('room_' + roomId).emit('timerUpdate', timeLeft);
    timeLeft--;
    if (timeLeft < 0) {
      clearInterval(room.timer);
      const next = room.currentStage + 1;
      if (next > 10) {
        if (room.teamC.length > 0 && room.teamA.length > 0 && room.teamB.length > 0) {
          startEssayRound(roomId);
        } else {
          resolveEndgame(roomId);
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
  room.status = 'essay';
  const playerC = room.teamC[0];

  io.to('room_' + roomId).emit('essayRoundStart', {
    creatorName: playerC.name,
    scoreC: playerC.score
  });

  io.to(playerC.id).emit('essayRoundRequestQuestion', { scoreC: playerC.score });
}

function resolveEndgame(roomId, essayBonusDetails = null) {
  const room = getRoom(roomId);
  if (!room) return;
  room.status = 'endgame';

  const scores = getScores(room);
  let winner = 'HOA';
  if (scores.scoreA > scores.scoreB) winner = 'A';
  else if (scores.scoreB > scores.scoreA) winner = 'B';

  io.to('room_' + roomId).emit('gameOver', {
    winningTeam: winner,
    topPlayers: getLeaderboard(room).slice(0, 3),
    scoreA: scores.scoreA,
    scoreB: scores.scoreB,
    essayBonusDetails
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
