import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    ssl: {
        rejectUnauthorized: false,
    },
});

async function seed() {
    const client = await pool.connect();
    try {
        console.log('Connected to PostgreSQL');

        // create table
        await client.query(`
            CREATE TABLE IF NOT EXISTS reviews (
                id SERIAL PRIMARY KEY,
                external_id INTEGER UNIQUE,
                review TEXT NOT NULL,
                sentiment INTEGER NOT NULL
            );
        `);
        console.log('Ensured reviews table exists');

        const csvFilePath = path.resolve('processed.csv');
        const parser = fs.createReadStream(csvFilePath).pipe(
            parse({
                columns: true,
                skip_empty_lines: true,
            })
        );

        let batch = [];
        let count = 0;
        const BATCH_SIZE = 100;

        for await (const record of parser) {
            const external_id = parseInt(record[''] || record['0']);
            const review = record['review'];
            const sentiment = parseInt(record['sentiment']);

            batch.push([external_id, review, sentiment]);

            if (batch.length === BATCH_SIZE) {
                await insertBatch(client, batch);
                count += batch.length;
                console.log(`Indexed ${count} records...`);
                batch = [];
            }
        }

        if (batch.length > 0) {
            await insertBatch(client, batch);
            count += batch.length;
            console.log(`Indexed ${count} records...`);
        }

        console.log('Seeding completed successfully!');
    } catch (err) {
        console.error('Error seeding data:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

async function insertBatch(client, batch) {
    const query = `
        INSERT INTO reviews (external_id, review, sentiment)
        VALUES ${batch.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(',')}
        ON CONFLICT (external_id) DO NOTHING
    `;
    const values = batch.flat();
    await client.query(query, values);
}

seed();
