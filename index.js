const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let gameState = {
    players: {},
    roomLocked: false,
    currentStage: 0,
    spyData: { id: null, accumulatedPoints: 0 }
};

io.on('connection', (socket) => {
    console.log(`Người chơi kết nối: ${socket.id}`);

    socket.on('join_room', (data) => {
        if (gameState.roomLocked) {
            socket.emit('error_message', 'Phòng đã khóa hoặc trận đấu đã bắt đầu!');
            return;
        }
        gameState.players[socket.id] = {
            id: socket.id,
            name: data.name,
            avatar: data.avatar,
            team: null,
            score: 0,
            isSpy: false,
            doneCurrentStage: false
        };
        io.emit('update_players', Object.values(gameState.players));
    });

    socket.on('admin_start_game', () => {
        gameState.roomLocked = true;
        let playerIds = Object.keys(gameState.players);
        let totalPlayers = playerIds.length;

        if (totalPlayers < 2) {
            socket.emit('error_message', 'Cần tối thiểu 2 người chơi để bắt đầu!');
            return;
        }

        playerIds.sort(() => Math.random() - 0.5);

        let isOdd = totalPlayers % 2 !== 0;
        let spyId = isOdd ? playerIds[Math.floor(Math.random() * totalPlayers)] : null;

        playerIds.forEach((id, index) => {
            let team = (index % 2 === 0) ? 'A' : 'B';
            gameState.players[id].team = team;

            if (id === spyId) {
                gameState.players[id].isSpy = true;
                gameState.players[id].team = 'A';
                gameState.spyData.id = spyId;
                io.to(id).emit('assign_role', { role: 'spy', team: 'A' });
            } else {
                io.to(id).emit('assign_role', { role: 'normal', team: team });
            }
        });

        gameState.currentStage = 1;
        io.emit('start_stage', { stage: 1, players: Object.values(gameState.players) });
    });

    socket.on('submit_stage', (data) => {
        let p = gameState.players[socket.id];
        if (!p) return;

        let stageScore = (data.correctCount * 10) + (data.wrongCount * -2);

        if (p.isSpy) {
            gameState.spyData.accumulatedPoints += stageScore;
        }
        p.score += stageScore;
        p.doneCurrentStage = true;

        socket.emit('stage_completed_waiting', { score: p.score });
        socket.join(`chat_team_${p.team}`);
        io.to(`chat_team_${p.team}`).emit('sys_message', `${p.name} đã hoàn thành Cửa và tham gia phòng chờ!`);

        let allDone = Object.values(gameState.players).every(player => player.doneCurrentStage);
        if (allDone) {
            io.emit('intermission_30s', { spyPointsHidden: gameState.spyData.accumulatedPoints });
            io.emit('sys_message', 'Trạm nghỉ 30 giây bắt đầu! Khung chat tổng đã mở.');
        }
    });

    socket.on('send_message', (msg) => {
        let p = gameState.players[socket.id];
        if (!p) return;
        io.emit('receive_message', { name: p.name, avatar: p.avatar, text: msg, team: p.team });
    });

    socket.on('disconnect', () => {
        delete gameState.players[socket.id];
        io.emit('update_players', Object.values(gameState.players));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Game Server chạy tại cổng ${PORT}`));
