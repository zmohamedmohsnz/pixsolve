const labels = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed'
};

export const StatusBadge = ({ status }) => (
  <span className={`status-badge status-${status}`}>{labels[status] || status}</span>
);
