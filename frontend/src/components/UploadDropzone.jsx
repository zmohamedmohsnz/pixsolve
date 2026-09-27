import { useRef, useState } from 'react';

export const UploadDropzone = ({ file, onFile, error }) => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const selectFile = candidate => {
    if (candidate) onFile(candidate);
  };

  return (
    <section
      className={`upload-panel panel pixel-corners ${isDragging ? 'is-dragging' : ''}`}
      onDragEnter={event => { event.preventDefault(); setIsDragging(true); }}
      onDragOver={event => event.preventDefault()}
      onDragLeave={event => { if (event.currentTarget === event.target) setIsDragging(false); }}
      onDrop={event => { event.preventDefault(); setIsDragging(false); selectFile(event.dataTransfer.files[0]); }}
    >
      <div className="grid-overlay" aria-hidden="true" />
      <span className="upload-corner corner-top-left" aria-hidden="true" />
      <span className="upload-corner corner-top-right" aria-hidden="true" />
      <span className="upload-corner corner-bottom-left" aria-hidden="true" />
      <span className="upload-corner corner-bottom-right" aria-hidden="true" />
      <div className="upload-icon" aria-hidden="true">↑</div>
      <h2>{file ? 'Replace your image' : 'Drop your image here'}</h2>
      <p>or</p>
      <button className="browse-button pixel-corners" type="button" onClick={() => inputRef.current?.click()}>Browse image</button>
      <input
        ref={inputRef}
        id="image"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={event => selectFile(event.target.files[0])}
        hidden
      />
      <div className="file-types">PNG <i /> JPEG <i /> WebP</div>
      <small>Max file size: 5 MiB</small>
      {error && <p className="field-error" role="alert">{error}</p>}
    </section>
  );
};
