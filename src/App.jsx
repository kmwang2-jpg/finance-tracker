import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button, Card, Col, Container, Form, ListGroup, Nav, Row, Stack } from 'react-bootstrap';
import { buildSummary } from './summary';
import { createCashFlowItem, createDebtAccount, createSavingsGoal, createTaxableEvent, loadActuals, loadCashFlows, loadCategories, loadDebts, loadGoals, loadTaxableEvents } from './storage';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DashboardPage } from './components/pages/DashboardPage';
import { BudgetingPage } from './components/pages/BudgetingPage';

const navigation = [
  { label: 'Dashboard', path: '/' },
  { label: 'Budgeting', path: '/budgeting' },
  { label: 'Cash Flow Forecast', path: '/forecast' },
  { label: 'Historical Analysis', path: '/history' },
  { label: 'Savings Goals', path: '/goals' },
  { label: 'Debt Calculator', path: '/debt' },
  { label: 'Taxable Events', path: '/taxable' }
];

function App() {
  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at top left, rgba(20,56,178,0.15), transparent 30%), linear-gradient(180deg, #f8fbff 0%, #eef3ff 100%)' }}>
      <Shell />
    </div>
  );
}

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

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [cashflows, setCashflows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [actuals, setActuals] = useState([]);
  const [goals, setGoals] = useState([]);
  const [debts, setDebts] = useState([]);
  const [events, setEvents] = useState([]);
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;

  async function refresh() {
    const categoriesData = loadCategories();
    const cashflowData = loadCashFlows();
    const actualData = loadActuals();
    const goalsData = loadGoals();
    const debtsData = loadDebts();
    const eventsData = loadTaxableEvents();

    setCategories(categoriesData);
    setCashflows(cashflowData);
    setActuals(actualData);
    setGoals(goalsData);
    setDebts(debtsData);
    setEvents(eventsData);

    setSummary(buildSummary({
      year,
      month,
      startingBalance: 2500,
      cashflows: cashflowData,
      actuals: actualData,
      goals: goalsData,
      debts: debtsData,
      events: eventsData
    }));
  }

  useEffect(() => {
    void refresh();
  }, []);

  const totals = summary
    ? [
        { label: 'Projected Income', value: summary.currentMonth.income },
        { label: 'Projected Expenses', value: summary.currentMonth.expenses + summary.currentMonth.debtPayments + summary.currentMonth.savingsContributions },
        { label: 'Net Cash Flow', value: summary.currentMonth.netCashFlow },
        { label: 'Goals', value: goals.length },
        { label: 'Debts', value: debts.length },
        { label: 'Tax Events', value: events.length }
      ]
    : [];

  return (
    <Container fluid className="p-0">
      <Row className="g-0">
        <Col xs={12} lg={2} style={{ minHeight: '100vh', maxWidth: '260px', background: 'linear-gradient(180deg, #163ebc 0%, #12308f 100%)', color: '#fff', boxShadow: '0 4px 20px rgba(20, 56, 178, 0.15)' }}>
          <div className="p-4 border-bottom" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <h5 className="fw-bold">Finance</h5>
            <small className="text-white-50 text-uppercase">Dashboard</small>
          </div>
          <Nav variant="pills" className="flex-column p-3" activeKey={location.pathname}>
            {navigation.map((entry) => (
              <Nav.Item key={entry.path}>
                <Nav.Link
                  eventKey={entry.path}
                  onClick={() => navigate(entry.path)}
                  active={location.pathname === entry.path}
                  className="text-white rounded-3 mb-2"
                  style={{ backgroundColor: location.pathname === entry.path ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none' }}
                >
                  {entry.label}
                </Nav.Link>
              </Nav.Item>
            ))}
          </Nav>
          <div className="p-3 border-top" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <Button variant="outline-light" className="w-100" onClick={() => void refresh()}>
              Refresh
            </Button>
          </div>
        </Col>

        <Col xs={12} lg={9} className="px-4 py-4">
          <div className="mb-4 pb-3 border-bottom" style={{ backdropFilter: 'blur(18px)', backgroundColor: 'rgba(255,255,255,0.72)' }}>
            <Stack gap={2}>
              <small className="text-uppercase text-primary fw-bold" style={{ letterSpacing: '0.2em' }}>Personal Finance Dashboard</small>
              <h2 className="fw-bold mb-0">Plan, project, and reconcile every dollar.</h2>
            </Stack>
          </div>
          <Container fluid className="px-0">
            <Routes>
              <Route path="/" element={<DashboardPage summary={summary} totals={totals} categories={categories} />} />
              <Route path="/budgeting" element={<BudgetingPage summary={summary} cashflows={cashflows} categories={categories} onChanged={refresh} />} />
              <Route path="/forecast" element={<ForecastPage summary={summary} />} />
              <Route path="/history" element={<HistoryPage summary={summary} actuals={actuals} />} />
              <Route path="/goals" element={<SavingsGoalsPage goals={goals} onChanged={refresh} />} />
              <Route path="/debt" element={<DebtPage debts={debts} onChanged={refresh} />} />
              <Route path="/taxable" element={<TaxableEventsPage events={events} onChanged={refresh} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Container>
        </Col>
      </Row>
    </Container>
  );
}

function ForecastPage({ summary }) {
  return (
    <Container fluid className="px-0">
      <Row className="g-3">
        <Col xs={12} lg={8}>
          <SectionCard title="Cash Flow Forecast" subtitle="Future balances and monthly inflows/outflows">
            <div style={{ width: '100%', height: 400 }}>
              <ResponsiveContainer>
                <LineChart data={summary?.forecast ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="runningBalance" stroke="#1438b2" strokeWidth={3} />
                  <Line type="monotone" dataKey="projectedNet" stroke="#0f766e" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </Col>
        <Col xs={12} lg={4}>
          <SectionCard title="Balance Summary" subtitle="Latest monthly cash flow snapshot">
            <h1 className="fw-bold">{summary?.forecast.at(-1)?.runningBalance.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) ?? '$0.00'}</h1>
            <p className="text-muted">This uses the shared projection engine, so the balance trace and the budgeting views stay in sync.</p>
          </SectionCard>
        </Col>
      </Row>
    </Container>
  );
}

function HistoryPage({ summary, actuals }) {
  return (
    <Container fluid className="px-0">
      <Row className="g-3">
        <Col xs={12} lg={7}>
          <SectionCard title="Expected vs Actual" subtitle="Variance by month">
            <div style={{ width: '100%', height: 360 }}>
              <ResponsiveContainer>
                <BarChart data={summary?.reconciliation ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="projected" fill="#1438b2" />
                  <Bar dataKey="actual" fill="#0f766e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </Col>
        <Col xs={12} lg={5}>
          <SectionCard title="Actual Records" subtitle="Monthly check-in entries">
            <Stack gap={3}>
              {actuals.map((record) => (
                <Card key={record.id} body className="border-0 shadow-sm p-3 bg-white">
                  <h6 className="fw-bold mb-1">{record.year}-{record.month.toString().padStart(2, '0')} • {record.type}</h6>
                  <p className="text-muted mb-1">{record.note || 'No note'}</p>
                  <p className="mb-0 fw-semibold">{record.actualAmount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</p>
                </Card>
              ))}
            </Stack>
          </SectionCard>
        </Col>
      </Row>
    </Container>
  );
}

function SavingsGoalsPage({ goals, onChanged }) {
  const [form, setForm] = useState({ name: '', targetAmount: '', targetDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString().slice(0, 10), currentBalance: '' });

  async function submit() {
    createSavingsGoal({ name: form.name, targetAmount: Number(form.targetAmount), targetDate: form.targetDate, currentBalance: Number(form.currentBalance || 0) });
    setForm({ name: '', targetAmount: '', targetDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString().slice(0, 10), currentBalance: '' });
    await onChanged();
  }

  return (
    <Container fluid className="px-0">
      <Row className="g-3">
        <Col xs={12} md={4}>
          <SectionCard title="Create Goal" subtitle="Track a savings target">
            <Form.Group className="mb-3" controlId="goalName">
              <Form.Label>Name</Form.Label>
              <Form.Control value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="goalTargetAmount">
              <Form.Label>Target Amount</Form.Label>
              <Form.Control type="number" value={form.targetAmount} onChange={(event) => setForm({ ...form, targetAmount: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="goalCurrentBalance">
              <Form.Label>Current Balance</Form.Label>
              <Form.Control type="number" value={form.currentBalance} onChange={(event) => setForm({ ...form, currentBalance: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="goalTargetDate">
              <Form.Label>Target Date</Form.Label>
              <Form.Control type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} />
            </Form.Group>
            <Button onClick={() => void submit()} disabled={!form.name || !form.targetAmount}>Add Goal</Button>
          </SectionCard>
        </Col>
        {goals.map((goal) => (
          <Col key={goal.id} xs={12} md={4}>
            <SectionCard title={goal.name} subtitle={goal.targetDate}>
              <h2 className="fw-bold">{goal.currentBalance.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</h2>
              <p className="text-muted mb-1">Target: {goal.targetAmount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</p>
              <p className="text-muted mb-0">Progress: {((goal.currentBalance / goal.targetAmount) * 100).toFixed(1)}%</p>
            </SectionCard>
          </Col>
        ))}
      </Row>
    </Container>
  );
}

function DebtPage({ debts, onChanged }) {
  const [form, setForm] = useState({ name: '', principal: '', interestRate: '', minimumPayment: '', extraPayment: '', balance: '' });

  async function submit() {
    createDebtAccount({
      name: form.name,
      principal: Number(form.principal),
      interestRate: Number(form.interestRate),
      minimumPayment: Number(form.minimumPayment),
      extraPayment: Number(form.extraPayment || 0),
      balance: Number(form.balance || form.principal)
    });
    setForm({ name: '', principal: '', interestRate: '', minimumPayment: '', extraPayment: '', balance: '' });
    await onChanged();
  }

  return (
    <Container fluid className="px-0">
      <Row className="g-3">
        <Col xs={12} md={4}>
          <SectionCard title="Add Debt" subtitle="Compare payoff strategies">
            <Form.Group className="mb-3" controlId="debtName">
              <Form.Label>Name</Form.Label>
              <Form.Control value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="debtPrincipal">
              <Form.Label>Principal</Form.Label>
              <Form.Control type="number" value={form.principal} onChange={(event) => setForm({ ...form, principal: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="debtInterestRate">
              <Form.Label>Interest Rate</Form.Label>
              <Form.Control type="number" value={form.interestRate} onChange={(event) => setForm({ ...form, interestRate: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="debtMinimumPayment">
              <Form.Label>Minimum Payment</Form.Label>
              <Form.Control type="number" value={form.minimumPayment} onChange={(event) => setForm({ ...form, minimumPayment: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="debtExtraPayment">
              <Form.Label>Extra Payment</Form.Label>
              <Form.Control type="number" value={form.extraPayment} onChange={(event) => setForm({ ...form, extraPayment: event.target.value })} />
            </Form.Group>
            <Button onClick={() => void submit()} disabled={!form.name || !form.principal}>Add Debt</Button>
          </SectionCard>
        </Col>
        {debts.map((debt) => (
          <Col key={debt.id} xs={12} md={4}>
            <SectionCard title={debt.name} subtitle={`${debt.interestRate}% APR`}>
              <h2 className="fw-bold">{debt.balance.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</h2>
              <p className="text-muted mb-1">Minimum payment: {debt.minimumPayment.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</p>
              <p className="text-muted mb-0">Extra payment: {debt.extraPayment.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</p>
            </SectionCard>
          </Col>
        ))}
      </Row>
    </Container>
  );
}

function TaxableEventsPage({ events, onChanged }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), eventType: 'interest_income', description: '', amount: '' });

  async function submit() {
    createTaxableEvent({
      date: form.date,
      eventType: form.eventType,
      description: form.description,
      amount: Number(form.amount)
    });
    setForm({ date: new Date().toISOString().slice(0, 10), eventType: 'interest_income', description: '', amount: '' });
    await onChanged();
  }

  return (
    <Container fluid className="px-0">
      <Row className="g-3">
        <Col xs={12} lg={8}>
          <SectionCard title="Taxable Events" subtitle="Informational tracking and yearly review">
            <Form.Group className="mb-3" controlId="eventDate">
              <Form.Label>Date</Form.Label>
              <Form.Control type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="eventType">
              <Form.Label>Event Type</Form.Label>
              <Form.Select value={form.eventType} onChange={(event) => setForm({ ...form, eventType: event.target.value })}>
                {['interest_income', 'dividend_income', 'stock_sale', 'capital_gain', 'capital_loss', 'roth_conversion', 'side_income'].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3" controlId="eventDescription">
              <Form.Label>Description</Form.Label>
              <Form.Control value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="eventAmount">
              <Form.Label>Amount</Form.Label>
              <Form.Control type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            </Form.Group>
            <Button onClick={() => void submit()} disabled={!form.description || !form.amount}>Add Event</Button>
            <ListGroup variant="flush" className="mt-4">
              {events.map((event) => (
                <ListGroup.Item key={event.id} action style={{ borderRadius: '0.75rem', marginBottom: '0.75rem', border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="fw-bold">{event.date} • {event.eventType}</div>
                      <div className="text-muted">{event.description}</div>
                    </div>
                    <div className="fw-semibold">{event.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</div>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </SectionCard>
        </Col>
      </Row>
    </Container>
  );
}

export default App;
