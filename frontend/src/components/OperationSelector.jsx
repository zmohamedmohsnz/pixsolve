const icons = {
  resize: <span className="resize-icon" aria-hidden="true" />,
  compress: <svg viewBox="0 0 42 42" aria-hidden="true"><rect x="6" y="8" width="19" height="17" rx="2" /><rect x="17" y="17" width="19" height="17" rx="2" /><path d="m10 21 4-4 5 5m3 8 4-4 5 5" /></svg>,
  convert: <svg viewBox="0 0 42 42" aria-hidden="true"><path d="M10 7h15l8 8v20H10z" /><path d="M25 7v9h8M16 25h11m-3-4 4 4-4 4" /></svg>
};

const operations = [
  { value: 'resize', title: 'Resize', description: 'Change dimensions' },
  { value: 'compress', title: 'Compress', description: 'Reduce file size' },
  { value: 'convert', title: 'Convert', description: 'Change format' }
];

export const OperationSelector = ({ value, onChange }) => (
  <section className="operations" aria-label="Image operation">
    {operations.map(operation => (
      <button
        className={`operation ${value === operation.value ? 'active' : ''}`}
        key={operation.value}
        onClick={() => onChange(operation.value)}
        type="button"
        aria-pressed={value === operation.value}
      >
        <span className="operation-icon">{icons[operation.value]}</span>
        <span><strong>{operation.title}</strong><small>{operation.description}</small></span>
        <i className="radio" aria-hidden="true" />
      </button>
    ))}
  </section>
);
