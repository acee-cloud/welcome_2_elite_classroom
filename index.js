const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Load ngân hàng câu hỏi
const questionsData = require('./data/questions.js');

// Gộp câu hỏi từ 4 chương thành mảng phẳng với trường `stage` (1-10 per chapter x 4 = 40 stages)
// Trong game này, 4 chương = 4 cửa (mỗi chương 10 stage nhưng game chỉ chạy 5 cửa)
// Ta map: chapter1->stage1-10, nhưng thực tế game dùng 10 stages = lấy 2 stage/chapter (5 câu/stage x 2 = 10 câu/chương)
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
// Trạng thái game
// =====================
let gameState = {
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

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getScores() {
  const scoreA = gameState.teamA.reduce((s, p) => s + p.score, 0);
  const scoreB = gameState.teamB.reduce((s, p) => s + p.score, 0);
  return { scoreA, scoreB };
}

function getLeaderboard() {
  return [...gameState.players]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score, team: p.team }));
}

// =====================
// Socket.IO
// =====================
io.on('connection', (socket) => {

  socket.on('joinGame', (playerName) => {
    if (gameState.status !== 'lobby') {
      socket.emit('errorMsg', 'Phòng đã khóa!');
      return;
    }
    const name = (playerName || '').trim().substring(0, 20);
    if (!name) { socket.emit('errorMsg', 'Tên không hợp lệ!'); return; }

    const player = { id: socket.id, name, score: 0, role: 'normal', team: null, submittedCurrentStage: false };
    gameState.players.push(player);
    io.emit('updateLobby', gameState.players);
  });

  socket.on('startGame', () => {
    if (gameState.players.length === 0) return;
    gameState.status = 'playing';
    gameState.currentStage = 1;
    gameState.teamA = [];
    gameState.teamB = [];
    gameState.spy = null;
    gameState.secretFund = 0;

    if (gameState.players.length === 1) {
      gameState.players[0].team = 'solo';
      io.to(gameState.players[0].id).emit('gameStarted', { team: 'solo', role: 'normal' });
      startStage(1); return;
    }

    let shuffled = shuffle([...gameState.players]);
    if (shuffled.length % 2 !== 0) {
      const spy = shuffled.pop();
      spy.role = 'spy'; spy.team = 'A';
      gameState.spy = spy;
      gameState.teamA.push(spy);
    }
    const half = Math.floor(shuffled.length / 2);
    shuffled.slice(0, half).forEach(p => { p.team = 'A'; gameState.teamA.push(p); });
    shuffled.slice(half).forEach(p => { p.team = 'B'; gameState.teamB.push(p); });
    gameState.players = [...gameState.teamA, ...gameState.teamB];

    gameState.players.forEach(p => {
      io.to(p.id).emit('gameStarted', { team: p.team, role: p.role });
    });
    startStage(1);
  });

  socket.on('submitAnswers', (data) => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player || player.submittedCurrentStage) return;
    player.submittedCurrentStage = true;

    const multiplier = (gameState.currentStage === 5) ? 2 : 1;
    const correct = Math.max(0, parseInt(data.correct) || 0);
    const wrong   = Math.max(0, parseInt(data.wrong)   || 0);
    const earned  = (correct * 10 - wrong * 2) * multiplier;
    player.score += earned;

    if (player.role === 'spy') gameState.secretFund += earned;

    socket.emit('submitResult', { correct, wrong, blank: 5 - correct - wrong, earned, totalScore: player.score });
    socket.emit('openTeamChat', { team: player.team });

    if (gameState.players.every(p => p.submittedCurrentStage)) {
      clearInterval(gameState.timer);
      startIntermission();
    }
  });

  socket.on('chatMessage', ({ text, scope }) => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player || !text || !text.trim()) return;
    const msg = { name: player.name, team: player.team, text: text.trim().substring(0, 200) };
    if (scope === 'team') {
      gameState.players.filter(p => p.team === player.team).forEach(p => io.to(p.id).emit('chatMsg', { ...msg, scope: 'team' }));
    } else if (gameState.status === 'intermission') {
      io.emit('chatMsg', { ...msg, scope: 'global' });
    }
  });

  socket.on('submitKeyAnswer', (answer) => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player || player.team !== 'B') return;
    gameState.keyAnswers[socket.id] = answer;
  });

  socket.on('voteSpy', (targetId) => {
    const voter = gameState.players.find(p => p.id === socket.id);
    if (!voter || voter.team !== 'A') return;
    gameState.spyVotes[socket.id] = targetId;
  });

  socket.on('resetGame', () => {
    clearInterval(gameState.timer);
    gameState = { status: 'lobby', currentStage: 0, players: [], teamA: [], teamB: [],
                  spy: null, secretFund: 0, timer: null, currentKeyQuestion: null, keyAnswers: {}, spyVotes: {} };
    io.emit('gameReset');
  });

  socket.on('disconnect', () => {
    gameState.players = gameState.players.filter(p => p.id !== socket.id);
    gameState.teamA   = gameState.teamA.filter(p => p.id !== socket.id);
    gameState.teamB   = gameState.teamB.filter(p => p.id !== socket.id);
    if (gameState.spy && gameState.spy.id === socket.id) gameState.spy = null;
    if (gameState.status === 'lobby') io.emit('updateLobby', gameState.players);
  });
});

// =====================
// Game flow
// =====================
function startStage(stageNum) {
  gameState.status = 'playing';
  gameState.currentStage = stageNum;
  gameState.players.forEach(p => { p.submittedCurrentStage = false; });

  const stageQs = allQuestions.filter(q => q.stage === stageNum);
  const letters = ['A', 'B', 'C', 'D'];

  gameState.players.forEach(p => {
    const personalQs = shuffle([...stageQs]).map(q => {
      const entries = shuffle(Object.entries(q.options));
      const newOptions = {};
      let newAnswer = '';
      entries.forEach(([origKey, val], i) => {
        newOptions[letters[i]] = val;
        if (origKey === q.answer) newAnswer = letters[i];
      });
      return { question: q.question, options: newOptions, answer: newAnswer };
    });
    io.to(p.id).emit('newStage', { stage: stageNum, totalStages: 10, isDouble: stageNum === 5, questions: personalQs });
  });

  io.emit('stageInfo', { stage: stageNum, totalStages: 10, isDouble: stageNum === 5 });

  let timeLeft = 90;
  gameState.timer = setInterval(() => {
    io.emit('tick', timeLeft);
    timeLeft--;
    if (timeLeft < 0) { clearInterval(gameState.timer); startIntermission(); }
  }, 1000);
}

function startIntermission() {
  if (gameState.status === 'intermission') return;
  gameState.status = 'intermission';
  gameState.players.forEach(p => { p.submittedCurrentStage = true; });

  const { scoreA, scoreB } = getScores();
  io.emit('intermissionStart', { scoreA, scoreB, stage: gameState.currentStage, leaderboard: getLeaderboard() });

  let timeLeft = 15;
  gameState.timer = setInterval(() => {
    io.emit('tick', timeLeft);
    timeLeft--;
    if (timeLeft < 0) {
      clearInterval(gameState.timer);
      const next = gameState.currentStage + 1;
      if (next > 10) startEndgame();
      else startStage(next);
    }
  }, 1000);
}

function startEndgame() {
  gameState.status = 'endgame';
  const kq = shuffle([...keyQuestions])[0] || null;
  gameState.currentKeyQuestion = kq;
  gameState.keyAnswers = {};
  gameState.spyVotes  = {};

  io.emit('endgamePhase1', {
    secretFund: gameState.secretFund,
    spyName: gameState.spy ? gameState.spy.name : null,
    ...getScores(),
    leaderboard: getLeaderboard(),
  });

  if (kq) {
    gameState.players.filter(p => p.team === 'B').forEach(p =>
      io.to(p.id).emit('keyQuestion', { question: kq, timeLimit: 60 }));
  }
  if (gameState.spy) {
    const suspects = gameState.teamA.map(p => ({ id: p.id, name: p.name }));
    gameState.players.filter(p => p.team === 'A').forEach(p =>
      io.to(p.id).emit('voteSpyForm', { suspects, timeLimit: 60 }));
  }

  setTimeout(resolveEndgame, 61000);
}

function resolveEndgame() {
  const kq = gameState.currentKeyQuestion;
  let teamBWon = false;
  if (kq && gameState.secretFund > 0 && gameState.teamB.length > 0) {
    const correct = gameState.teamB.filter(p => gameState.keyAnswers[p.id] === kq.answer).length;
    if (correct > gameState.teamB.length / 2) {
      teamBWon = true;
      const bonus = Math.round(gameState.secretFund / gameState.teamB.length);
      gameState.teamB.forEach(p => { p.score += bonus; });
    }
  }

  let spyCaught = false;
  if (gameState.spy) {
    const votes = Object.values(gameState.spyVotes);
    const counts = {};
    votes.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top && top[0] === gameState.spy.id) {
      spyCaught = true;
      const nonSpy = gameState.teamA.filter(p => p.role !== 'spy');
      const bonus = nonSpy.length > 0 ? Math.round(gameState.secretFund / nonSpy.length) : 0;
      nonSpy.forEach(p => { p.score += bonus; });
    }
  }

  const { scoreA, scoreB } = getScores();
  io.emit('endgameFinal', {
    spyCaught,
    spyName: gameState.spy ? gameState.spy.name : null,
    teamBWon,
    secretFund: gameState.secretFund,
    scoreA, scoreB,
    leaderboard: getLeaderboard(),
    winner: scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'draw',
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
