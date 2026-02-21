const { Pool } = require('pg');

const variants = [
    "postgresql://heritago:heritago@localhost:5432/heritago_new",
    "postgresql://heritago:heritago@localhost:5432/heritago",
    "postgresql://postgres:heritago@localhost:5432/heritago",
    "postgresql://postgres@localhost:5432/heritago_new",
    "postgresql://postgres:heritago@localhost:5432/heritago_new",
    "postgresql://postgres:postgres@localhost:5432/heritago_new"
];

async function test() {
    for (const conn of variants) {
        console.log(`Testing: ${conn}`);
        const pool = new Pool({ connectionString: conn });
        try {
            const client = await pool.connect();
            console.log('SUCCESS!');
            const res = await client.query('SELECT current_database(), current_user');
            console.log('Data:', res.rows[0]);
            client.release();
            await pool.end();
            return;
        } catch (err) {
            console.log('FAILED:', err.message);
        }
        await pool.end();
    }
}

test();
