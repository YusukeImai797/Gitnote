"use client";

import { useState, useRef, useCallback } from "react";

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}

export default function ImageUploadModal({ isOpen, onClose, onSubmit }: ImageUploadModalProps) {
  const [mode, setMode] = useState<'url' | 'upload'>('upload');
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    selectedFileRef.current = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleUpload = useCallback(async () => {
    const file = selectedFileRef.current;
    if (!file) return;

    setUploading(true);

    try {
      // Resize image if too large
      const resizedBlob = await resizeImage(file, 1920, 1920);

      const formData = new FormData();
      formData.append('image', resizedBlob, file.name);

      const response = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      onSubmit(data.url);
      handleClose();
    } catch (error) {
      console.error('Upload error:', error);
      alert('画像のアップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  }, [onSubmit]);

  const handleUrlSubmit = useCallback(() => {
    if (url.trim()) {
      onSubmit(url.trim());
      handleClose();
    }
  }, [url, onSubmit]);

  const handleClose = useCallback(() => {
    setUrl('');
    setPreview(null);
    selectedFileRef.current = null;
    setMode('upload');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={handleClose} />
      <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-4">
        <div className="bg-card rounded-2xl p-6 shadow-xl border border-border">
          <h3 className="text-lg font-bold mb-4">画像を挿入</h3>

          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMode('upload')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === 'upload'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-subtle text-muted-foreground hover:bg-muted'
              }`}
            >
              アップロード
            </button>
            <button
              onClick={() => setMode('url')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === 'url'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-subtle text-muted-foreground hover:bg-muted'
              }`}
            >
              URL
            </button>
          </div>

          {mode === 'upload' ? (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />

              {preview ? (
                <div className="space-y-3">
                  <div className="relative aspect-video bg-muted rounded-xl overflow-hidden">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-2 rounded-lg bg-subtle hover:bg-muted text-sm"
                  >
                    別の画像を選択
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-border bg-subtle/50 hover:bg-subtle transition-colors flex flex-col items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-3xl text-muted-foreground">
                      image
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ギャラリーから選択 / 撮影
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full px-4 py-3 rounded-xl border border-border bg-subtle/50 outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          <div className="flex gap-3 justify-end mt-6">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-muted-foreground hover:bg-subtle"
              disabled={uploading}
            >
              キャンセル
            </button>
            <button
              onClick={mode === 'upload' ? handleUpload : handleUrlSubmit}
              disabled={uploading || (mode === 'upload' && !preview) || (mode === 'url' && !url)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'アップロード中...' : '挿入'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Helper function to resize image
async function resizeImage(file: File, maxWidth: number, maxHeight: number): Promise<Blob> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          resolve(blob || file);
        }, file.type, 0.9);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
