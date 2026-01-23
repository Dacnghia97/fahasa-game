const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ===== CONFIG =====
const NOCODB_API_URL = 'https://nocodb.smax.in/api/v2/tables/mkuczx2ud6zitcr/records';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN;

// ===== CHECK CONDITION =====
app.get('/api/check', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing random_code' });

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
            status: record.status
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// ===== UPDATE STATUS =====
app.post('/api/update', async (req, res) => {
    const { code, prize } = req.body;
    if (!code || !prize) {
        return res.status(400).json({ error: 'Missing code or prize' });
    }

    try {
        const whereClause = `(random_code,eq,${code})`;
        const findRes = await axios.get(NOCODB_API_URL, {
            headers: { 'xc-token': NOCODB_TOKEN },
            params: { where: whereClause, limit: 1 }
        });

        const record = findRes.data.list?.[0];
        if (!record) return res.status(404).json({ error: 'Record not found' });

        await axios.patch(
            NOCODB_API_URL,
            { Id: record.Id, prize, status: 'PLAYER' },
            { headers: { 'xc-token': NOCODB_TOKEN } }
        );

        res.json({ success: true });

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ error: 'Update failed' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});