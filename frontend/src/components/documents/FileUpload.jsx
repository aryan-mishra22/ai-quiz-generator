import { useRef, useState } from 'react';
import { CheckCircle2, FileText, FileUp, LoaderCircle, Trash2 } from 'lucide-react';
import { formatFileSize } from '../../services/formatters.js';

export default function FileUpload({ onFileSelected, compact = false }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const processFile = async (file) => {
    setError('');
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('That file is larger than 25 MB. Choose a smaller PDF.');
      return;
    }

    setSelectedFile(file);
    setUploading(true);
    setProcessing(false);
    try {
      const result = await onFileSelected(file);
      if (result?.processingStatus === 'failed') {
        setSelectedFile(null);
        setError(result.processingError || 'No readable text found. This looks like a scanned PDF.');
        if (inputRef.current) inputRef.current.value = '';
      } else if (result?.processingStatus === 'processing') {
        setProcessing(true);
      }
    } catch (uploadError) {
      setSelectedFile(null);
      setError(uploadError.message || 'The PDF could not be uploaded.');
      if (inputRef.current) inputRef.current.value = '';
    } finally {
      setUploading(false);
    }
  };

  const clearFile = (event) => {
    event.stopPropagation();
    if (uploading) return;
    setUploading(false);
    setProcessing(false);
    setSelectedFile(null);
    setError('');
    onFileSelected(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <div
        className={`upload-zone ${compact ? 'compact' : ''} ${dragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => !selectedFile && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !selectedFile) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={async (event) => {
          event.preventDefault();
          setDragging(false);
          await processFile(event.dataTransfer.files[0]);
        }}
        aria-label="Upload a PDF document"
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(event) => { void processFile(event.target.files[0]); }}
        />
        {selectedFile ? (
          <div className="selected-file-row">
            <span className="file-icon large"><FileText size={20} /></span>
            <span className="selected-file-copy">
              <strong>{selectedFile.name}</strong>
              <small>{uploading ? 'Uploading…' : processing ? 'Processing in your library…' : `${formatFileSize(selectedFile.size)} · PDF document`}</small>
            </span>
            {(uploading || processing) ? <LoaderCircle className="spin" size={19} /> : <CheckCircle2 className="success-icon" size={19} />}
            <button
              type="button"
              className="remove-file"
              aria-label="Remove selected file"
              onClick={clearFile}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <>
            <span className="upload-icon"><FileUp size={21} /></span>
            <strong>Drop your PDF here, or <span>browse files</span></strong>
            <small>PDF only · Up to 25 MB</small>
          </>
        )}
      </div>
      {error && <div className="field-error" role="alert">{error}</div>}
    </div>
  );
}
