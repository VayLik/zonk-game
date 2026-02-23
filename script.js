// --- 1. ПЕРЕМИКАННЯ МОВ ---
function switchLang(lang) {
    document.getElementById('rules-en').classList.toggle('hidden', lang !== 'en');
    document.getElementById('rules-ru').classList.toggle('hidden', lang !== 'ru');
    document.getElementById('lang-en').classList.toggle('active', lang === 'en');
    document.getElementById('lang-ru').classList.toggle('active', lang === 'ru');
}

// ГЕНЕРАЦІЯ 2D КУБИКІВ (Для правил)
function createFlatDie(value) {
    const die = document.createElement('div');
    die.className = 'flat-die'; die.dataset.face = value;
    for (let i = 0; i < value; i++) {
        const dot = document.createElement('div'); dot.className = 'dot'; die.appendChild(dot);
    }
    return die;
}
document.querySelectorAll('.example-dice, .example-dice-small').forEach(container => {
    container.innerHTML = '';
    container.dataset.dice.split(',').map(Number).forEach(val => container.appendChild(createFlatDie(val)));
});

// --- 2. ЛОГІКА ЕКРАНІВ ТА НІКНЕЙМІВ ---
let myNickname = sessionStorage.getItem('zonk_nickname') || '';
let opponentName = "Bot";
let gameMode = "bot"; // "bot" або "pvp"

const screens = {
    login: document.getElementById('login-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen')
};

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
}

// Якщо нік вже є — кидаємо відразу в лобі
if (myNickname) {
    document.getElementById('display-nickname').innerText = myNickname;
    showScreen('lobby');
}

document.getElementById('btn-save-nick').addEventListener('click', () => {
    const input = document.getElementById('nickname-input').value.trim();
    if (input) {
        myNickname = input;
        sessionStorage.setItem('zonk_nickname', myNickname);
        document.getElementById('display-nickname').innerText = myNickname;
        showScreen('lobby');
    }
});

// --- 3. ОБРОБКА КНОПОК ЛОБІ ---
document.getElementById('btn-play-bot').addEventListener('click', () => {
    gameMode = "bot";
    opponentName = "Bot";
    document.getElementById('player-name-label').innerText = myNickname;
    document.getElementById('opponent-name-label').innerText = opponentName;
    showScreen('game');
});

document.getElementById('btn-create-room').addEventListener('click', () => {
    document.getElementById('lobby-status').innerText = "Сервер ще не підключено! Очікуйте наступного кроку.";
});
document.getElementById('btn-join-room').addEventListener('click', () => {
    document.getElementById('lobby-status').innerText = "Сервер ще не підключено! Очікуйте наступного кроку.";
});


// --- 4. ОСНОВНА ГРА (З КНОПКОЮ РЕМАТЧУ) ---
let scores = { Player: 0, Bot: 0 };
let currentTurnScore = 0, tempSelectedScore = 0;
let activePlayer = "Player", diceCount = 6, targetScore = 10000;

const faceRotations = { 1:{x:0,y:0}, 2:{x:-90,y:0}, 3:{x:0,y:-90}, 4:{x:0,y:90}, 5:{x:90,y:0}, 6:{x:0,y:180} };

const elements = {
    setupPanel: document.getElementById('setup-panel'), targetScoreInput: document.getElementById('target-score-input'),
    startGameBtn: document.getElementById('btn-start-game'), diceContainer: document.getElementById('dice-container'),
    rollBtn: document.getElementById('btn-roll'), bankBtn: document.getElementById('btn-bank'),
    turnScoreDisplay: document.getElementById('turn-score'), currentTurnDisplay: document.getElementById('current-turn'),
    messageLog: document.getElementById('message-log')
};

elements.rollBtn.disabled = true; elements.bankBtn.disabled = true;

elements.startGameBtn.addEventListener('click', () => {
    targetScore = parseInt(elements.targetScoreInput.value) || 10000;
    elements.setupPanel.style.display = 'none';
    elements.currentTurnDisplay.innerText = myNickname; // Показуємо нік
    elements.messageLog.innerText = `Game started! First to ${targetScore} wins. Your turn, ${myNickname}!`;
    elements.rollBtn.disabled = false;
});

// ФУНКЦІЯ РЕМАТЧУ
function resetGame() {
    scores = { Player: 0, Bot: 0 };
    currentTurnScore = 0; tempSelectedScore = 0; diceCount = 6;
    activePlayer = "Bot"; // Трюк: ставимо бота, щоб switchTurn перемикнув на Player
    document.getElementById('Player-total').innerText = 0;
    document.getElementById('Bot-total').innerText = 0;
    elements.turnScoreDisplay.innerText = 0;
    elements.diceContainer.innerHTML = '';
    elements.setupPanel.style.display = 'block'; // Повертаємо вибір очок
    elements.rollBtn.disabled = true; elements.bankBtn.disabled = true;
    elements.messageLog.innerText = "Game reset. Set target score to start new game.";
    switchTurn();
}

function calculateSelectedScore(arr) {
    if (arr.length === 0) return 0;
    let counts = {1:0, 2:0, 3:0, 4:0, 5:0, 6:0}; arr.forEach(val => counts[val]++);
    let score = 0, validDiceCount = 0;
    if (counts[1]===1 && counts[2]===1 && counts[3]===1 && counts[4]===1 && counts[5]===1 && counts[6]===1) return 1500;
    let pairs = 0; for (let i = 1; i <= 6; i++) { if (counts[i] === 2) pairs++; else if (counts[i] === 4) pairs += 2; else if (counts[i] === 6) pairs += 3; }
    if (pairs === 3) return 1500;
    for (let i = 1; i <= 6; i++) {
        if (counts[i] >= 3) { score += (i === 1 ? 1000 : i * 100) * Math.pow(2, counts[i] - 3); validDiceCount += counts[i]; }
        else if (i === 1) { score += counts[i] * 100; validDiceCount += counts[i]; }
        else if (i === 5) { score += counts[i] * 50; validDiceCount += counts[i]; }
    }
    return validDiceCount !== arr.length ? -1 : score;
}

function hasScoringDice(arr) {
    let counts = {1:0, 2:0, 3:0, 4:0, 5:0, 6:0}; arr.forEach(val => counts[val]++);
    if (counts[1] > 0 || counts[5] > 0) return true;
    for (let i = 2; i <= 6; i++) if (counts[i] >= 3) return true;
    let pairs = 0; for (let i = 1; i <= 6; i++) if (counts[i] >= 2) pairs++; return pairs === 3;
}

function renderDiceWithAnimation(diceArray, callback) {
    elements.diceContainer.innerHTML = '';
    const diceElements = [];
    diceArray.forEach((val) => {
        const wrapper = document.createElement('div'); wrapper.className = 'cube-wrapper'; wrapper.dataset.value = val;
        const cube = document.createElement('div'); cube.className = 'cube';
        for (let i = 1; i <= 6; i++) {
            const side = document.createElement('div'); side.className = `side side-${i}`; side.dataset.face = i;
            for (let d = 0; d < i; d++) { const dot = document.createElement('div'); dot.className = 'dot'; side.appendChild(dot); }
            cube.appendChild(side);
        }
        wrapper.appendChild(cube); elements.diceContainer.appendChild(wrapper);
        cube.style.transform = `rotateX(${Math.floor(Math.random()*360)}deg) rotateY(${Math.floor(Math.random()*360)}deg) rotateZ(${Math.floor(Math.random()*360)}deg)`;
        diceElements.push({ wrapper, cube, val });
    });
    void elements.diceContainer.offsetWidth; 
    diceElements.forEach((item) => {
        item.cube.style.transition = `transform ${(Math.random() * 0.6 + 0.6).toFixed(2)}s cubic-bezier(0.25, 1, 0.5, 1)`;
        const signX = Math.random()>0.5?1:-1, signY = Math.random()>0.5?1:-1, signZ = Math.random()>0.5?1:-1;
        const target = faceRotations[item.val];
        item.cube.style.transform = `rotateX(${target.x + ((Math.floor(Math.random()*4)+2)*360*signX)}deg) rotateY(${target.y + ((Math.floor(Math.random()*4)+2)*360*signY)}deg) rotateZ(${((Math.floor(Math.random()*3)+2)*360*signZ)}deg)`;
    });
    setTimeout(() => {
        diceElements.forEach((item) => {
            if (activePlayer === "Player") {
                item.wrapper.addEventListener('click', () => { item.wrapper.classList.toggle('selected'); updateSelectedScore(); });
            }
        });
        if (callback) callback();
    }, 1300);
}

function updateSelectedScore() {
    const selectedDice = Array.from(document.querySelectorAll('#dice-container .cube-wrapper.selected'));
    const selectedValues = selectedDice.map(die => parseInt(die.dataset.value));
    tempSelectedScore = calculateSelectedScore(selectedValues);
    if (tempSelectedScore > 0) {
        elements.turnScoreDisplay.innerText = currentTurnScore + tempSelectedScore;
        elements.rollBtn.disabled = false; elements.bankBtn.disabled = false;
        elements.rollBtn.innerText = "Roll Remaining";
        elements.messageLog.innerText = `Valid combo! Selected ${tempSelectedScore} points.`;
    } else {
        elements.turnScoreDisplay.innerText = currentTurnScore;
        elements.rollBtn.disabled = true; elements.bankBtn.disabled = true;
        elements.rollBtn.innerText = "Roll Dice";
        elements.messageLog.innerText = selectedValues.length > 0 ? "Invalid combination!" : "Select scoring dice to continue.";
    }
}

function switchTurn() {
    currentTurnScore = 0; tempSelectedScore = 0; diceCount = 6;
    elements.turnScoreDisplay.innerText = 0; elements.rollBtn.innerText = "Roll Dice";
    document.getElementById(`${activePlayer}-panel`).classList.remove('active');
    activePlayer = activePlayer === "Player" ? "Bot" : "Player";
    document.getElementById(`${activePlayer}-panel`).classList.add('active');
    
    // Показуємо правильний нік у статусі ходу
    elements.currentTurnDisplay.innerText = activePlayer === "Player" ? myNickname : opponentName; 
    elements.diceContainer.innerHTML = '';
    
    if (activePlayer === "Bot" && gameMode === "bot") {
        elements.rollBtn.disabled = true; elements.bankBtn.disabled = true;
        setTimeout(playBotTurn, 1000);
    } else if (activePlayer === "Player" && elements.setupPanel.style.display === 'none') {
        elements.rollBtn.disabled = false; elements.bankBtn.disabled = true;
        elements.messageLog.innerText = `Your turn, ${myNickname}! Roll the dice.`;
    }
}

elements.rollBtn.addEventListener('click', () => {
    if (tempSelectedScore > 0) {
        currentTurnScore += tempSelectedScore;
        diceCount -= document.querySelectorAll('#dice-container .cube-wrapper.selected').length;
        tempSelectedScore = 0;
        if (diceCount === 0) diceCount = 6; 
    }
    elements.rollBtn.disabled = true; elements.bankBtn.disabled = true;
    elements.messageLog.innerText = "Rolling...";
    let rollResult = [];
    for (let i = 0; i < diceCount; i++) rollResult.push(Math.floor(Math.random() * 6) + 1);
    renderDiceWithAnimation(rollResult, () => {
        if (!hasScoringDice(rollResult)) {
            elements.messageLog.innerText = `ZONK! ${activePlayer === 'Player' ? myNickname : opponentName} rolled no combos.`;
            setTimeout(switchTurn, 2000);
        } else if (activePlayer === "Player") {
            elements.messageLog.innerText = "Select scoring combinations.";
        }
    });
});

elements.bankBtn.addEventListener('click', () => {
    scores[activePlayer] += (currentTurnScore + tempSelectedScore);
    document.getElementById(`${activePlayer}-total`).innerText = scores[activePlayer];
    
    let displayName = activePlayer === "Player" ? myNickname : opponentName;
    
    if (scores[activePlayer] >= targetScore) {
        elements.messageLog.innerHTML = `🎉 ${displayName} WINS with ${scores[activePlayer]} points! 🎉<br><button id="btn-rematch" class="btn-rematch">🔄 Rematch</button>`;
        elements.rollBtn.disabled = true; elements.bankBtn.disabled = true;
        document.getElementById('btn-rematch').addEventListener('click', resetGame);
        return;
    }
    
    elements.messageLog.innerText = `${displayName} banked ${currentTurnScore + tempSelectedScore} points!`;
    elements.rollBtn.disabled = true; elements.bankBtn.disabled = true; 
    setTimeout(switchTurn, 1500);
});

// ЛОГІКА РОЗУМНОГО БОТА (Без змін, працює ідеально)
function getBestBotScore(arr) { /* ... код підрахунку ... */ 
    let counts = {1:0, 2:0, 3:0, 4:0, 5:0, 6:0}; arr.forEach(val => counts[val]++);
    let score = 0, scoringDice = 0;
    if (arr.length === 6) {
        let pairs = 0; for (let i = 1; i <= 6; i++) if (counts[i] >= 2) pairs++;
        if (counts[1] && counts[2] && counts[3] && counts[4] && counts[5] && counts[6]) return { score: 1500, dice: 6 };
        if (pairs === 3) return { score: 1500, dice: 6 };
    }
    for (let i = 1; i <= 6; i++) {
        if (counts[i] >= 3) { score += (i === 1 ? 1000 : i * 100) * Math.pow(2, counts[i] - 3); scoringDice += counts[i]; counts[i] = 0; }
    }
    score += counts[1] * 100; scoringDice += counts[1]; score += counts[5] * 50; scoringDice += counts[5];
    return { score, dice: scoringDice };
}

function playBotTurn() {
    if (scores.Player >= targetScore || scores.Bot >= targetScore) return;
    elements.messageLog.innerText = `${opponentName} is calculating probabilities...`;
    let rollResult = [];
    for (let i = 0; i < diceCount; i++) rollResult.push(Math.floor(Math.random() * 6) + 1);

    renderDiceWithAnimation(rollResult, () => {
        if (!hasScoringDice(rollResult)) {
            elements.messageLog.innerText = `ZONK! ${opponentName} pushed too hard.`;
            setTimeout(switchTurn, 2000);
        } else {
            let botResult = getBestBotScore(rollResult);
            currentTurnScore += botResult.score;
            elements.turnScoreDisplay.innerText = currentTurnScore;
            diceCount -= botResult.dice;
            let hotDice = false;
            if (diceCount === 0) { diceCount = 6; hotDice = true; }

            setTimeout(() => {
                let shouldRollAgain = false;
                let botTotalPotential = scores.Bot + currentTurnScore;

                if (botTotalPotential >= targetScore) shouldRollAgain = false;
                else if (hotDice) { shouldRollAgain = true; elements.messageLog.innerText = `${opponentName} got Hot Dice! Rolling all 6...`; } 
                else if (scores.Player >= targetScore * 0.8 && scores.Bot < scores.Player) {
                    if (diceCount >= 3) shouldRollAgain = true;
                    else if (diceCount === 2 && currentTurnScore < 1000) shouldRollAgain = true;
                    else if (diceCount === 1 && currentTurnScore < 400) shouldRollAgain = true;
                } else {
                    if (diceCount >= 4) shouldRollAgain = currentTurnScore < 1500; 
                    else if (diceCount === 3) shouldRollAgain = currentTurnScore < 600;
                    else if (diceCount === 2) shouldRollAgain = currentTurnScore < 300;
                    else if (diceCount === 1) shouldRollAgain = false;
                }

                if (shouldRollAgain && !hotDice) {
                    elements.messageLog.innerText = `${opponentName} has ${diceCount} dice left. Decides to push its luck!`;
                    setTimeout(playBotTurn, 1500);
                } else if (shouldRollAgain && hotDice) {
                    setTimeout(playBotTurn, 1500); 
                } else {
                    elements.messageLog.innerText = `${opponentName} analyzes the risk and banks ${currentTurnScore} points.`;
                    setTimeout(() => { elements.bankBtn.disabled = false; elements.bankBtn.click(); }, 1200); 
                }
            }, 1500);
        }
    });
}