const path = require('path');

// --- A KVÍZ "AGYA" ---
let currentQ   = -1;
let revealed   = false;
let votes      = [ [0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0] ];
let participants = {};

// ── SZOBA NEVEK ──────────────────────────────────────────────────────────────
// A kvíz üzenetek CSAK a 'quiz_room' szobában lévő klienseknek mennek!
// A dashboard kliensek SOHA nem csatlakoznak ebbe a szobába → nincs lag.
const QUIZ_ROOM  = 'quiz_room';
const ADMIN_ROOM = 'quiz_admin_room';

// Segédfüggvény: küld a kvízes játékosoknak + adminoknak
const toQuiz  = (io) => io.to(QUIZ_ROOM).to(ADMIN_ROOM);
// Küld csak az adminoknak
const toAdmin = (io) => io.to(ADMIN_ROOM);

// --- BIZTONSÁGI PAJZS (Basic Auth) ---
const requirePassword = (req, res, next) => {
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [, password] = Buffer.from(b64auth, 'base64').toString().split(':');
    if (password === '01') return next();
    res.set('WWW-Authenticate', 'Basic realm="GrexAir Admin"');
    res.status(401).send('Hozzáférés megtagadva.');
};

module.exports = function(app, io) {

    // ── HTTP ÚTVONALAK ────────────────────────────────────────────────────────
    app.get('/quiz',       (req, res) => res.sendFile(path.join(__dirname, 'quiz.html')));
    app.get('/quiz-admin', requirePassword, (req, res) => res.sendFile(path.join(__dirname, 'quiz-admin.html')));

    // ── SOCKET.IO LOGIKA ──────────────────────────────────────────────────────
    if (!io) return;

    io.on('connection', (socket) => {

        // ── JÁTÉKOS CSATLAKOZIK ───────────────────────────────────────────────
        socket.on('quiz_join', (data) => {
            // ★ BELÉP A QUIZ SZOBÁBA — a dashboard kliensek nem kerülnek ide
            socket.join(QUIZ_ROOM);

            const sid = data.sessionId || socket.id;
            socket.sessionId = sid;

            if (!participants[sid]) {
                participants[sid] = { name: data.name, votes: [-1,-1,-1,-1,-1], active: true };
            } else {
                participants[sid].active = true;
                if (data.name) participants[sid].name = data.name;
            }

            // Csak quiz szobának + adminnak → nem zavarja a dashboardot!
            toQuiz(io).emit('participant_update', participants);

            // Csak ennek a kliensnek
            socket.emit('quiz_restore', {
                currentQ,
                myVotes: participants[sid].votes
            });

            if (currentQ >= 0 && currentQ < 99) {
                socket.emit('quiz_question', { index: currentQ, votes: votes[currentQ] });
            }
        });

        // ── JÁTÉKOS SZAVAZ ────────────────────────────────────────────────────
        socket.on('quiz_vote', (data) => {
            const sid = socket.sessionId;
            if (currentQ === data.question && participants[sid]) {
                if (participants[sid].votes[currentQ] === -1) {
                    participants[sid].votes[currentQ] = data.option;
                    votes[currentQ][data.option]++;
                    // Csak quiz szobának
                    toQuiz(io).emit('quiz_votes', { question: currentQ, votes: votes[currentQ] });
                    toQuiz(io).emit('participant_update', participants);
                }
            }
        });

        // ── ADMIN CSATLAKOZIK ─────────────────────────────────────────────────
        socket.on('quiz_admin_join', () => {
            // ★ Admin belép a saját szobájába is
            socket.join(QUIZ_ROOM);
            socket.join(ADMIN_ROOM);
            socket.emit('quiz_state', { currentQ, revealed, votes, participants });
        });

        // ── ADMIN: INDÍTÁS ────────────────────────────────────────────────────
        socket.on('quiz_admin_start', () => {
            currentQ = 0;
            revealed = false;
            toQuiz(io).emit('quiz_question', { index: currentQ, votes: votes[currentQ] });
            toAdmin(io).emit('quiz_state', { currentQ, revealed, votes, participants });
        });

        // ── ADMIN: HELYES VÁLASZ ──────────────────────────────────────────────
        socket.on('quiz_admin_reveal', () => {
            revealed = true;
            toAdmin(io).emit('quiz_state', { currentQ, revealed, votes, participants });
        });

        // ── ADMIN: KÖVETKEZŐ ─────────────────────────────────────────────────
        socket.on('quiz_admin_next', () => {
            if (currentQ < 4) {
                currentQ++;
                revealed = false;
                toQuiz(io).emit('quiz_question', { index: currentQ, votes: votes[currentQ] });
            } else {
                currentQ = 99;
                toQuiz(io).emit('quiz_end');
            }
            toAdmin(io).emit('quiz_state', { currentQ, revealed, votes, participants });
        });

        // ── ADMIN: RESET ──────────────────────────────────────────────────────
        socket.on('quiz_admin_reset', () => {
            currentQ   = -1;
            revealed   = false;
            votes      = [ [0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0] ];
            participants = {};
            toQuiz(io).emit('quiz_reset');
            toAdmin(io).emit('quiz_state', { currentQ, revealed, votes, participants });
        });

        // ── LELÉPÉS / F5 ──────────────────────────────────────────────────────
        socket.on('disconnect', () => {
            const sid = socket.sessionId;
            if (sid && participants[sid]) {
                participants[sid].active = false;
                // Csak quiz szobának küldünk — dashboard nem kapja
                toQuiz(io).emit('participant_update', participants);
            }
        });
    });
};
