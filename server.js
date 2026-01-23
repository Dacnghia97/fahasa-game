const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); // Enable JSON body parsing

// Serve static files from the current directory
app.use(express.static('.'));

// Configuration
const NOCODB_API_URL = 'https://nocodb.smax.in/api/v2/tables/mkuczx2ud6zitcr/records';
const NOCODB_TOKEN = '9XcWdwwaxAznbxKwmx-wcwQI81K9vC3JD7GtK0ot';

// Endpoint to check game condition
app.get('/api/check', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'Missing random_code' });
    }

    try {
        // Construct the 'where' clause for NocoDB
        // Format: (random_code,eq,VALUE)
        const whereClause = `(random_code,eq,${code})`;

        const response = await axios.get(NOCODB_API_URL, {
            headers: {
                'xc-token': NOCODB_TOKEN
            },
            params: {
                'where': whereClause,
                'limit': 1
            }
        });

        const records = response.data.list;

        if (records && records.length > 0) {
            const record = records[0];
            // Return the status and any other relevant info
            return res.json({
                status: record.status, // Expected: INVITED, PLAYER, EXPIRED
                valid: true
            });
        } else {
            return res.json({
                valid: false,
                message: 'Code not found'
            });
        }

    } catch (error) {
        console.error('Error fetching data from NocoDB:', error.message);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.use(express.json()); // Enable JSON body parsing

// Endpoint to update game status
app.post('/api/update', async (req, res) => {
    const { code, prize } = req.body;

    if (!code || !prize) {
        return res.status(400).json({ error: 'Missing code or prize' });
    }

    try {
        // 1. Find the record ID first
        const whereClause = `(random_code,eq,${code})`;
        const findResponse = await axios.get(NOCODB_API_URL, {
            headers: { 'xc-token': NOCODB_TOKEN },
            params: { 'where': whereClause, 'limit': 1 }
        });

        const records = findResponse.data.list;
        if (!records || records.length === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }

        const recordId = records[0].Id; // Assuming field is 'Id' (capital I) based on standard NocoDB v2

        // 2. Update the record
        // Use the base URL and include 'Id' in the body for NocoDB V2
        const updateData = {
            Id: recordId,
            prize: prize,
            status: 'PLAYER'
        };

        await axios.patch(NOCODB_API_URL, updateData, {
            headers: { 'xc-token': NOCODB_TOKEN }
        });

        return res.json({ success: true });

    } catch (error) {
        console.error('Error updating NocoDB:', error.message);
        console.error('Full error:', error.response ? error.response.data : error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
