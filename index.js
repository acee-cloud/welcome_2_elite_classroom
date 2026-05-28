const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

// Lưu trạng thái phòng trên server
let roomState = {
    players: {},
    isLocked: false
};

io.on('connection', (socket) => {
    console.log('🟢 Kết nối mới: ' + socket.id);

    // Gửi trạng thái hiện tại ngay khi có người vào
    socket.emit('update-lobby', roomState);

    // Admin đăng ký
    socket.on('register-admin', () => {
        socket.join('admin-room');
        socket.emit('update-lobby', roomState);
    });

    // Người chơi xin vào phòng
    socket.on('player-join', (data) => {
        if (roomState.isLocked) {
            socket.emit('join-result', { success: false, message: 'Cửa hầm đã khóa rồi! Chờ ván sau nhé.' });
            return;
        }
        // Kiểm tra tên trùng
        const nameTaken = Object.values(roomState.players).some(p => p.name === data.name);
        if (nameTaken) {
            socket.emit('join-result', { success: false, message: 'Tên này đã có người dùng rồi!' });
            return;
        }

        roomState.players[socket.id] = { name: data.name, avatar: data.avatar };
        socket.emit('join-result', { success: true });
        io.emit('update-lobby', roomState); // Cập nhật tất cả
    });

    // Admin đóng cửa
    socket.on('lock-room', () => {
        roomState.isLocked = true;
        io.emit('update-lobby', roomState);
        io.emit('room-status-changed', { isLocked: true });
    });

    // Xử lý khi người thoát
    socket.on('disconnect', () => {
        if (roomState.players[socket.id]) {
            delete roomState.players[socket.id];
            io.emit('update-lobby', roomState);
        }
        console.log('🔴 Thoát: ' + socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`🚀 Chạy tại cổng ${PORT}`);
});