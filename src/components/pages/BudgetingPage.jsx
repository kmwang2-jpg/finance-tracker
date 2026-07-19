import { Button, Card, Col, Container, Form, ListGroup, Modal, Row, Stack } from 'react-bootstrap';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useState } from 'react';
import { IncomeItem } from '../IncomeItem';
import { ExpenseItem } from '../ExpenseItem';
import { createCashFlowItem, updateCashFlowItem, createCategory, updateCategory, deleteCategory } from '../../storage';
import { parseIsoDate, formatIsoDate, WEEKDAY_OPTIONS, RECURRENCE_UNITS } from '../../recurrence';
import { getRecurrenceDescription } from '../../recurrence';

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
    recurrenceUnit: 'months',
    recurrenceInterval: 1,
    recurrenceAnchor: new Date().toISOString().slice(0, 10),
    startDate: new Date().toISOString().slice(0, 10)
  });

  const createDefaultCategoryForm = () => ({
    name: '',
    type: 'expense'
  });

  const [form, setForm] = useState(createDefaultForm());
  const [editingItemId, setEditingItemId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('expense');

  const [categoryForm, setCategoryForm] = useState(createDefaultCategoryForm());
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryModalMode, setCategoryModalMode] = useState('expense');

  const incomeCategories = categories.filter((category) => category.type === 'income');
  const expenseCategories = categories.filter((category) => category.type === 'expense');
  const availableCategories = form.type === 'income' ? incomeCategories : expenseCategories;

  const getMonthAnchorDate = () => {
    const anchorDate = parseIsoDate(form.recurrenceAnchor);
    if (anchorDate) {
      return anchorDate;
    }
    const startDate = parseIsoDate(form.startDate);
    return startDate || new Date();
  };

  const getMonthAnchorDay = () => getMonthAnchorDate().getDate();

  const buildMonthAnchor = (day) => {
    const base = parseIsoDate(form.startDate) || new Date();
    const year = base.getFullYear();
    const month = base.getMonth();
    const candidate = new Date(year, month, day);
    if (candidate.getMonth() !== month) {
      return formatIsoDate(new Date(year, month + 1, 0));
    }
    return formatIsoDate(candidate);
  };

  const normalizeRecurrenceAnchor = (unit, anchor, startDate, interval) => {
    if (unit === 'weeks') {
      return WEEKDAY_OPTIONS.includes(anchor) ? anchor : WEEKDAY_OPTIONS[0];
    }

    if (unit === 'days' || unit === 'months' || unit === 'years') {
      const dateAnchor = parseIsoDate(anchor);
      if (dateAnchor) {
        return formatIsoDate(dateAnchor);
      }

      const parsedStart = parseIsoDate(startDate);
      if (unit === 'months' && interval === 1) {
        return buildMonthAnchor(parsedStart ? parsedStart.getDate() : new Date().getDate());
      }

      return formatIsoDate(parsedStart || new Date());
    }

    return anchor;
  };

  const getRecurrenceAnchorLabel = () => {
    if (form.recurrenceUnit === 'weeks') return 'Weekday';
    if (form.recurrenceUnit === 'months') return form.recurrenceInterval === 1 ? 'Day of month' : 'Anchor date';
    if (form.recurrenceUnit === 'years') return 'Anchor date';
    if (form.recurrenceUnit === 'days') return 'Start date';
    return 'Anchor';
  };

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
      type: mode,
      recurrenceUnit: 'months',
      recurrenceInterval: 1,
      recurrenceAnchor: new Date().toISOString().slice(0, 10)
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
      recurrenceUnit: item.recurrence?.unit || 'one_time',
      recurrenceInterval: item.recurrence?.interval ?? 1,
      recurrenceAnchor: item.recurrence?.anchor || item.startDate || new Date().toISOString().slice(0, 10),
      startDate: item.startDate || new Date().toISOString().slice(0, 10)
    });
    setEditingItemId(item.id);
    setModalMode(item.type === 'income' ? 'income' : 'expense');
    setShowModal(true);
  };

  async function submit() {
    const recurrence = form.recurrenceUnit === 'one_time'
      ? null
      : {
          interval: Number(form.recurrenceInterval),
          unit: form.recurrenceUnit,
          anchor: form.recurrenceAnchor
        };

    const payload = {
      name: form.name,
      description: form.description,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      type: form.type,
      amount: Number(form.amount),
      recurrence,
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

  const resetCategoryForm = () => {
    setCategoryForm(createDefaultCategoryForm());
    setEditingCategoryId(null);
  };

  const openAddCategoryModal = (mode) => {
    resetCategoryForm();
    setCategoryModalMode(mode);
    setCategoryForm({ name: '', type: mode });
    setShowCategoryModal(true);
  };

  const loadCategoryForEdit = (category) => {
    setEditingCategoryId(category.id);
    setCategoryModalMode(category.type);
    setCategoryForm({ name: category.name, type: category.type });
    setShowCategoryModal(true);
  };

  const closeCategoryModal = () => {
    setShowCategoryModal(false);
    resetCategoryForm();
  };

  async function submitCategory() {
    if (editingCategoryId !== null) {
      updateCategory(editingCategoryId, { name: categoryForm.name, type: categoryForm.type });
    } else {
      createCategory({ name: categoryForm.name, type: categoryForm.type, parentCategoryId: null });
    }
    closeCategoryModal();
    await onChanged();
  }

  async function handleDeleteCategory(category) {
    const references = cashflows.filter((item) => item.categoryId === category.id).length;
    const message = references > 0
      ? `This category is used by ${references} cashflow item(s). Deleting it will clear those item references. Continue?`
      : 'Delete this category?';

    if (!window.confirm(message)) {
      return;
    }

    deleteCategory(category.id);
    await onChanged();
  }

  const setType = (newType) => {
    const matchingCategory = categories.find((category) => String(category.id) === form.categoryId && category.type === (newType === 'income' ? 'income' : 'expense'));
    setForm({
      ...form,
      type: newType,
      categoryId: matchingCategory ? form.categoryId : ''
    });
  };

  const setRecurrenceUnit = (unit) => {
    const anchor = normalizeRecurrenceAnchor(unit, form.recurrenceAnchor, form.startDate, form.recurrenceInterval);
    setForm({ ...form, recurrenceUnit: unit, recurrenceAnchor: anchor });
  };

  const setRecurrenceInterval = (interval) => {
    const normalizedInterval = Math.max(1, Number(interval) || 1);
    const anchor = normalizeRecurrenceAnchor(form.recurrenceUnit, form.recurrenceAnchor, form.startDate, normalizedInterval);
    setForm({ ...form, recurrenceInterval: normalizedInterval, recurrenceAnchor: anchor });
  };

  const setStartDate = (value) => {
    const anchor = normalizeRecurrenceAnchor(form.recurrenceUnit, form.recurrenceAnchor, value, form.recurrenceInterval);
    setForm({ ...form, startDate: value, recurrenceAnchor: anchor });
  };

  const recurrencePreview = getRecurrenceDescription({
    recurrence: form.recurrenceUnit === 'one_time' ? null : {
      interval: Number(form.recurrenceInterval),
      unit: form.recurrenceUnit,
      anchor: form.recurrenceAnchor
    },
    startDate: form.startDate
  });

  const rows = cashflows.map((item) => ({
    ...item,
    category: categories.find((category) => category.id === item.categoryId)?.name ?? 'Uncategorized'
  }));

  const incomeItems = rows.filter((item) => item.type === 'income');
  const expenseItems = rows.filter((item) => ['expense', 'debt_payment', 'savings_contribution', 'transfer'].includes(item.type));

  const modalTitle = editingItemId !== null ? 'Edit Cash Flow Item' : modalMode === 'income' ? 'Add Income Item' : 'Add Expense Item';
  const modalSubtitle = editingItemId !== null ? 'Update the selected item and save your changes' : `Create a recurring ${modalMode === 'income' ? 'income' : 'expense'} entry.`;

  return (
    <Container fluid className="px-0">
      <Row className="g-3 mb-3">
        <Col xs={12} md={4}><MetricCard label="Projected Income" value={summary?.currentMonth.income ?? 0} /></Col>
        <Col xs={12} md={4}><MetricCard label="Projected Expenses" value={(summary?.currentMonth.expenses ?? 0) + (summary?.currentMonth.debtPayments ?? 0) + (summary?.currentMonth.savingsContributions ?? 0)} /></Col>
        <Col xs={12} md={4}><MetricCard label="Net Cash Flow" value={summary?.currentMonth.netCashFlow ?? 0} /></Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col xs={12} lg={6}>
          <SectionCard
            title="Income Categories"
            subtitle="Create and manage income categories separately"
            headerActions={
              <Button size="sm" onClick={() => openAddCategoryModal('income')}>
                Add Income Category
              </Button>
            }
          >
            <ListGroup variant="flush">
              {incomeCategories.map((category) => (
                <ListGroup.Item key={category.id} className="d-flex justify-content-between align-items-center mb-2 rounded-3 border" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
                  <div>{category.name}</div>
                  <div className="d-flex gap-2">
                    <Button size="sm" variant="outline-primary" onClick={() => loadCategoryForEdit(category)}>Edit</Button>
                    <Button size="sm" variant="outline-danger" onClick={() => void handleDeleteCategory(category)}>Delete</Button>
                  </div>
                </ListGroup.Item>
              ))}
              {incomeCategories.length === 0 && <p className="text-muted mb-0">No income categories yet.</p>}
            </ListGroup>
          </SectionCard>
        </Col>

        <Col xs={12} lg={6}>
          <SectionCard
            title="Expense Categories"
            subtitle="Create and manage expense categories separately"
            headerActions={
              <Button size="sm" variant="outline-secondary" onClick={() => openAddCategoryModal('expense')}>
                Add Expense Category
              </Button>
            }
          >
            <ListGroup variant="flush">
              {expenseCategories.map((category) => (
                <ListGroup.Item key={category.id} className="d-flex justify-content-between align-items-center mb-2 rounded-3 border" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
                  <div>{category.name}</div>
                  <div className="d-flex gap-2">
                    <Button size="sm" variant="outline-primary" onClick={() => loadCategoryForEdit(category)}>Edit</Button>
                    <Button size="sm" variant="outline-danger" onClick={() => void handleDeleteCategory(category)}>Delete</Button>
                  </div>
                </ListGroup.Item>
              ))}
              {expenseCategories.length === 0 && <p className="text-muted mb-0">No expense categories yet.</p>}
            </ListGroup>
          </SectionCard>
        </Col>
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
                  <Form.Select value={form.type} onChange={(event) => setType(event.target.value)}>
                    {['income', 'expense', 'transfer', 'debt_payment', 'savings_contribution'].map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={12} md={6} lg={4}>
                <Form.Group controlId="cashFlowRecurrenceUnit">
                  <Form.Label>Recurrence</Form.Label>
                  <Form.Select value={form.recurrenceUnit} onChange={(event) => setRecurrenceUnit(event.target.value)}>
                    {RECURRENCE_UNITS.map((option) => (
                      <option key={option} value={option}>{option.replace('_', ' ')}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              {form.recurrenceUnit !== 'one_time' && (
                <Col xs={12} md={6} lg={4}>
                  <Form.Group controlId="cashFlowRecurrenceInterval">
                    <Form.Label>Interval</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      value={form.recurrenceInterval}
                      onChange={(event) => setRecurrenceInterval(event.target.value)}
                    />
                  </Form.Group>
                </Col>
              )}
              {form.recurrenceUnit !== 'one_time' && (
                <Col xs={12} md={6} lg={4}>
                  <Form.Group controlId="cashFlowRecurrenceAnchor">
                    <Form.Label>{getRecurrenceAnchorLabel()}</Form.Label>
                    {form.recurrenceUnit === 'weeks' ? (
                      <Form.Select value={form.recurrenceAnchor} onChange={(event) => setForm({ ...form, recurrenceAnchor: event.target.value })}>
                        {WEEKDAY_OPTIONS.map((day) => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </Form.Select>
                    ) : form.recurrenceUnit === 'months' && form.recurrenceInterval === 1 ? (
                      <Form.Select value={getMonthAnchorDay()} onChange={(event) => setForm({ ...form, recurrenceAnchor: buildMonthAnchor(Number(event.target.value)) })}>
                        {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </Form.Select>
                    ) : (
                      <Form.Control
                        type="date"
                        value={form.recurrenceAnchor}
                        onChange={(event) => setForm({ ...form, recurrenceAnchor: event.target.value })}
                      />
                    )}
                    <Form.Text className="text-muted">
                      {form.recurrenceUnit === 'weeks'
                        ? 'Choose the weekday the item repeats.'
                        : form.recurrenceUnit === 'months' && form.recurrenceInterval === 1
                          ? 'Choose the day of the month the item repeats.'
                          : 'Choose the anchor date for the recurrence.'}
                    </Form.Text>
                  </Form.Group>
                </Col>
              )}
              <Col xs={12} md={6} lg={4}>
                <Form.Group controlId="cashFlowCategory">
                  <Form.Label>Category</Form.Label>
                  <Form.Select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                    <option value="">None</option>
                    {availableCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={12} md={6} lg={4}>
                <Form.Group controlId="cashFlowStartDate">
                  <Form.Label>Start Date</Form.Label>
                  <Form.Control type="date" value={form.startDate} onChange={(event) => setStartDate(event.target.value)} />
                </Form.Group>
              </Col>
            </Row>
            <Row className="mt-3">
              <Col>
                <Form.Text className="text-muted">Preview: {recurrencePreview}</Form.Text>
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

      <Modal show={showCategoryModal} onHide={closeCategoryModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingCategoryId !== null ? 'Edit Category' : `Add ${categoryModalMode === 'income' ? 'Income' : 'Expense'} Category`}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group controlId="categoryName" className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} />
            </Form.Group>
            <Form.Group controlId="categoryType">
              <Form.Label>Category Type</Form.Label>
              <Form.Select value={categoryForm.type} onChange={(event) => setCategoryForm({ ...categoryForm, type: event.target.value })}>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => void submitCategory()} disabled={!categoryForm.name}>
            {editingCategoryId !== null ? 'Save Category' : 'Create Category'}
          </Button>
          <Button variant="outline-secondary" onClick={closeCategoryModal}>Cancel</Button>
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
