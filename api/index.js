const express = require('express');
require('dotenv').config();
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Serve static files from the public directory (for local development)
app.use(express.static(path.join(__dirname, '../public')));

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// ===== CONFIG =====
const NOCODB_API_URL = 'https://nocodb.smax.in/api/v2/tables/mkuczx2ud6zitcr/records';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN;

if (!NOCODB_TOKEN) {
    console.warn("WARNING: NOCODB_TOKEN is missing from environment variables.");
}

// ===== CHECK CONDITION =====
app.get('/api/check', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing random_code' });
    
    // Sanitize code to prevent injection (Alphanumeric only)
    if (!/^[a-zA-Z0-9]+$/.test(code)) {
        return res.status(400).json({ error: 'Invalid code format' });
    }

    if (!NOCODB_TOKEN) return res.status(500).json({ error: 'Server misconfiguration: Missing Token' });

    try {
        const whereClause = `(random_code,eq,${code})`;
        const response = await axios.get(NOCODB_API_URL, {
            headers: { 'xc-token': NOCODB_TOKEN },
            params: { where: whereClause, limit: 1 }
        });

        const record = response.data.list?.[0];
        if (!record) return res.json({ valid: false });

        res.json({
            valid: true,
            status: record.status,
            prize: record.prize,
            prize_id: record.prize_id // Return prize_id
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});
// ===== UPDATE STATUS & PLAY GAME =====
// ===== PRIZE CONFIGURATION =====
// Adjust limits via Environment Variables on Railway
// Defaults are set to Production values
const PRIZE_LIMITS = {
    'prize-2': parseInt(process.env.PRIZE_LIMIT_2 || '0'),      // Máy tính
    'prize-3': parseInt(process.env.PRIZE_LIMIT_3 || '1'),   // 5k Fpoint
    'prize-4': parseInt(process.env.PRIZE_LIMIT_4 || '0'),     // 200k Fpoint
    'prize-5': parseInt(process.env.PRIZE_LIMIT_5 || '0')     // 10k Fpoint
};

const PRIZE_NAMES = {
    'prize-2': 'Máy tính Casio FX580',
    'prize-3': '5.000 F-point',
    'prize-4': '200.000 F-point',
    'prize-5': '10.000 F-point'
};

// Prize Cache
let prizeCache = {
    data: null,
    lastFetch: 0,
    TTL: 15000 // 15 seconds
};

// In-memory Lock for Concurrency Control (Single Instance)
const processingCodes = new Set();

// GLOBAL MUTEX for Prize Allocation (Prevent Race Condition between users)
// Simple Promise-based Queue to serialize critical section
let prizeAllocationMutex = Promise.resolve();

function withPrizeLock(task) {
    const result = prizeAllocationMutex.then(() => task());
    // Catch errors so the queue doesn't stall, but we let the caller handle the error via the returned promise
    prizeAllocationMutex = result.catch(() => {});
    return result;
}

// Helper: Get Current Prize Counts from NocoDB
async function getPrizeCounts() {
    // Return cached data if valid
    if (prizeCache.data && (Date.now() - prizeCache.lastFetch < prizeCache.TTL)) {
        return prizeCache.data;
    }

    const counts = {};
    const promises = Object.keys(PRIZE_LIMITS).map(async (prizeId) => {
        try {
            const whereClause = `(prize_id,eq,${prizeId})`;
            const res = await axios.get(NOCODB_API_URL, {
                headers: { 'xc-token': NOCODB_TOKEN },
                params: {
                    where: whereClause,
                    limit: 1 // We only need the count metadata
                }
            });
            // NocoDB V2 usually returns { list: [], pageInfo: { totalRows: 10 } }
            counts[prizeId] = res.data.pageInfo?.totalRows ?? 0;
        } catch (e) {
            console.error(`Error counting ${prizeId}:`, e.message);
            counts[prizeId] = 0;
        }
    });
    await Promise.all(promises);

    // Update Cache
    prizeCache.data = counts;
    prizeCache.lastFetch = Date.now();

    return counts;
}

// Helper: Pick a Random Prize based on weights (remaining quantity)
function pickRandomPrize(currentCounts) {
    const availablePrizes = [];

    // Calculate remaining quantity for each prize
    for (const [id, limit] of Object.entries(PRIZE_LIMITS)) {
        const used = currentCounts[id] || 0;
        const remaining = Math.max(0, limit - used);

        if (remaining > 0) {
            availablePrizes.push({ id, weight: remaining });
        }
    }

    if (availablePrizes.length === 0) {
        return null; // Out of stock
    }

    // Weighted Random Selection
    const totalWeight = availablePrizes.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;

    for (const prize of availablePrizes) {
        if (random < prize.weight) {
            return prize.id;
        }
        random -= prize.weight;
    }

    return availablePrizes[availablePrizes.length - 1].id; // Fallback
}

app.post('/api/update', async (req, res) => {
    const { code, status } = req.body;
    // NOTE: We ignore 'prize' and 'prize_id' from client when status is PLAYER
    // because Server now decides the prize.

    if (!NOCODB_TOKEN) return res.status(500).json({ error: 'Server misconfiguration: Missing Token' });

    if (!code) {
        return res.status(400).json({ error: 'Missing code' });
    }

    // Sanitize code to prevent injection
    if (!/^[a-zA-Z0-9]+$/.test(code)) {
        return res.status(400).json({ error: 'Invalid code format' });
    }

    // CONCURRENCY LOCK: Prevent same code from being processed multiple times simultaneously
    if (processingCodes.has(code)) {
        return res.status(429).json({ error: 'Request is being processed. Please wait.' });
    }
    
    // Acquire Lock
    processingCodes.add(code);

    const targetStatus = status || 'PLAYER';

    try {
        // 1. Find the Record
        const whereClause = `(random_code,eq,${code})`;
        const findRes = await axios.get(NOCODB_API_URL, {
            headers: { 'xc-token': NOCODB_TOKEN },
            params: { where: whereClause, limit: 1 }
        });

        const record = findRes.data.list?.[0];
        if (!record) {
            return res.status(404).json({ error: 'Record not found' });
        }

        // 2. Cheat Protection Logic
        if (targetStatus === 'OPENNING') {
            // Allow OPENNING -> OPENNING (Idempotency / Multi-tab support)
            if (record.status === 'OPENNING') {
                 return res.json({ success: true, status: 'OPENNING' });
            }

            if (record.status !== 'INVITED') {
                // Idempotency: If already OPENNING (same session), assume retry? 
                // But typically client handles that. Server blocks strictly.
                // Unless it's the SAME device re-sending? 
                // For safety: strict block.
                const response = { error: 'Start blocked', currentStatus: record.status };
                if (record.status === 'PLAYER') {
                    response.prize = record.prize;
                    response.prize_id = record.prize_id;
                }
                return res.status(409).json(response);
            }
            // Just update status to OPENNING
            try {
                await axios.patch(NOCODB_API_URL, { Id: record.Id, status: 'OPENNING' }, { headers: { 'xc-token': NOCODB_TOKEN } });
                return res.json({ success: true, status: 'OPENNING' });
            } catch (patchError) {
                console.error("NocoDB Patch Error:", patchError.response?.data || patchError.message);
                return res.status(500).json({ error: 'Database update failed' });
            }
        }

        if (targetStatus === 'PLAYER') {
            // If already played, return the existing prize (Don't roll again)
            if (record.status === 'PLAYER') {
                return res.json({
                    success: true,
                    status: 'PLAYER',
                    prize: record.prize,
                    prize_id: record.prize_id,
                    is_existing: true // Flag to tell client this is an old prize
                });
            }

            // Ensure valid transition (must lie in OPENNING or INVITED)
            if (record.status !== 'INVITED' && record.status !== 'OPENNING') {
                return res.status(409).json({ error: 'Check blocked', currentStatus: record.status });
            }

            // 3. LOTTERY LOGIC (Server Side) - WRAPPED IN GLOBAL MUTEX
            // Critical Section: Read Count -> Check Limit -> Update DB
            // Only ONE request can execute this block at a time.
            const allocationResult = await withPrizeLock(async () => {
                // Double check status inside lock in case it changed while waiting
                // (Optional but good practice if we were re-fetching record, 
                // but here we rely on the fact that THIS code is locked by processingCodes per user,
                // so we just need to protect the PRIZE COUNTS).
                
                // Force invalidation of cache to ensure fresh count in critical section
                prizeCache.lastFetch = 0; 
                
                const currentCounts = await getPrizeCounts();
                const winningPrizeId = pickRandomPrize(currentCounts);

                if (!winningPrizeId) {
                    return { success: false, error: 'OUT_OF_STOCK' };
                }

                const winningPrizeName = PRIZE_NAMES[winningPrizeId];

                // 4. Update NocoDB (The Commit)
                try {
                     await axios.patch(
                        NOCODB_API_URL,
                        {
                            Id: record.Id,
                            status: 'PLAYER',
                            prize: winningPrizeName,
                            prize_id: winningPrizeId
                        },
                        { headers: { 'xc-token': NOCODB_TOKEN } }
                    );
                } catch (dbError) {
                    console.error("DB Update Failed inside Lock:", dbError);
                    return { success: false, error: 'DB_ERROR' };
                }
                
                // Update Cache Immediately inside lock to reflect new state for next person
                if (winningPrizeId && prizeCache.data) {
                    prizeCache.data[winningPrizeId] = (prizeCache.data[winningPrizeId] || 0) + 1;
                }

                return { 
                    success: true, 
                    data: {
                        status: 'PLAYER',
                        prize: winningPrizeName,
                        prize_id: winningPrizeId
                    }
                };
            });

            if (!allocationResult.success) {
                if (allocationResult.error === 'OUT_OF_STOCK') {
                     return res.status(422).json({ error: 'All prizes are out of stock!' });
                }
                return res.status(500).json({ error: 'Transaction failed' });
            }

            const resultData = allocationResult.data;
            console.log(`User ${code} won ${resultData.prize_id} (${resultData.prize})`);

            return res.json({
                success: true,
                status: 'PLAYER',
                prize: resultData.prize,
                prize_id: resultData.prize_id
            });
        }

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ error: 'Update failed' });
    } finally {
        // Release Lock
        processingCodes.delete(code);
    }
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;