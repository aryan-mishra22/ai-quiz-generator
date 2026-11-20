import { FileText, MoreHorizontal, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, PageHeading, SectionHeader } from '../components/common.jsx';
import FileUpload from '../components/documents/FileUpload.jsx';
import { formatDate } from '../services/demoService.js';

export default function PDFLibrary({ documents, onUpload, onDelete }) {
  const [query, setQuery] = useState('');
  const visibleDocuments = useMemo(
    () => documents.filter((document) => document.name.toLowerCase().includes(query.toLowerCase())),
    [documents, query],
  );

  const confirmDelete = (document) => {
    if (window.confirm(`Delete “${document.name}” from your library?`)) onDelete(document.id);
  };

  return (
    <>
      <PageHeading
        eyebrow="YOUR STUDY MATERIALS"
        title="PDF library"
        description="Keep your learning resources organized in one place."
        action={<button className="button primary" onClick={() => document.getElementById('pdf-library-upload')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><FileText size={16} /> Upload PDF</button>}
      />
      <section className="panel upload-panel" id="pdf-library-upload">
        <SectionHeader title="Add a study document" subtitle="Upload a PDF to keep it ready for your next quiz." />
        <FileUpload compact onFileSelected={onUpload} />
        <p className="upload-disclaimer">Demo mode: files are represented with sample metadata. No document text is processed.</p>
      </section>
      <section className="panel documents-panel">
        <div className="library-section-heading">
          <SectionHeader title="Your documents" subtitle={`${documents.length} ${documents.length === 1 ? 'document' : 'documents'} in your library`} />
          <label className="search-field document-search">
            <Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents…" aria-label="Search documents" />
          </label>
        </div>
        {visibleDocuments.length ? (
          <div className="document-grid">
            {visibleDocuments.map((item, index) => (
              <article className="document-card" key={item.id}>
                <div className={`document-cover cover-${index % 3}`}>
                  <span className="pdf-label">PDF</span>
                  <FileText size={32} strokeWidth={1.4} />
                  <span className="cover-lines"><i /><i /><i /></span>
                  <button className="document-menu" aria-label={`Delete ${item.name}`} onClick={() => confirmDelete(item)}><MoreHorizontal size={18} /></button>
                </div>
                <div className="document-card-body">
                  <h3 title={item.name}>{item.name}</h3>
                  <div className="document-details"><span>{item.size}</span><i /> <span>{item.pages} pages</span></div>
                  <div className="document-card-footer">
                    <span>Added {formatDate(item.uploadedAt)}</span>
                    <button className="icon-button danger-hover" aria-label={`Delete ${item.name}`} onClick={() => confirmDelete(item)}><Trash2 size={15} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title={documents.length ? 'No documents found' : 'Your library is empty'}
            description={documents.length ? 'Try searching for a different file name.' : 'Upload a PDF to start building your study library.'}
          />
        )}
      </section>
    </>
  );
}
