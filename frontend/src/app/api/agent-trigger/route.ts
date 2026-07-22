import { NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient({ region: 'us-east-1' });

export async function POST(req: Request) {
  try {
    const { agent } = await req.json();
    const fn = agent === '1'
      ? 'stockapp-agent1-news-analyst'
      : 'stockapp-agent2-recommendations';

    await lambda.send(new InvokeCommand({
      FunctionName: fn,
      InvocationType: 'Event', // async — don't wait
      Payload: JSON.stringify({}),
    }));

    return NextResponse.json({ triggered: fn });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
