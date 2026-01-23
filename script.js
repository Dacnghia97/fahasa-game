// Backend API URL
const API_URL = 'http://localhost:3000/api/check';

// Utility to get query params
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Function to check game condition via Backend API
async function checkGameCondition() {
    const code = getQueryParam('random_code');

    if (!code) {
        alert("Không tìm thấy mã tham dự (random_code). Vui lòng kiểm tra lại đường dẫn.");
        return false;
    }

    try {
        const response = await fetch(`${API_URL}?code=${code}`);
        const data = await response.json();

        if (data.valid) {
            if (data.status === 'INVITED') {
                return true; // Allowed to play
            } else if (data.status === 'PLAYER') {
                // Show text on Home Page
                const msg = document.getElementById('player-status-msg');
                if (msg) {
                    msg.innerText = "Bạn đã hết lượt chơi";
                    msg.style.display = 'block';
                }
                return false;
            } else if (data.status === 'EXPIRED') {
                // Show Expired Popup
                const expiredPopup = document.getElementById('popup-expired');
                if (expiredPopup) {
                    expiredPopup.style.display = 'flex';
                }
                return false;
            } else {
                alert(`Trạng thái không hợp lệ: ${data.status}`);
                return false;
            }
        } else {
            alert("Mã tham dự không hợp lệ hoặc không tìm thấy.");
            return false;
        }
    } catch (error) {
        console.error("Lỗi kết nối đến server:", error);
        alert("Có lỗi xảy ra khi kiểm tra điều kiện chơi. Vui lòng thử lại sau.");
        return false;
    }
}

async function startProgram() {
    console.log("User clicked Start");

    // Check condition before starting
    const canPlay = await checkGameCondition();

    if (canPlay) {
        // Transition to Game Page
        const homePage = document.getElementById('home-page');
        const gamePage = document.getElementById('game-page');

        if (homePage && gamePage) {
            homePage.style.display = 'none';
            gamePage.style.display = 'flex';
        }
    }
}

function showGifts() {
    console.log("User clicked Gifts");
    const popup = document.getElementById('popup-gift');
    if (popup) {
        popup.style.display = 'flex';
    }
}

function showRules() {
    console.log("User clicked Rules");
    const popup = document.getElementById('popup-rules');
    if (popup) {
        popup.style.display = 'flex';
    }
}

// Popup Logic
window.addEventListener('DOMContentLoaded', () => {
    // strict check for random_code
    const code = getQueryParam('random_code');
    if (!code) {
        // Block access
        document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#004d40;color:white;text-align:center;padding:20px;"><h1>Lỗi Truy Cập</h1><p>Bạn cần có mã tham dự để truy cập trang này.</p></div>';
        return;
    }

    setTimeout(() => {
        const popup = document.getElementById('welcome-popup');
        if (popup) {
            popup.style.display = 'flex';
        }
    }, 2000); // 2 seconds delay
});

const prizes = {
    2: { type: 'computer', name: 'Máy tính Casio FX580', src: 'assets/prize-2.png', note: 'CSKH Fahasa sẽ sớm liên hệ hướng dẫn bạn nhận giải' },
    3: { type: 'fpoint', name: '5.000 F-point', src: 'assets/prize-3.png', note: '5K F-Point đã được thêm vào ví của bạn' },
    4: { type: 'fpoint', name: '200.000 F-point', src: 'assets/prize-4.png', note: '200K F-Point đã được thêm vào ví của bạn' },
    5: { type: 'fpoint', name: '10.000 F-point', src: 'assets/prize-5.png', note: '10K F-Point đã được thêm vào ví của bạn' }
};

function showContactInfo() {
    const popup = document.getElementById('popup-contact');
    if (popup) {
        popup.style.display = 'flex';
    }
}

// API Update Function
async function updateGameStatus(prizeName) {
    const code = getQueryParam('random_code');
    if (!code) return;

    try {
        await fetch('http://localhost:3000/api/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code, prize: prizeName })
        });
        console.log("Updated prize on server:", prizeName);
    } catch (error) {
        console.error("Failed to update status:", error);
    }
}

// Game Logic
function selectEnvelope(id) {
    console.log("Selected Envelope ID: " + id);

    // Find the specific element that was clicked (OR find by ID if we don't pass event)
    // Here we need to find the element. efficient way:
    // We can change onclick="selectEnvelope(1, this)" in HTML, OR find by querying children.
    // Let's assume we find it by index since we have a grid.
    const envelopes = document.querySelectorAll('.envelope-item');
    // id is 1-based, index is 0-based
    const targetEnvelope = envelopes[id - 1];

    if (targetEnvelope) {
        // Add shaking class
        targetEnvelope.classList.add('shaking');

        // Remove float animation temporarily if needed, but shaking overrides usually fine.
        // Wait 1.5 seconds
        setTimeout(() => {
            targetEnvelope.classList.remove('shaking');
            showResult(id);
        }, 1500);
    } else {
        // Fallback if element not found (should not happen)
        showResult(id);
    }
}

function showResult(id) {
    // Reset buttons and note
    const btnFpoint = document.getElementById('btn-fpoint');
    const btnContact = document.getElementById('btn-contact');
    const noteElement = document.getElementById('result-note');

    if (btnFpoint) btnFpoint.style.display = 'none';
    if (btnContact) btnContact.style.display = 'none';
    if (noteElement) noteElement.innerText = '';

    // Check if envelope has a prize
    if (prizes[id]) {
        const popup = document.getElementById('result-popup');
        const resultImage = document.getElementById('result-image');
        const prizeData = prizes[id];

        // Call Update API
        updateGameStatus(prizeData.name);

        if (popup && resultImage) {
            resultImage.src = prizeData.src;

            // Set note text
            if (noteElement && prizeData.note) {
                noteElement.innerText = prizeData.note;
            }

            // Show relevant button
            if (prizeData.type === 'fpoint' && btnFpoint) {
                btnFpoint.style.display = 'flex'; // or block/inline-flex
            } else if (prizeData.type === 'computer' && btnContact) {
                btnContact.style.display = 'flex';
            }

            popup.style.display = 'flex';

            // Trigger Fireworks
            triggerFireworks();
        }
    } else {
        // Empty envelope
        updateGameStatus("Lì xì rỗng");
        alert("Lì xì rỗng, chúc bạn may mắn lần sau!");
    }
}

function triggerFireworks() {
    var duration = 3 * 1000;
    var animationEnd = Date.now() + duration;
    var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    var interval = setInterval(function () {
        var timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        var particleCount = 50 * (timeLeft / duration);
        // since particles fall down, start a bit higher than random
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
}

function closeResultPopup() {
    const popup = document.getElementById('result-popup');
    if (popup) {
        popup.style.display = 'none';
    }
}

function goHome() {
    closeResultPopup();
    const homePage = document.getElementById('home-page');
    const gamePage = document.getElementById('game-page');

    if (homePage && gamePage) {
        gamePage.style.display = 'none';
        homePage.style.display = 'block'; // Or 'flex' depending on original
    }

    // Optional: Reset grid/envelopes if needed?
    // For now, simple navigation back.
}
function closePopup() {
    const popups = document.querySelectorAll('.popup-overlay');
    popups.forEach(popup => {
        // Don't close result-popup if we are just closing a child popup? 
        // Actually, let's just make a specific function for the new need.
        // Existing behavior for others is fine.
        popup.style.display = 'none';
    });
}

function closeSpecificPopup(id) {
    const popup = document.getElementById(id);
    if (popup) {
        popup.style.display = 'none';
    }
}
