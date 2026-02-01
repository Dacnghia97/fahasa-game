const axios = require('axios');
require('dotenv').config();

const URL = 'https://nocodb.smax.in/api/v2/tables/mkuczx2ud6zitcr/records';
const TOKEN = process.env.NOCODB_TOKEN;

async function reset() {
    try {
        // 1. Find ABC21
        const res = await axios.get(URL, {
            headers: { 'xc-token': TOKEN },
            params: { 
                where: '(random_code,eq,ABC21)',
                limit: 1
            }
        });
        
        const r = res.data.list?.[0];
        if (r) {
            console.log(`Resetting ABC21 (ID: ${r.Id})...`);
            await axios.patch(URL, {
                Id: r.Id,
                status: 'INVITED',
                prize: null,
                prize_id: null,
                note: null,
                won_at: null
            }, { headers: { 'xc-token': TOKEN } });
            console.log("Reset Complete.");
        }
    } catch (e) {
        console.error(e.message);
    }
}

reset();
