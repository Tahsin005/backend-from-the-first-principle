import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    node: process.env.ELASTICSEARCH_NODE,
    auth: {
        apiKey: process.env.ELASTICSEARCH_API_KEY,
    },
});

async function seed() {
    try {
        console.log('Connected to Elasticsearch');

        const indexName = 'reviews';

        // check if index exists, delete if necessary or just skip creation
        const exists = await client.indices.exists({ index: indexName });
        if (exists) {
            console.log(`Index ${indexName} already exists. Deleting...`);
            await client.indices.delete({ index: indexName });
        }

        await client.indices.create({
            index: indexName,
            body: {
                mappings: {
                    properties: {
                        external_id: { type: 'integer' },
                        review: { type: 'text' },
                        sentiment: { type: 'keyword' },
                    },
                },
            },
        });
        console.log(`Created index ${indexName}`);

        const csvFilePath = path.resolve('processed.csv');
        const parser = fs.createReadStream(csvFilePath).pipe(
            parse({
                columns: true,
                skip_empty_lines: true,
            })
        );

        let batch = [];
        let count = 0;
        const BATCH_SIZE = 500;

        for await (const record of parser) {
            const external_id = parseInt(record[''] || record['0']);
            const review = record['review'];
            const sentiment = parseInt(record['sentiment']);

            batch.push({ index: { _index: indexName } });
            batch.push({ external_id, review, sentiment });

            if (batch.length / 2 === BATCH_SIZE) {
                const result = await client.bulk({ body: batch });
                if (result.errors) {
                    console.error('Bulk index errors:', JSON.stringify(result.items.filter(i => i.index && i.index.error), null, 2));
                }
                count += batch.length / 2;
                console.log(`Indexed ${count} records in Elasticsearch...`);
                batch = [];
            }
        }

        if (batch.length > 0) {
            await client.bulk({ body: batch });
            count += batch.length / 2;
            console.log(`Indexed ${count} records in Elasticsearch...`);
        }

        console.log('Elasticsearch seeding completed successfully!');
    } catch (err) {
        console.error('Error seeding Elasticsearch:', err);
    }
}

seed();
