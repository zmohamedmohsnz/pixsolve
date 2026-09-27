import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { OperationSelector } from '../components/OperationSelector';
import { UploadDropzone } from '../components/UploadDropzone';
import { createAccountJob, createGuestJob } from '../features/jobs/jobs-api';
import { saveGuestJob } from '../features/jobs/guest-job-storage';
import { useAuth } from '../features/auth/auth-context';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const validMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const fileFormat = file => ({ 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP' }[file?.type] || 'IMAGE');
const fileSize = bytes => `${(bytes / (1024 * 1024)).toFixed(bytes < 1024 * 1024 ? 1 : 2)} MiB`;
const apiErrorMessage = error => {
  const fieldMessages = error?.details?.fields
    ?.map(field => field.message)
    .filter(Boolean);
  return fieldMessages?.length ? fieldMessages.join(' ') : error.message;
};

export const HomePage = () => {
  const navigate = useNavigate();
  const { authExpired, clearSession, session } = useAuth();
  const sessionTokenRef = useRef(session?.accessToken);
  sessionTokenRef.current = session?.accessToken;
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dimensions, setDimensions] = useState(null);
  const [operation, setOperation] = useState('resize');
  const [options, setOptions] = useState({ width: '', height: '', quality: '70', format: 'webp' });
  const [fieldError, setFieldError] = useState('');
  const [apiError, setApiError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); setDimensions(null); return undefined; }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = url;
    setPreviewUrl(url);
    return () => { image.onload = null; URL.revokeObjectURL(url); };
  }, [file]);

  const selectFile = nextFile => {
    setApiError(null);
    if (!nextFile) return;
    if (!validMimeTypes.has(nextFile.type)) {
      setFile(null);
      setFieldError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setFieldError('Choose an image no larger than 5 MiB.');
      return;
    }
    setFieldError('');
    setFile(nextFile);
  };

  const optionPayload = () => {
    if (operation === 'resize') {
      const width = Number(options.width);
      const height = Number(options.height);
      if (!Number.isInteger(width) || width < 1 || width > 4096 || !Number.isInteger(height) || height < 1 || height > 4096) {
        throw new Error('Enter whole-number width and height values from 1 to 4096 pixels.');
      }
      return { width, height };
    }
    if (operation === 'compress') {
      const quality = Number(options.quality);
      if (!Number.isInteger(quality) || quality < 1 || quality > 100) throw new Error('Enter a whole-number quality value from 1 to 100.');
      return { quality };
    }
    return { format: options.format };
  };

  const submit = async event => {
    event.preventDefault();
    setApiError(null);
    if (authExpired) {
      navigate('/login', { state: { from: { pathname: '/' } } });
      return;
    }
    if (!file) { setFieldError('Choose an image before processing.'); return; }
    let payload;
    try { payload = optionPayload(); setFieldError(''); } catch (error) { setFieldError(error.message); return; }

    setIsCreating(true);
    try {
      const token = session?.accessToken;
      const data = token
        ? await createAccountJob({ file, operation, options: payload, token })
        : await createGuestJob({ file, operation, options: payload });
      if (token && sessionTokenRef.current !== token) return;
      if (token) {
        navigate(`/jobs/${data.job.id}`, { state: { job: data.job, accessMode: 'account' } });
      } else {
        saveGuestJob({ id: data.job.id, credential: data.guestAccessToken });
        navigate(`/jobs/${data.job.id}`, { state: { job: data.job, accessMode: 'guest' } });
      }
    } catch (error) {
      if (sessionTokenRef.current && error.status === 401) {
        clearSession({ expired: true });
        navigate('/login', { state: { from: { pathname: '/' } } });
        return;
      }
      setApiError(error);
    } finally {
      setIsCreating(false);
    }
  };

  const updateOption = (key, value) => setOptions(current => ({ ...current, [key]: value }));
  const originalWidth = dimensions ? `${dimensions.width} px` : 'Choose an image';
  const originalHeight = dimensions ? `${dimensions.height} px` : 'Choose an image';
  const outputRows = [
    ['⚙', 'Operation', operation[0].toUpperCase() + operation.slice(1)],
    ['⇄', 'Width', operation === 'resize' && options.width ? `${options.width} px` : originalWidth],
    ['⇆', 'Height', operation === 'resize' && options.height ? `${options.height} px` : originalHeight],
    ['↕', 'Output format', operation === 'convert' ? options.format.toUpperCase() : `Same as original${file ? ` (${fileFormat(file)})` : ''}`]
  ];

  return (
    <main>
      <section className="hero"><h1>Process your <span>image</span></h1><p>Resize, compress, or convert your images with ease.<br />Fast. Simple. Free to use.</p></section>
      {authExpired && <Alert><Link className="inline-link" to="/login">Your session has expired. Sign in to continue processing with your account.</Link></Alert>}
      <form className="workspace" onSubmit={submit} noValidate>
        <div className="left-column">
          {apiError && <Alert>{apiErrorMessage(apiError)}</Alert>}
          <UploadDropzone file={file} onFile={selectFile} error={fieldError && !file ? fieldError : ''} />
          <OperationSelector value={operation} onChange={setOperation} />
          <section className="options-panel panel pixel-corners">
            <h2>{operation[0].toUpperCase() + operation.slice(1)} options</h2>
            {operation === 'resize' && <div className="option-controls two-columns">
              <label>Width (px)<input value={options.width} onChange={e => updateOption('width', e.target.value)} type="number" min="1" max="4096" inputMode="numeric" /></label>
              <label>Height (px)<input value={options.height} onChange={e => updateOption('height', e.target.value)} type="number" min="1" max="4096" inputMode="numeric" /></label>
            </div>}
            {operation === 'compress' && <div className="option-controls"><label>Quality (1–100)<input value={options.quality} onChange={e => updateOption('quality', e.target.value)} type="number" min="1" max="100" inputMode="numeric" /></label></div>}
            {operation === 'convert' && <fieldset className="format-picker"><legend>Output format</legend><div role="radiogroup" aria-label="Output format">{['jpeg', 'png', 'webp'].map(format => <button className={options.format === format ? 'selected' : ''} type="button" role="radio" aria-checked={options.format === format} key={format} onClick={() => updateOption('format', format)}>{format.toUpperCase()}</button>)}</div></fieldset>}
            {fieldError && file && <p className="field-error" role="alert">{fieldError}</p>}
            <button className="process-button pixel-corners" type="submit" disabled={isCreating}>{isCreating ? 'Submitting job…' : <>Process image <span>→</span></>}</button>
          </section>
        </div>
        <aside className="preview-column panel pixel-corners">
          <section className="preview-section"><div className="section-title"><h2>Image preview</h2>{file && <button className="clear-button" type="button" onClick={() => { setFile(null); setFieldError(''); }}>Clear</button>}</div>
            <div className={`image-frame pixel-corners ${!previewUrl ? 'empty-preview' : ''}`}>{previewUrl ? <img src={previewUrl} alt={`Preview of ${file.name}`} /> : <span>Choose an image to preview it here.</span>}</div>
            {file && <div className="file-details"><div><strong>{file.name}</strong><small>{fileSize(file.size)} <i /> {dimensions ? `${dimensions.width} × ${dimensions.height}` : 'Reading dimensions…'}</small></div><span className="format-badge">{fileFormat(file)}</span></div>}
          </section>
          <section className="output-card pixel-corners"><div className="output-heading"><h2>Output information</h2></div><dl>{outputRows.map(([icon, label, value]) => <div key={label}><dt><span aria-hidden="true">{icon}</span>{label}</dt><dd>{value}</dd></div>)}</dl></section>
        </aside>
      </form>
    </main>
  );
};
