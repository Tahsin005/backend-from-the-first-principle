import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import client from '@/lib/elasticsearch';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query) {
        return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const sendData = (source: string, data: any, time: number) => {
                const payload = JSON.stringify({ source, data, time });
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            };

            try {
                // searches in parallel
                const postgresSearch = async () => {
                    const start = performance.now();
                    const { rows } = await pool.query(
                        'SELECT *, count(*) OVER() AS total_count FROM reviews WHERE review ILIKE $1 LIMIT 10',
                        [`%${query}%`]
                    );
                    const end = performance.now();
                    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;
                    // clean up total_count from rows
                    const data = rows.map(({ total_count, ...rest }) => rest);
                    sendData('postgres', { data, total }, Math.round(end - start));
                };

                const elasticSearch = async () => {
                    const start = performance.now();
                    const result = await client.search({
                        index: 'reviews',
                        query: {
                            query_string: {
                                query: `*${query.toLowerCase()}*`,
                                fields: ["review"],
                                default_operator: "OR",
                                analyze_wildcard: true,
                            },
                        },
                        size: 10,
                    });
                    const end = performance.now();
                    const total = typeof result.hits.total === 'object' ? result.hits.total.value : result.hits.total;
                    const data = result.hits.hits.map((hit: any) => hit._source);
                    sendData('elastic', { data, total }, Math.round(end - start));
                };

                await Promise.all([postgresSearch(), elasticSearch()]);

                controller.close();
            } catch (error) {
                console.error('Search error:', error);
                controller.error(error);
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
