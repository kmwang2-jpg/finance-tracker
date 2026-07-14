import { Button, Card, Col, Container, Form, ListGroup, Modal, Row, Stack } from 'react-bootstrap';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useState } from 'react';
import { IncomeItem } from '../IncomeItem';
import { ExpenseItem } from '../ExpenseItem';
import { createCashFlowItem, updateCashFlowItem } from '../../storage';

function SectionCard({
  title,
  subtitle,
  headerActions,
  children
}) {
  return (
    <Card className="h-100 shadow-sm">
      <Card.Body>
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h5 className="mb-1">{title}</h5>
            {subtitle ? <p className="text-muted mb-0">{subtitle}</p> : null}
          </div>
          {headerActions ? <div className="d-flex gap-2 align-items-center">{headerActions}</div> : null}
        </div>
        {children}
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

export function BudgetingPage({ summary, cashflows, categories, onChanged }) {
  const createDefaultForm = () => ({
    name: '',
    description: '',
    categoryId: '',
    type: 'expense',
    amount: '',
    frequency: 'monthly',
    startDate: new Date().toISOString().slice(0, 10)
  });

  const [form, setForm] = useState(createDefaultForm());
  const [editingItemId, setEditingItemId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('expense');


  const resetForm = () => {
    setForm(createDefaultForm());
    setEditingItemId(null);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const openAddModal = (mode) => {
    resetForm();
    setModalMode(mode);
    setForm({
      ...createDefaultForm(),
      type: mode
    });
    setShowModal(true);
  };

  const loadItemForEdit = (item) => {
    setForm({
      name: item.name,
      description: item.description,
      categoryId: item.categoryId ? String(item.categoryId) : '',
      type: item.type,
      amount: String(item.amount),
      frequency: item.frequency,
      startDate: item.startDate
    });
    setEditingItemId(item.id);
    setModalMode(item.type === 'income' ? 'income' : 'expense');
    setShowModal(true);
  };

  async function submit() {
    const payload = {
      name: form.name,
      description: form.description,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      type: form.type,
      amount: Number(form.amount),
      frequency: form.frequency,
      startDate: form.startDate,
      endDate: null,
      isActive: true
    };

    if (editingItemId !== null) {
      updateCashFlowItem(editingItemId, payload);
    } else {
      createCashFlowItem(payload);
    }

    closeModal();
    await onChanged();
  }

  const rows = cashflows.map((item) => ({
    ...item,
    category: categories.find((category) => category.id === item.categoryId)?.name ?? 'Uncategorized'
  }));

  const incomeItems = rows.filter((item) => item.type === 'income');
  const expenseItems = rows.filter((item) => ['expense', 'debt_payment', 'savings_contribution'].includes(item.type));

  const modalTitle = editingItemId !== null ? 'Edit Cash Flow Item' : modalMode === 'income' ? 'Add Income Item' : 'Add Expense Item';
  const modalSubtitle = editingItemId !== null ? 'Update the selected item and save your changes' : `Create a recurring ${modalMode === 'income' ? 'income' : 'expense'} entry.`;

  return (
    <Container fluid className="px-0">
      <Row className="g-3 mb-3">
        <Col xs={12} md={4}><MetricCard label="Projected Income" value={summary?.currentMonth.income ?? 0} /></Col>
        <Col xs={12} md={4}><MetricCard label="Projected Expenses" value={(summary?.currentMonth.expenses ?? 0) + (summary?.currentMonth.debtPayments ?? 0) + (summary?.currentMonth.savingsContributions ?? 0)} /></Col>
        <Col xs={12} md={4}><MetricCard label="Net Cash Flow" value={summary?.currentMonth.netCashFlow ?? 0} /></Col>
      </Row>

      <Modal show={showModal} onHide={closeModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>{modalTitle}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted mb-3">{modalSubtitle}</p>
          <Form>
            <Row className="g-3">
              <Col xs={12} md={6} lg={4}>
                <Form.Group controlId="cashFlowName">
                  <Form.Label>Name</Form.Label>
                  <Form.Control value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                </Form.Group>
              </Col>
              <Col xs={12} md={6} lg={4}>
                <Form.Group controlId="cashFlowAmount">
                  <Form.Label>Amount</Form.Label>
                  <Form.Control type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
                </Form.Group>
              </Col>
              <Col xs={12} md={6} lg={4}>
                <Form.Group controlId="cashFlowType">
                  <Form.Label>Type</Form.Label>
                  <Form.Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                    {['income', 'expense', 'transfer', 'debt_payment', 'savings_contribution'].map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={12} md={6} lg={4}>
                <Form.Group controlId="cashFlowFrequency">
                  <Form.Label>Frequency</Form.Label>
                  <Form.Select value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })}>
                    {['one_time', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual'].map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={12} md={6} lg={4}>
                <Form.Group controlId="cashFlowCategory">
                  <Form.Label>Category</Form.Label>
                  <Form.Select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                    <option value="">None</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={12} md={6} lg={4}>
                <Form.Group controlId="cashFlowStartDate">
                  <Form.Label>Start Date</Form.Label>
                  <Form.Control type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group controlId="cashFlowDescription" className="mt-3">
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => void submit()} disabled={!form.name || !form.amount}>
            {editingItemId !== null ? 'Save Changes' : 'Add Cash Flow Item'}
          </Button>
          <Button variant="outline-secondary" onClick={closeModal}>Cancel</Button>
        </Modal.Footer>
      </Modal>

      <Row className="g-3 mb-3">
        <Col xs={12} lg={6}>
          <SectionCard
            title="Income"
            subtitle="Income items contributing to your budget"
            headerActions={
              <Button size="sm" onClick={() => openAddModal('income')}>
                Add Income
              </Button>
            }
          >
            <p className="text-muted mb-2">Click an income item to edit it in the modal.</p>
            {incomeItems.length > 0 ? (
              <ListGroup variant="flush">
                {incomeItems.map((item) => (
                  <IncomeItem key={item.id} item={item} onEdit={() => loadItemForEdit(item)} />
                ))}
              </ListGroup>
            ) : (
              <p className="text-muted mb-0">No income items</p>
            )}
          </SectionCard>
        </Col>
        <Col xs={12} lg={6}>
          <SectionCard
            title="Expenses"
            subtitle="Fixed and variable expenses across categories"
            headerActions={
              <Button size="sm" variant="outline-secondary" onClick={() => openAddModal('expense')}>
                Add Expense
              </Button>
            }
          >
            <p className="text-muted mb-2">Click an expense item to edit it in the modal.</p>
            {expenseItems.length > 0 ? (
              <ListGroup variant="flush">
                {expenseItems.map((item) => (
                  <ExpenseItem key={item.id} item={item} onEdit={() => loadItemForEdit(item)} />
                ))}
              </ListGroup>
            ) : (
              <p className="text-muted mb-0">No expense items</p>
            )}
          </SectionCard>
        </Col>
      </Row>

      <SectionCard title="Net Cash Flow" subtitle="Projected inflows and outflows by source">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
          <div>
            <p className="text-muted mb-0">Projected net cash flow this month</p>
          </div>
          <h4 className="mb-0 fw-bold">{(summary?.currentMonth.netCashFlow ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</h4>
        </div>
        <div style={{ width: '100%', height: 360 }}>
          <ResponsiveContainer>
            <BarChart data={summary?.annualProjection ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="income" fill="#1438b2" />
              <Bar dataKey="expenses" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
    </Container>
  );
}
