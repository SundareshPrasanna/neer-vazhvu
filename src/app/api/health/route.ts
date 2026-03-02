import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { count, error } = await supabase
      .from('reservoir_daily')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: error ? 'error' : 'connected',
      reservoirRows: count,
    });
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
