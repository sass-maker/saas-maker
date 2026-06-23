import React, { useCallback, useRef, useState } from 'react';
import type { ApiClient } from '../api';

interface ImageUploadProps {
  api: ApiClient;
  imageUrl: string | null;
  onImageUrl: (url: string | null) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const UploadIcon: React.FC = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const CloseIcon: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const ImageUpload: React.FC<ImageUploadProps> = ({ api, imageUrl, onImageUrl }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Only JPEG, PNG, GIF, and WebP images are allowed.';
    }
    if (file.size > MAX_SIZE) {
      return 'Image must be less than 5MB.';
    }
    return null;
  };

  const uploadFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      setUploading(true);
      setProgress(0);

      // Simulate progress since fetch doesn't support upload progress natively
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 15, 90));
      }, 200);

      try {
        const result = await api.uploadImage(file);
        setProgress(100);
        onImageUrl(result.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      } finally {
        clearInterval(progressInterval);
        setUploading(false);
        setProgress(0);
      }
    },
    [api, onImageUrl, validateFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = '';
    },
    [uploadFile]
  );

  const handleRemove = useCallback(() => {
    onImageUrl(null);
    setError(null);
  }, [onImageUrl]);

  if (imageUrl) {
    return (
      <div className="smw-image-upload__preview">
        <img src={imageUrl} alt="Uploaded" className="smw-image-upload__img" />
        <button
          type="button"
          className="smw-image-upload__remove"
          onClick={handleRemove}
          aria-label="Remove image"
        >
          <CloseIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="smw-image-upload">
      <div
        className={`smw-image-upload__dropzone ${dragging ? 'smw-image-upload__dropzone--active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.webp"
          onChange={handleFileSelect}
          className="smw-image-upload__input"
          tabIndex={-1}
        />
        {uploading ? (
          <div className="smw-image-upload__progress">
            <div className="smw-image-upload__progress-bar" style={{ width: `${progress}%` }} />
            <span className="smw-image-upload__progress-text">Uploading... {progress}%</span>
          </div>
        ) : (
          <>
            <UploadIcon />
            <span className="smw-image-upload__label">Drop an image here or click to upload</span>
            <span className="smw-image-upload__hint">JPEG, PNG, GIF, WebP (max 5MB)</span>
          </>
        )}
      </div>
      {error && <p className="smw-image-upload__error">{error}</p>}
    </div>
  );
};
