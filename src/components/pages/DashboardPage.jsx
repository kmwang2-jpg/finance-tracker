import { Card, Col, Container, Row, Stack } from 'react-bootstrap';
import { Area, AreaChart, Pie, PieChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function SectionCard({ title, subtitle, children }) {
  return (
    <Card className="h-100 shadow-sm">
      <Card.Body>
        <Stack gap={3}>
          <div>
            <h5 className="mb-1">{title}</h5>
            {subtitle ? <p className="text-muted mb-0">{subtitle}</p> : null}
          </div>
          {children}
        </Stack>
      </Card.Body>
    </Card>
  );
}

function MetricCard({ label, value }) {
  return (
    <Card className="text-white shadow-sm" style={{ background: 'linear-gradient(180deg, #163ebc 0%, #12308f 100%)' }}>
      <Card.Body>
        <p className="text-uppercase opacity-75 mb-2 small">{label}</p>
        <h4 className="fw-bold mb-0">{typeof value === 'number' ? value.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : value}</h4>
      </Card.Body>
    </Card>
  );
}

export function DashboardPage({ summary, totals, categories }) {
  const categoryData = summary?.currentMonth.byCategory.map((entry) => ({
    name: categories.find((category) => category.id === entry.categoryId)?.name ?? 'Uncategorized',
    value: Math.abs(entry.amount)
  })) ?? [];

  return (
    <Container fluid className="px-0">
      <Row className="g-3 mb-3">
        {totals.map((metric) => (
          <Col key={metric.label} xs={12} sm={6} md={4}>
            <MetricCard label={metric.label} value={metric.value} />
          </Col>
        ))}
      </Row>
      <Row className="g-3">
        <Col xs={12} lg={7}>
          <SectionCard title="Monthly Trend" subtitle="Projected net cash flow across the year">
            <div style={{ width: '100%', height: 360 }}>
              <ResponsiveContainer>
                <AreaChart data={summary?.annualProjection ?? []}>
                  <defs>
                    <linearGradient id="netFlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1438b2" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#1438b2" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="netCashFlow" stroke="#1438b2" fill="url(#netFlow)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </Col>
        <Col xs={12} lg={5}>
          <SectionCard title="Category Mix" subtitle="Current month projected distribution">
            <div style={{ width: '100%', height: 360 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={130}>
                    {categoryData.map((entry, index) => (
                      <Cell key={entry.name} fill={[ '#1438b2', '#0f766e', '#f97316', '#8b5cf6', '#ef4444', '#22c55e' ][index % 6]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </Col>
      </Row>
    </Container>
  );
}
