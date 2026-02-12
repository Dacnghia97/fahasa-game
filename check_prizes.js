require('dotenv').config();
const axios = require('axios');

const NOCODB_API_URL = 'https://nocodb.smax.in/api/v2/tables/mkuczx2ud6zitcr/records';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN;

const PRIZE_LIMITS = {
    'prize-2': parseInt(process.env.PRIZE_LIMIT_2 || '1'),
    'prize-3': parseInt(process.env.PRIZE_LIMIT_3 || '2'),
    'prize-4': parseInt(process.env.PRIZE_LIMIT_4 || '1'),
    'prize-5': parseInt(process.env.PRIZE_LIMIT_5 || '1')
};

const PRIZE_NAMES = {
    'prize-2': 'Máy tính Casio FX580',
    'prize-3': '5.000 F-point',
    'prize-4': '200.000 F-point',
    'prize-5': '10.000 F-point'
};

async function checkPrizes() {
    console.log('Checking Prize Counts...');
    console.log('--------------------------------------------------');

    if (!NOCODB_TOKEN) {
        console.error("ERROR: NOCODB_TOKEN is missing from environment variables.");
        return;
    }

    try {
        const counts = {};
        const promises = Object.keys(PRIZE_LIMITS).map(async (prizeId) => {
            const whereClause = `(prize_id,eq,${prizeId})`;
            const res = await axios.get(NOCODB_API_URL, {
                headers: { 'xc-token': NOCODB_TOKEN },
                params: {
                    where: whereClause,
                    limit: 1 // We only need the count metadata
                }
            });
            const count = res.data.pageInfo?.totalRows ?? 0;
            const limit = PRIZE_LIMITS[prizeId];
            const name = PRIZE_NAMES[prizeId] || prizeId;

            console.log(`${name} (${prizeId}): ${count} / ${limit} (Remaining: ${Math.max(0, limit - count)})`);
            return { prizeId, count, limit };
        });

        await Promise.all(promises);
        console.log('--------------------------------------------------');
        console.log('Check Complete.');

    } catch (err) {
        console.error("Error checking prizes:", err.message);
    }
}

checkPrizes();
