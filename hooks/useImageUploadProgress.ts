import { useState, useCallback } from 'react';

interface UseImageUploadProgressReturn {
  isUploading: boolean;
  uploadProgress: number;
  optimizationStatus: 'idle' | 'processing' | 'completed' | 'error';
  optimizedImages: any;
  startUpload: () => void;
  updateUploadProgress: (progress: number) => void;
  completeUpload: () => void;
  startOptimization: () => void;
  completeOptimization: (results: any) => void;
  setOptimizationError: () => void;
  reset: () => void;
}

export const useImageUploadProgress = (): UseImageUploadProgressReturn => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [optimizationStatus, setOptimizationStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [optimizedImages, setOptimizedImages] = useState<any>(null);

  const startUpload = useCallback(() => {
    setIsUploading(true);
    setUploadProgress(0);
    setOptimizationStatus('idle');
    setOptimizedImages(null);
  }, []);

  const updateUploadProgress = useCallback((progress: number) => {
    setUploadProgress(Math.min(progress, 100));
  }, []);

  const completeUpload = useCallback(() => {
    setIsUploading(false);
    setUploadProgress(100);
  }, []);

  const startOptimization = useCallback(() => {
    setOptimizationStatus('processing');
  }, []);

  const completeOptimization = useCallback((results: any) => {
    setOptimizationStatus('completed');
    setOptimizedImages(results);
  }, []);

  const setOptimizationError = useCallback(() => {
    setOptimizationStatus('error');
  }, []);

  const reset = useCallback(() => {
    setIsUploading(false);
    setUploadProgress(0);
    setOptimizationStatus('idle');
    setOptimizedImages(null);
  }, []);

  return {
    isUploading,
    uploadProgress,
    optimizationStatus,
    optimizedImages,
    startUpload,
    updateUploadProgress,
    completeUpload,
    startOptimization,
    completeOptimization,
    setOptimizationError,
    reset
  };
};







