import React, { useState, useEffect } from 'react';

interface ImageUploadProgressProps {
  isUploading: boolean;
  uploadProgress: number;
  optimizationStatus: 'idle' | 'processing' | 'completed' | 'error';
  optimizedImages?: any;
  onComplete?: () => void;
}

const ImageUploadProgress: React.FC<ImageUploadProgressProps> = ({
  isUploading,
  uploadProgress,
  optimizationStatus,
  optimizedImages,
  onComplete
}) => {
  const [showSuccess, setShowSuccess] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState(0);

  // Simulate optimization progress
  useEffect(() => {
    if (optimizationStatus === 'processing') {
      const interval = setInterval(() => {
        setOptimizationProgress(prev => {
          if (prev >= 90) return 90;
          return prev + Math.random() * 15;
        });
      }, 200);
      return () => clearInterval(interval);
    } else if (optimizationStatus === 'completed') {
      setOptimizationProgress(100);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onComplete?.();
      }, 3000);
    }
  }, [optimizationStatus, onComplete]);

  if (!isUploading && optimizationStatus === 'idle') {
    return null;
  }

  const getStatusText = () => {
    if (isUploading) return 'Uploading image...';
    if (optimizationStatus === 'processing') return 'Optimizing image...';
    if (optimizationStatus === 'completed') return 'Image optimization completed!';
    if (optimizationStatus === 'error') return 'Optimization failed';
    return '';
  };

  const getProgressValue = () => {
    if (isUploading) return uploadProgress;
    if (optimizationStatus === 'processing') return optimizationProgress;
    if (optimizationStatus === 'completed') return 100;
    return 0;
  };

  const getProgressColor = () => {
    if (optimizationStatus === 'error') return 'bg-red-500';
    if (optimizationStatus === 'completed') return 'bg-green-500';
    return 'bg-blue-500';
  };

  const getOptimizationStats = () => {
    if (!optimizedImages) return null;
    
    const stats = Object.values(optimizedImages).flatMap((field: any) => 
      Object.values(field).filter((item: any) => item.savings > 0)
    );
    
    if (stats.length === 0) return null;
    
    const totalSavings = stats.reduce((sum: number, item: any) => sum + parseFloat(item.savings), 0);
    const avgSavings = (totalSavings / stats.length).toFixed(1);
    
    return (
      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center text-green-800">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="font-semibold">Optimization Results</span>
        </div>
        <div className="mt-2 text-sm text-green-700">
          <p>• Created {stats.length} optimized versions</p>
          <p>• Average compression: {avgSavings}% smaller</p>
          <p>• WebP versions for modern browsers</p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed top-4 right-4 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Image Processing
          </h3>
          {optimizationStatus === 'completed' && (
            <button
              onClick={() => setShowSuccess(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-4">
        <div className="mb-3">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>{getStatusText()}</span>
            <span>{Math.round(getProgressValue())}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ease-out ${getProgressColor()}`}
              style={{ width: `${getProgressValue()}%` }}
            />
          </div>
        </div>

        {/* Status Icons */}
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              isUploading ? 'bg-blue-500' : 'bg-green-500'
            }`} />
            <span className={isUploading ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}>
              Upload {isUploading ? 'in progress' : 'complete'}
            </span>
          </div>
          
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              optimizationStatus === 'idle' ? 'bg-gray-300' :
              optimizationStatus === 'processing' ? 'bg-yellow-500' :
              optimizationStatus === 'completed' ? 'bg-green-500' :
              'bg-red-500'
            }`} />
            <span className={
              optimizationStatus === 'idle' ? 'text-gray-500' :
              optimizationStatus === 'processing' ? 'text-yellow-600 dark:text-yellow-400' :
              optimizationStatus === 'completed' ? 'text-green-600 dark:text-green-400' :
              'text-red-600 dark:text-red-400'
            }>
              Optimization {optimizationStatus === 'idle' ? 'pending' : optimizationStatus}
            </span>
          </div>
        </div>

        {/* Optimization Results */}
        {getOptimizationStats()}
      </div>

      {/* Success Notification */}
      {showSuccess && (
        <div className="px-4 py-3 bg-green-50 border-t border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <div className="flex items-center text-green-800 dark:text-green-200">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Image successfully compressed!</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploadProgress;







