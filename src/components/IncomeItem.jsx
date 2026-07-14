import { ListGroup } from 'react-bootstrap';

export function IncomeItem({ item, onEdit }) {
  return (
    <ListGroup.Item action onClick={onEdit} className="mb-2 rounded-3 border" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
      <div className="d-flex flex-column gap-1">
        <span className="fw-semibold">{item.name} • {item.category}</span>
        <small className="text-muted">{item.type} • {item.frequency} • {item.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</small>
      </div>
    </ListGroup.Item>
  );
}
