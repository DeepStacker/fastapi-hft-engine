'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface LiveChartProps {
  title: string;
  data: any[];
  dataKey: string;
  color?: string;
  unit?: string;
}

export default function LiveChart({ title, data, dataKey, color = "#4f46e5", unit = "%" }: LiveChartProps) {
  return (
    <Card hover className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="currentColor" 
                className="text-border"
                vertical={false} 
              />
              <XAxis 
                dataKey="time" 
                hide 
              />
              <YAxis 
                stroke="currentColor"
                className="text-muted-foreground"
                fontSize={11} 
                tickFormatter={(value) => `${value}${unit}`}
                domain={[0, 'auto']}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: 'var(--shadow-lg)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                itemStyle={{ color: color }}
              />
              <Line 
                type="monotone" 
                dataKey={dataKey} 
                stroke={color} 
                strokeWidth={2.5} 
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0, fill: color }}
                isAnimationActive={true}
                animationDuration={300}
                fill={`url(#gradient-${dataKey})`}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
