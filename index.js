const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

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
const rooms = {};

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
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
      return a.totalTimeTaken - b.totalTimeTaken; // Ai hoàn thành nhanh hơn xếp trên
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

  // ADMIN: Tạo phòng mới
  socket.on('adminCreateRoom', () => {
    const roomId = generateRoomId();
    rooms[roomId] = {
      roomId, adminSocketId: socket.id, status: 'lobby', currentStage: 0,
      players: [], teamA: [], teamB: [], teamC: null,
      bonusTeamA: 0, bonusTeamB: 0, timer: null, stageStartTime: 0,
      fastPhase: { questionText: '', active: false, submissions: [] }
    };
    socket.join('room_' + roomId);
    socket.join('admin_' + roomId);
    socket.emit('roomCreated', roomId);
  });

  // PLAYER: Tham gia phòng chơi (Nhận thêm avatar từ việc quét QR/nhập form)
  socket.on('playerJoinRoom', ({ roomId, name, avatar }) => {
    const rId = roomId.toUpperCase();
    const room = rooms[rId];
    if (!room || room.status !== 'lobby') {
      return socket.emit('errorMsg', 'Phòng không tồn tại hoặc trận đấu đã bắt đầu!');
    }
    const playerName = (name || '').trim().substring(0, 20);
    if (!playerName) return socket.emit('errorMsg', 'Tên không hợp lệ!');
    
    const playerAvatar = avatar || { emoji: '🐾', name: 'Mặc định' };

    // Thuật toán chia đội tự động & cân bằng tuyệt đối ngay khi vào sảnh
    let assignedTeam = 'A';
    const countA = room.teamA.length;
    const countB = room.teamB.length;

    if (countA < countB) {
      assignedTeam = 'A';
    } else if (countB < countA) {
      assignedTeam = 'B';
    } else {
      assignedTeam = Math.random() < 0.5 ? 'A' : 'B';
    }

    const player = {
      id: socket.id, name: playerName, avatar: playerAvatar, score: 0, team: assignedTeam,
      submittedCurrentStage: false, _stageAnswers: {}, _answeredCount: 0,
      totalTimeTaken: 0, lastDelta: 0, history: []
    };
    
    room.players.push(player);
    if (assignedTeam === 'A') {
      room.teamA.push(player);
    } else {
      room.teamB.push(player);
    }

    socket.join('room_' + rId);
    socket.data.roomId = rId;

    socket.emit('joinedRoom', { roomId: room.roomId, team: assignedTeam });
    socket.emit('roleAssignment', { team: assignedTeam });

    // Gửi thông tin sảnh chờ tới mọi người
    io.to('room_' + rId).emit('lobbyUpdate', {
      players: room.players.map(p => ({
        id: p.id, name: p.name, avatar: p.avatar, team: p.team
      }))
    });

    // Cập nhật riêng cho Admin
    io.to('admin_' + rId).emit('updatePlayerList', room.players.map(p => ({
      id: p.id, name: p.name, avatar: p.avatar, team: p.team
    })));
  });

  // Gửi tin nhắn ở sảnh chờ
  socket.on('sendLobbyMessage', ({ roomId, msg }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'lobby' || !msg || !msg.trim()) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    io.to('room_' + roomId).emit('receiveLobbyMessage', {
      name: player.name, msg: msg.trim().substring(0, 150), team: player.team
    });
  });

  // ADMIN: Khởi chạy trận đấu công bằng
  socket.on('adminStartGame', (roomId) => {
    const room = rooms[roomId];
    if (!room || room.players.length === 0) return;
    
    room.status = 'playing';

    io.to('admin_' + roomId).emit('gameStarted');
    io.to('room_' + roomId).emit('gameStart');
    startStage(roomId, 1);
  });

  // PLAYER: Trả lời cuốn chiếu từng câu
  socket.on('submitSingleAnswer', ({ roomId, questionId, answer }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.submittedCurrentStage) return;

    const timeTakenForThisQ = (Date.now() - room.stageStartTime) / 1000;
    player.totalTimeTaken += parseFloat(timeTakenForThisQ.toFixed(2));

    const currentQData = player._stageAnswers[questionId];
    const isCorrect = (answer === currentQData.correctKey);

    const isStage10 = (room.currentStage === 10);
    const points = isCorrect ? (isStage10 ? 20 : 10) : -2; 
    
    player.score = Math.max(0, player.score + points);
    player.lastDelta = points;

    player.history.push({
      questionText: currentQData.text, choices: currentQData.choices, chosenAnswer: answer,
      correctAnswer: currentQData.correctKey, isCorrect: isCorrect, pointsDelta: points
    });

    player._answeredCount++;

    socket.emit('singleAnswerResult', {
      questionId, isCorrect, points: points >= 0 ? `+${points}` : `${points}`, currentScore: player.score
    });

    const { scoreA, scoreB, scoreC } = getScores(room);
    io.to('admin_' + roomId).emit('realtimeScoreUpdate', {
      scoreA, scoreB, scoreC, players: getLeaderboard(room)
    });

    const totalQs = Object.keys(player._stageAnswers).length;
    if (player._answeredCount >= totalQs) {
      player.submittedCurrentStage = true;
    }

    if (room.players.every(p => p.submittedCurrentStage)) {
      clearInterval(room.timer);
      startIntermission(roomId);
    }
  });

  // PHÒNG CHAT TÍCH HỢP TOÀN SẢNH CHỜ VÀ GIẢI LAO TRỰC TUYẾN
  socket.on('sendGlobalMessage', ({ roomId, msg }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'intermission' || !msg || !msg.trim()) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    io.to('room_' + roomId).emit('receiveGlobalMessage', {
      name: player.name, msg: msg.trim().substring(0, 150), team: player.team
    });
  });

  // LỚP VÒNG CHẶNG CÂU HỎI TỰ LUẬN NHANH (HOSTED BY TEAM C)
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

  // ADMIN: Reset và tái cấu trúc lại phòng chơi mới
  socket.on('adminResetGame', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    clearInterval(room.timer);
    
    rooms[roomId] = {
      roomId, adminSocketId: socket.id, status: 'lobby', currentStage: 0,
      players: [], teamA: [], teamB: [], teamC: null,
      bonusTeamA: 0, bonusTeamB: 0, timer: null, stageStartTime: 0,
      fastPhase: { questionText: '', active: false, submissions: [] }
    };

    io.to('room_' + roomId).emit('roomResetByAdmin');
  });

  // Xử lý khi có người chơi ngắt kết nối
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    
    const room = rooms[roomId];
    
    room.players = room.players.filter(p => p.id !== socket.id);
    room.teamA = room.teamA.filter(p => p.id !== socket.id);
    room.teamB = room.teamB.filter(p => p.id !== socket.id);
    if (room.teamC && room.teamC.id === socket.id) room.teamC = null;

    if(room.status === 'lobby') {
      io.to('room_' + roomId).emit('lobbyUpdate', {
        players: room.players.map(p => ({
          id: p.id, name: p.name, avatar: p.avatar, team: p.team
        }))
      });
      io.to('admin_' + roomId).emit('updatePlayerList', room.players.map(p => ({
        id: p.id, name: p.name, avatar: p.avatar, team: p.team
      })));
    }
  });
});

function startStage(roomId, stageNum) {
  const room = rooms[roomId];
  if (!room) return;
  room.status = 'playing';
  room.currentStage = stageNum;
  room.stageStartTime = Date.now();
  
  const stageQs = allQuestions.filter(q => q.stage === stageNum).sort(() => Math.random() - 0.5);
  const letters = ['A', 'B', 'C', 'D'];

  io.to('admin_' + roomId).emit('stageUpdate', { stageNum, isDouble: stageNum === 10 });

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
      
      p._stageAnswers[qId] = { id: qId, text: q.question, choices, correctKey: foundNewKey || 'A' };
      return { id: qId, text: q.question, choices };
    });

    p.lastDelta = 0;
    io.to(p.id).emit('startStage', { stageNum, isDouble: stageNum === 10, questions: randomizedQs });
  });

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

  const { scoreA, scoreB, scoreC } = getScores(room);
  io.to('room_' + roomId).emit('intermissionStart', {
    scoreA, scoreB, scoreC, leaderboard: getLeaderboard(room)
  });

  let timeLeft = 15;
  clearInterval(room.timer);
  room.timer = setInterval(() => {
    io.to('room_' + roomId).emit('timerUpdate', timeLeft);
    timeLeft--;
    if (timeLeft < 0) {
      clearInterval(room.timer);
      const next = room.currentStage + 1;
      if (next > 10) {
        if (room.teamC) {
          room.status = 'fast_phase_running';
          io.to('room_' + roomId).emit('startFastQuestionPhase', { hostName: room.teamC.name, hostId: room.teamC.id });
        } else {
          endGameFinal(roomId);
        }
      } else {
        startStage(roomId, next);
      }
    }
  }, 1000);
}

function endGameFinal(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  const { scoreA, scoreB } = getScores(room);
  
  room.players.forEach(p => {
    io.to(p.id).emit('gameSummaryReport', p.history);
  });

  io.to('room_' + roomId).emit('gameOver', {
    winningTeam: scoreA === scoreB ? 'Hòa' : (scoreA > scoreB ? 'A' : 'B'),
    topPlayers: getLeaderboard(room).slice(0, 5)
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server đang chạy tại port ${PORT}`);
});
