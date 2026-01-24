// Backend API URL
// Empty string to use relative path (works for both localhost and Vercel if served from same origin)
const API_URL = '/api/check';

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
                // Change Start Button to Review Prize Button
                const btnStart = document.querySelector('.btn-primary');
                if (btnStart) {
                    const btnImg = btnStart.querySelector('img');
                    if (btnImg) {
                        btnImg.src = 'assets/btn-review.png';
                        btnImg.alt = 'Xem lại quà';
                    }
                    // Store prize ID for startProgram to handle
                    currentUserPrize = data.prize_id || data.prize;
                }

                // Show player status msg
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

// Map prize name to ID/Config
function getPrizeConfigByName(prizeName) {
    if (!prizeName) return null;
    const cleanName = prizeName.trim().toLowerCase();

    for (const [id, config] of Object.entries(prizes)) {
        if (config.name.trim().toLowerCase() === cleanName) {
            return config;
        }
    }
    return null;
}

// Helper to find prize by ID (preferred) or Name
function getPrizeConfig(key) {
    if (!key) return null;
    const cleanKey = String(key).trim().toLowerCase();

    for (const config of Object.values(prizes)) {
        if (!config.id) continue;
        const id = config.id.toLowerCase();

        // Match exact, underscore swapped, no dash, or just suffix number
        if (
            cleanKey === id ||
            cleanKey === id.replace('-', '_') ||
            cleanKey === id.replace('-', '') ||
            cleanKey === id.split('-')[1] // Matches "2" against "prize-2"
        ) {
            return config;
        }
    }

    // Legacy Name fallback
    for (const config of Object.values(prizes)) {
        if (config.name && config.name.trim().toLowerCase() === cleanKey) {
            return config;
        }
    }

    return null;
}

function showReviewPopup(prizeKey) {
    console.log("Review prize key:", prizeKey);
    console.log("Available prizes:", prizes);

    if (!prizeKey) {
        alert("Bạn chưa có phần quà nào được ghi nhận.");
        return;
    }

    // Use the robust helper
    const prizeConfig = getPrizeConfig(prizeKey);

    if (prizeConfig) {
        console.log("Prize Config Found:", prizeConfig);
        const popup = document.getElementById('result-popup');
        const resultImage = document.getElementById('result-image');
        const noteElement = document.getElementById('result-note');
        const btnFpoint = document.getElementById('btn-fpoint');
        const btnContact = document.getElementById('btn-contact');

        console.log("DOM Elements:", { popup, resultImage, noteElement, btnFpoint, btnContact });

        if (popup && resultImage) {
            console.log("Setting popup content...");
            resultImage.src = prizeConfig.src;
            if (noteElement) noteElement.innerText = prizeConfig.note;

            if (btnFpoint) btnFpoint.style.display = 'none';
            if (btnContact) btnContact.style.display = 'none';

            if (prizeConfig.type === 'fpoint' && btnFpoint) {
                btnFpoint.style.display = 'flex';
            } else if (prizeConfig.type === 'computer' && btnContact) {
                btnContact.style.display = 'flex';
            }
            popup.style.display = 'flex';
            console.log("Popup display set to flex");
        } else {
            console.error("Critical: Popup or Result Image element missing in DOM");
        }
    } else {
        // Fallback or Handle "Lì xì rỗng" or unknown prize
        const keyStr = String(prizeKey);
        if (keyStr.includes("rỗng")) {
            alert("Lì xì rỗng, chúc bạn may mắn lần sau!");
        } else {
            // Debug alert to help user report issue
            alert("Không tìm thấy thông tin quà cho ID: " + keyStr + ". Vui lòng chụp màn hình gửi admin.");
            console.warn("Unknown prize ID:", keyStr);
        }
    }
}

// Flag to prevent multiple interactions
let isProcessing = false;
let currentUserPrize = null; // Store prize if player has already played

async function startProgram() {
    if (isProcessing) return;

    // Check if we are in "Review Mode"
    if (currentUserPrize) {
        showReviewPopup(currentUserPrize);
        return;
    }

    console.log("User clicked Start");

    const btnStart = document.querySelector('.btn-primary');
    if (btnStart) {
        btnStart.style.opacity = '0.7';
        btnStart.style.pointerEvents = 'none'; // Disable clicks
    }


    isProcessing = true;

    try {
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
            setTimeout(() => { isProcessing = false; }, 500);
        } else {
            isProcessing = false;
        }
    } catch (e) {
        console.error(e);
        isProcessing = false;
    } finally {
        if (btnStart && !isProcessing) {
            // Reset button if we didn't start game (e.g. invalid, or now showing Review button)
            btnStart.style.opacity = '1';
            btnStart.style.pointerEvents = 'auto'; // Re-enable so they can click "Review"
        }
    }
}

function showGifts() {
    if (isProcessing) return;
    console.log("User clicked Gifts");
    const popup = document.getElementById('popup-gift');
    if (popup) {
        popup.style.display = 'flex';
    }
}

function showRules() {
    if (isProcessing) return;
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

        // Background check to update button state proactively?
        // It's better UX to check condition on load too, or just wait for click.
        // User said: "Khi click vào button... thì sẽ kiểm tra" (Wait, user said "update cho màn hình trang chủ... check status check... nếu là Player thì đổi button")
        // This implies we should check on load.
        checkGameCondition().then(res => {
            // If player, logic inside checkGameCondition will have swapped the button.
            // We don't need to do anything else here.
        });

    }, 2000);
});

const prizes = {
    2: { id: 'prize-2', type: 'computer', name: 'Máy tính Casio FX580', src: 'assets/prize-2.png', note: 'CSKH Fahasa sẽ sớm liên hệ hướng dẫn bạn nhận giải' },
    3: { id: 'prize-3', type: 'fpoint', name: '5.000 F-point', src: 'assets/prize-3.png', note: '5K F-Point đã được thêm vào ví của bạn' },
    4: { id: 'prize-4', type: 'fpoint', name: '200.000 F-point', src: 'assets/prize-4.png', note: '200K F-Point đã được thêm vào ví của bạn' },
    // Use 'prize-5' ID to ensure unique lookup, even if user said 'prize-4' for 10k
    5: { id: 'prize-5', type: 'fpoint', name: '10.000 F-point', src: 'assets/prize-5.png', note: '10K F-Point đã được thêm vào ví của bạn' }
};


function showContactInfo() {
    const popup = document.getElementById('popup-contact');
    if (popup) {
        popup.style.display = 'flex';
    }
}

// API Update Function
async function updateGameStatus(prizeName, prizeId) {
    const code = getQueryParam('random_code');
    if (!code) return;

    try {
        await fetch('/api/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code, prize: prizeName, prize_id: prizeId })
        });
        console.log("Updated prize on server:", prizeName, prizeId);
    } catch (error) {
        console.error("Failed to update status:", error);
    }
}

// Game Logic
function selectEnvelope(id) {
    if (isProcessing) return;
    console.log("Selected Envelope ID: " + id);

    // Find the specific element that was clicked
    const envelopes = document.querySelectorAll('.envelope-item');
    const targetEnvelope = envelopes[id - 1];

    if (targetEnvelope) {
        isProcessing = true; // Block other interactions

        // Show result immediately without shaking
        showResult(id);

        // Reset processing state shortly after to allow other interactions if needed
        setTimeout(() => {
            isProcessing = false;
        }, 300);
    } else {
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

        // Store prize ID locally so we know status changed
        currentUserPrize = prizeData.id;

        // Call Update API with ID
        updateGameStatus(prizeData.name, prizeData.id);

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
        updateGameStatus("Lì xì rỗng", "prize-empty");
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
        homePage.style.display = 'block';
    }

    // If we have a prize, update the home screen button to "Review Mode"
    if (currentUserPrize) {
        const btnStart = document.querySelector('.btn-primary');
        if (btnStart) {
            const btnImg = btnStart.querySelector('img');
            if (btnImg) {
                btnImg.src = 'assets/btn-review.png';
                btnImg.alt = 'Xem lại quà';
            }
            // Logic is already handled by startProgram checking currentUserPrize
            // Just need to ensure visuals are updated
            btnStart.style.opacity = '1';
            btnStart.style.pointerEvents = 'auto';
        }
    }
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
