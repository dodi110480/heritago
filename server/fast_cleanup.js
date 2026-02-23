const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    try {
        console.log('--- FAST DB CLEANUP ---');

        // IDs identified previously:
        // Guenter Doe: @I1771656660659@
        // Wrong Family: @F1771672062986_362@ (where Egon is husband)

        // Find individual ID for Guenter
        const resIndi = await pool.query('SELECT id FROM "Individual" WHERE "gedcomId" = $1', ['@I1771656660659@']);
        if (resIndi.rows.length === 0) {
            console.log('Guenter Doe not found');
            return;
        }
        const indiId = resIndi.rows[0].id;

        // Find family ID for wrong family
        const resFam = await pool.query('SELECT id FROM "Family" WHERE "gedcomId" = $1', ['@F1771672062986_362@']);
        if (resFam.rows.length === 0) {
            console.log('Family F1771672062986_362 not found');
            return;
        }
        const famId = resFam.rows[0].id;

        // Delete the membership where Guenter is CHIL in that family
        const delRes = await pool.query('DELETE FROM "FamilyMember" WHERE "familyId" = $1 AND "individualId" = $2 AND "role" = \'CHIL\'', [famId, indiId]);
        console.log(`Deleted ${delRes.rowCount} wrong membership(s).`);
        console.log('--- CLEANUP FINISHED ---');
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
