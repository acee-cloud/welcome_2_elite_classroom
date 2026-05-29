<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nguoi Choi - Vat Li 11</title>

    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js"
        onload="katexReady = true; maybeRenderMath()"></script>

    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=IBM+Plex+Sans:wght@400;600;700&display=swap" rel="stylesheet">
    <script src="/socket.io/socket.io.js"></script>

    <style>
        :root {
            --bg: #0a0e1a; --panel: #111827; --border: #1e3a5f;
            --accent: #00d4ff; --accent2: #ff6b35;
            --team-a: #ff4d6d; --team-b: #38bdf8; --team-c: #a78bfa;
            --gold: #ffd700; --success: #34d399; --danger: #f87171;
            --text: #e2e8f0; --muted: #64748b;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'IBM Plex Sans', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; padding: 16px; padding-bottom: 40px; }
        .hidden { display: none !important; }
        .screen { max-width: 600px; margin: 0 auto; }
        .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 16px; padding: 20px; margin-bottom: 14px; }
        .panel-title { font-family: 'Orbitron', monospace; font-size: 14px; letter-spacing: 2px; color: var(--accent); text-transform: uppercase; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
        .page-title { font-family: 'Orbitron', monospace; font-size: 20px; font-weight: 900; text-align: center; color: var(--accent); letter-spacing: 3px; margin-bottom: 20px; text-shadow: 0 0 20px rgba(0,212,255,0.4); }
        .field { margin-bottom: 14px; }
        .field label { display: block; font-size: 12px; font-weight: 700; letter-spacing: 1px; color: var(--muted); text-transform: uppercase; margin-bottom: 6px; }
        .input { width: 100%; padding: 12px 14px; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-size: 16px; outline: none; transition: border-color 0.2s; }
        .input:focus { border-color: var(--accent); }
        .btn { display: block; width: 100%; padding: 14px; font-family: 'Orbitron', monospace; font-size: 14px; font-weight: 700; letter-spacing: 2px; color: #000; background: var(--accent); border: none; border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.2s; margin-top: 8px; }
        .btn-success { background: var(--success); color: #000; }
        .badge { display: inline-block; padding: 8px 20px; border-radius: 20px; font-weight: 700; font-size: 16px; letter-spacing: 1px; }
        .badge-a { background: rgba(255,77,109,0.15); color: var(--team-a); border: 1px solid var(--team-a); }
        .badge-b { background: rgba(56,189,248,0.15); color: var(--team-b); border: 1px solid var(--team-b); }
        .badge-c { background: rgba(167,139,250,0.15); color: var(--team-c); border: 1px solid var(--team-c); }
        
        .sticky-header { position: sticky; top: 0; z-index: 100; background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
        .header-stage { font-family: 'Orbitron', monospace; font-size: 15px; font-weight: 700; }
        .header-team { font-size: 13px; font-weight: 600; margin-top: 3px; color: var(--accent); }
        .header-timer { font-family: 'Orbitron', monospace; font-size: 28px; font-weight: 900; color: var(--danger); }
        
        .question-block { border-bottom: 1px solid var(--border); padding: 18px 0; }
        .question-block:last-child { border-bottom: none; padding-bottom: 0; }
        .question-num { font-size: 12px; font-weight: 700; letter-spacing: 2px; color: var(--muted); text-transform: uppercase; margin-bottom: 8px; }
        .question-text { font-size: 16px; font-weight: 600; line-height: 1.6; margin-bottom: 16px; }
        .options-grid { display: flex; flex-direction: column; gap: 10px; }
        .option-label { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); padding: 14px; border-radius: 10px; cursor: pointer; }
        .option-label.selected { background: rgba(0,212,255,0.15); border-color: var(--accent); }
        .option-key { font-family: 'Orbitron', monospace; font-size: 14px; font-weight: 700; color: var(--accent); min-width: 20px; }
        .option-label input[type="radio"] { display: none; }
        
        .text-center { text-align: center; }
        .text-success { color: var(--success); font-weight: bold; }
        .text-danger { color: var(--danger); font-weight: bold; }
        .score-up { color: var(--success); font-size: 20px; }
        .score-down { color: var(--danger); font-size: 20px; }
        .result-card { background: rgba(0,0,0,0.3); padding: 20px; border-radius: 12px; border: 1px solid var(--border); margin-top: 15px; }
        
        .essay-box { text-align: left; }
        textarea.form-control, input.form-control { width: 100%; padding: 12px; background: rgba(0,0,0,0.5); border: 1px solid var(--border); color: white; border-radius: 8px; margin-bottom: 15px; font-family: inherit; font-size: 15px; }
        textarea.form-control { min-height: 100px; resize: vertical; }
        .answer-item { background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid var(--accent); }
        .btn-approve { background: var(--success); color: black; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 10px; }
    </style>
</head>
<body>

<div id="screen-join" class="screen">
    <h1 class="page-title" style="margin-top:16px;">VAT LI 11</h1>
    <div class="panel">
        <div class="panel-title">Tham gia phong choi</div>
        <div class="field">
            <label>Ma Phong</label>
            <input type="text" id="input-room-id" class="input"
                style="text-transform:uppercase; font-family:'Orbitron',monospace; font-size:20px; letter-spacing:6px; text-align:center;"
                placeholder="XXXX" maxlength="6">
        </div>
        <div class="field">
            <label>Ho va Ten</label>
            <input type="text" id="input-name" class="input" placeholder="Nhap ten cua ban...">
        </div>
        <button class="btn" onclick="joinRoom()">VAO PHONG</button>
    </div>
</div>

<div id="screen-lobby" class="screen hidden">
    <div class="panel text-center">
        <div class="panel-title">Phong cho</div>
        <p style="font-size:16px;">Xin chao, <strong id="player-display-name" style="color:var(--accent);">...</strong>!</p>
        <p style="color:var(--muted); margin-top: 15px;">Dang cho giao vien bat dau...</p>
    </div>
</div>

<div id="screen-role" class="screen hidden">
    <div class="panel text-center">
        <div class="panel-title">Phan doi hoan tat</div>
        <p style="font-size:14px; color:var(--muted); margin-bottom:15px;">DOI CUA BAN LA</p>
        <div id="team-badge" class="badge">DANG TINH...</div>
        <p style="color:var(--muted); margin-top: 25px;">Chuan bi bat dau vong 1...</p>
    </div>
</div>

<div id="screen-game" class="screen hidden">
    <div class="sticky-header">
        <div>
            <div class="header-stage" id="display-stage-title">Vong 1</div>
            <div class="header-team" id="display-my-team"></div>
        </div>
        <div class="header-timer" id="game-timer">01:00</div>
    </div>
    <div class="panel">
        <div id="questions-container"></div>
    </div>
    <button id="btn-submit-answers" class="btn btn-success" onclick="submitAnswers()">NOP BAI</button>
</div>

<div id="screen-waiting" class="screen hidden">
    <div class="panel text-center">
        <h2 style="color:var(--success); margin-bottom: 10px;">DA NOP BAI THOI GIAN THUC</h2>
        <div id="quiz-view"></div>
    </div>
</div>

<div id="screen-essay" class="screen hidden">
    <div class="panel" id="game-area-essay"></div>
</div>

<div id="screen-winner" class="screen hidden">
    <div class="panel text-center">
        <h2 style="color:var(--gold); margin-bottom: 20px; font-family: 'Orbitron', monospace;">KET THUC GAME</h2>
        <div id="final-results"></div>
    </div>
</div>

<script>
let katexReady = false;
const pendingRenderTargets = [];

function maybeRenderMath() {
    if (!katexReady) return;
    pendingRenderTargets.forEach(el => {
        if (typeof renderMathInElement === 'function') {
            renderMathInElement(el, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true }
                ],
                throwOnError: false
            });
        }
    });
    pendingRenderTargets.length = 0;
}

function renderMathIn(el) {
    if (!el) return;
    if (katexReady && typeof renderMathInElement === 'function') {
        renderMathInElement(el, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
                { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
        });
    } else {
        pendingRenderTargets.push(el);
    }
}

const socket = io();
let myName = '';
let myRoomId = '';
let myTeam = '';
let submitted = false;

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    window.scrollTo(0, 0);
}

window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
        document.getElementById('input-room-id').value = room.toUpperCase();
        document.getElementById('input-name').focus();
    }
});

function joinRoom() {
    myRoomId = document.getElementById('input-room-id').value.trim().toUpperCase();
    myName = document.getElementById('input-name').value.trim();
    if (!myRoomId || !myName) return alert('Vui long nhap day du Ma Phong va Ten!');

    document.getElementById('player-display-name').innerText = myName;
    showScreen('screen-lobby');
    socket.emit('playerJoinRoom', { roomId: myRoomId, name: myName });
}

socket.on('errorMsg', (msg) => { alert(msg); showScreen('screen-join'); });

socket.on('roleAssignment', (data) => {
    myTeam = data.team;
    const badge = document.getElementById('team-badge');
    if (myTeam === 'A') { badge.className = 'badge badge-a'; badge.innerText = 'DOI A'; }
    else if (myTeam === 'B') { badge.className = 'badge badge-b'; badge.innerText = 'DOI B'; }
    else if (myTeam === 'C') { badge.className = 'badge badge-c'; badge.innerText = 'DOI C (Thanh vien le)'; }
    else { badge.className = 'badge'; badge.innerText = 'SOLO'; }

    document.getElementById('display-my-team').innerText = 'DOI ' + myTeam;
    showScreen('screen-role');
});

socket.on('startStage', (data) => {
    submitted = false;
    showScreen('screen-game');
    document.getElementById('display-stage-title').innerText = `Vong ${data.stageNum} / 10` + (data.isDouble ? ' (X2 DIEM CAU DUNG)' : '');

    const container = document.getElementById('questions-container');
    container.innerHTML = '';

    data.questions.forEach((q, index) => {
        const block = document.createElement('div');
        block.className = 'question-block';
        block.setAttribute('data-qid', q.id);

        const numDiv = document.createElement('div');
        numDiv.className = 'question-num';
        numDiv.textContent = 'CAU ' + (index + 1);

        const textDiv = document.createElement('div');
        textDiv.className = 'question-text';
        textDiv.textContent = q.text;

        const gridDiv = document.createElement('div');
        gridDiv.className = 'options-grid';

        q.choices.forEach(c => {
            const lbl = document.createElement('label');
            lbl.className = 'option-label';
            lbl.addEventListener('click', function() {
                gridDiv.querySelectorAll('.option-label').forEach(l => l.classList.remove('selected'));
                this.classList.add('selected');
                this.querySelector('input').checked = true;
            });

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'q_' + q.id;
            radio.value = c.key;

            const keySpan = document.createElement('span');
            keySpan.className = 'option-key';
            keySpan.textContent = c.key + '.';

            const txtSpan = document.createElement('span');
            txtSpan.className = 'option-text';
            txtSpan.textContent = " " + c.text;

            lbl.appendChild(radio);
            lbl.appendChild(keySpan);
            lbl.appendChild(txtSpan);
            gridDiv.appendChild(lbl);
        });

        block.appendChild(numDiv);
        block.appendChild(textDiv);
        block.appendChild(gridDiv);
        container.appendChild(block);
    });

    renderMathIn(container);
});

socket.on('timerUpdate', (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    const el = document.getElementById('game-timer');
    if (el) el.innerText = `${m}:${s}`;
});

function submitAnswers() {
    if (submitted) return;
    submitted = true;

    const answers = {};
    document.querySelectorAll('.question-block').forEach(block => {
        const qid = block.getAttribute('data-qid');
        const chk = block.querySelector('input[type="radio"]:checked');
        answers[qid] = chk ? chk.value : '';
    });

    socket.emit('submitAnswers', { roomId: myRoomId, answers });
    showScreen('screen-waiting');
}

socket.on('earlyResult', (data) => {
    let deltaText = data.delta >= 0 ? `+${data.delta}` : `${data.delta}`;
    document.getElementById('quiz-view').innerHTML = `
        <div class="result-card">
            <p style="font-size: 16px; margin-bottom: 10px;">So cau dung cua ban: <strong>${data.correct} / ${data.total}</strong></p>
            <p>Bien dong diem so: <strong class="${data.delta >= 0 ? 'score-up' : 'score-down'}">${deltaText} diem</strong></p>
            <p style="margin-top: 15px; font-size: 14px;">Tong diem hien tai: <strong>${data.currentScore} diem</strong></p>
            <p style="margin-top: 20px; color: var(--muted); font-size: 13px;">Vui long cho het thoi gian 60s cua vong...</p>
        </div>
    `;
});

socket.on('intermissionStart', (data) => {
    if (!document.getElementById('screen-game').classList.contains('hidden') && !submitted) {
        submitAnswers();
    }
});

// Essay Round
socket.on('essayRoundRequestQuestion', (data) => {
    showScreen('screen-essay');
    document.getElementById('game-area-essay').innerHTML = `
        <div class="essay-box">
            <h3 style="color:var(--accent); margin-bottom: 15px;">VONG TU LUAN (Doi C)</h3>
            <p style="margin-bottom: 15px;">Ban la nguoi choi doc lap. Hay tao 1 cau hoi tu luan that kho de thach do Doi A va B. Nguoi tra loi dung nhanh nhat se lay duoc toan bo <strong>${data.scoreC} diem</strong> ban da tich luy.</p>
            <input type="text" id="essayQuestionInput" class="form-control" placeholder="Nhap noi dung cau hoi tai day...">
            <button id="btnSendEssayQuestion" class="btn btn-success">XAC NHAN GUI CAU HOI</button>
            <div style="margin-top: 30px;">
                <h4 style="margin-bottom: 15px; color:var(--muted)">DAP AN TU CAC DOI GUI VE (Chon nguoi nhanh/dung nhat):</h4>
                <div id="receivedAnswersList"></div>
            </div>
        </div>
    `;

    document.getElementById('btnSendEssayQuestion').addEventListener('click', () => {
        let text = document.getElementById('essayQuestionInput').value;
        if(text.trim()) {
            socket.emit('submitEssayQuestion', { roomId: myRoomId, questionText: text });
            document.getElementById('essayQuestionInput').disabled = true;
            document.getElementById('btnSendEssayQuestion').style.display = 'none';
        }
    });
});

socket.on('essayRoundNewAnswer', (data) => {
    const list = document.getElementById('receivedAnswersList');
    if (list) {
        const div = document.createElement('div');
        div.className = 'answer-item';
        div.innerHTML = `
            <p style="margin-bottom: 10px;"><strong>${data.name} (Doi ${data.team}):</strong> ${data.answerText}</p>
            <button onclick="approveAnswer('${data.playerId}')" class="btn-approve">CHON DAP AN NAY LA CHUAN NHAT</button>
        `;
        list.appendChild(div);
    }
});

window.approveAnswer = function(playerId) {
    if(confirm('Ban co chac chan chon cau nay lam cau tra loi dung? Diem cua ban se duoc cong vao thanh vien nay.')) {
        socket.emit('chooseBestEssayAnswer', { roomId: myRoomId, playerId: playerId });
    }
};

socket.on('essayRoundWaitingQuestion', (data) => {
    showScreen('screen-essay');
    document.getElementById('game-area-essay').innerHTML = `
        <div class="text-center">
            <h3 style="color:var(--accent); margin-bottom: 15px;">VONG TU LUAN THU THACH</h3>
            <p>Dang cho <strong>${data.creatorName}</strong> (Doi C le) ra de bai...</p>
        </div>
    `;
});

socket.on('essayRoundBroadcastQuestion', (data) => {
    if (myTeam === 'A' || myTeam === 'B') {
        document.getElementById('game-area-essay').innerHTML = `
            <div class="essay-box">
                <h3 style="color:var(--accent); margin-bottom: 15px;">CAU HOI TU ${data.creatorName}:</h3>
                <p style="font-size: 18px; margin-bottom: 20px;"><strong>${data.questionText}</strong></p>
                <textarea id="essayAnswerInput" class="form-control" placeholder="Tra loi nhanh nhat co the vao day de lay diem Doi C..."></textarea>
                <button id="btnSendEssayAnswer" class="btn btn-success">NOP CAU TRA LOI</button>
            </div>
        `;

        document.getElementById('btnSendEssayAnswer').addEventListener('click', () => {
            let ans = document.getElementById('essayAnswerInput').value;
            if(ans.trim()) {
                socket.emit('submitEssayAnswer', { roomId: myRoomId, answerText: ans });
                document.getElementById('game-area-essay').innerHTML = `<div class="text-center"><h3 style="color:var(--success)">DA GUI!</h3><p>Dang cho khao thi quyet dinh nguoi tra loi chuan nhat...</p></div>`;
            }
        });
    }
});

socket.on('gameOver', (data) => {
    showScreen('screen-winner');
    let winHtml = '';
    if (data.winningTeam === 'draw') {
        winHtml = `<h3 style="color:var(--gold); font-size: 24px; margin-bottom: 15px;">HOA NHAU!</h3>`;
    } else {
        winHtml = `<h3 style="color:var(--accent); font-size: 24px; margin-bottom: 15px;">DOI CHIEN THANG: DOI ${data.winningTeam}</h3>`;
    }
    
    let bonusInfo = data.essayBonusDetails ? `
        <div style="margin: 15px 0; padding: 15px; background: rgba(52,211,153,0.1); border: 1px solid var(--success); border-radius: 8px;">
            <p style="color:var(--success); font-weight: bold; font-size: 16px;">
                ${data.essayBonusDetails.winnerName} (Doi ${data.essayBonusDetails.winningTeam}) da nhanh nhat va doat them ${data.essayBonusDetails.bonusPoints} diem tu Doi C!
            </p>
        </div>
    ` : '';
    
    document.getElementById('final-results').innerHTML = `
        ${winHtml}
        <p style="font-size: 18px; margin-bottom: 10px;">Doi A: <strong>${data.scoreA}</strong> | Doi B: <strong>${data.scoreB}</strong></p>
        ${bonusInfo}
        <p style="margin-top: 30px; font-size: 14px; color: var(--muted);">Tro choi da ket thuc. He thong dang duoc khoi dong lai tu admin.</p>
    `;
});

function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
</script>
</body>
</html>
