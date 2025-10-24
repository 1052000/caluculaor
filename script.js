let startButton = document.getElementById("startButton");
let timerDisplay = document.getElementById("timer");
let board = document.getElementById("board");

let cards = [];
let flippedCards = [];
let matchedCards = [];
let timer = 0;
let gameStarted = false;
let interval;

startButton.addEventListener("click", startGame);

// 카드 배열 설정
function generateCards() {
    const cardValues = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const cardDeck = [...cardValues, ...cardValues]; // 각 카드 두 개씩 추가
    cards = shuffle(cardDeck);
}

// 카드 섞기
function shuffle(arr) {
    return arr.sort(() => Math.random() - 0.5);
}

// 카드 생성
function createBoard() {
    board.innerHTML = ""; // 기존 카드들 삭제
    for (let i = 0; i < cards.length; i++) {
        const card = document.createElement("div");
        card.classList.add("card");
        card.dataset.value = cards[i];
        card.addEventListener("click", flipCard);
        board.appendChild(card);
    }
}

// 카드 뒤집기
function flipCard(e) {
    if (flippedCards.length < 2 && !matchedCards.includes(e.target) && !flippedCards.includes(e.target)) {
        e.target.textContent = e.target.dataset.value;
        flippedCards.push(e.target);
        
        if (flippedCards.length === 2) {
            checkMatch();
        }
    }
}

// 카드 매칭 확인
function checkMatch() {
    if (flippedCards[0].dataset.value === flippedCards[1].dataset.value) {
        matchedCards.push(flippedCards[0], flippedCards[1]);
        flippedCards = [];
        if (matchedCards.length === cards.length) {
            clearInterval(interval);
            alert("게임 성공! " + timer + "초 만에 맞췄습니다!");
        }
    } else {
        setTimeout(() => {
            flippedCards[0].textContent = "";
            flippedCards[1].textContent = "";
            flippedCards = [];
        }, 1000);
    }
}

// 게임 시작
function startGame() {
    if (gameStarted) return;
    gameStarted = true;
    startButton.disabled = true;
    generateCards();
    createBoard();
    startTimer();
}

// 타이머 시작
function startTimer() {
    timer = 0;
    interval = setInterval(() => {
        timer++;
        timerDisplay.textContent = "초: " + timer;
    }, 1000);
}
