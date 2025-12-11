import React, { useState } from 'react';
import { PlaceCategory } from '../types';
import { getApiBaseUrl } from '../services/config';

interface Theme {
  theme: 'light' | 'dark';
}

interface UserAlarmModalProps {
  isOpen: boolean;
  onClose: () => void;
  coordinates: { lat: number; lng: number };
  onCreateAlarm: (alarmData: any) => void;
  isAuthenticated: boolean;
  theme?: 'light' | 'dark';
  userEmail?: string;
  username?: string;
}

const ALARM_TYPES = [
  { type: 'jellyfish', icon: '🪼', label: 'Jellyfish Alert', color: '#F59E0B' },
  { type: 'shark', icon: '🦈', label: 'Shark Alert', color: '#EF4444' },
  { type: 'storm', icon: '⛈️', label: 'Storm Warning', color: '#8B4513' },
  { type: 'current', icon: '🌊', label: 'Strong Current', color: '#3B82F6' },
  { type: 'pollution', icon: '☢️', label: 'Water Pollution', color: '#10B981' },
  { type: 'roadblock', icon: '🚧', label: 'Road Block', color: '#6B7280' },
  { type: 'custom', icon: '⚠️', label: 'Custom Alert', color: '#9333EA' }
];

// Categorized icons for better organization
const ICON_CATEGORIES = {
  hazards: {
    label: 'Hazards & Safety',
    icons: [
      '🚨', '⚠️', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪',
      '🚫', '⛔', '🛑', '🔒', '🔓', '💥', '💢', '❌', '✅',
      '🔥', '💧', '❄️', '🌪️', '⚡', '🌋', '🏔️', '🌊', '🌀',
      '🚧', '🚩', '🏴', '🔔', '📢', '📣', '📯',
      '💀', '☠️', '🦴', '🧨', '💣', '🔪', '⚔️', '🛡️', '🏹', '🔫',
      '🦈', '🪼', '🐍', '🦂', '🐝', '🕷️', '🦟', '🪰', '🦠', '☣️'
    ]
  },
  tourism: {
    label: 'Tourism & Activities',
    icons: [
      '🎭', '🎪', '🎨', '🎬', '🎵', '🎶', '🎸', '🎹', '🎺', '🎻',
      '🏆', '🏅', '🥇', '🥈', '🥉', '🎯', '🎲', '🃏', '🎴', '🎰',
      '🏛️', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '🎪', '🎭', '🎨',
      '📸', '📷', '📹', '🎥', '🎬', '📺', '📻', '🎙️', '🎚️', '🎛️',
      '🏖️', '🏝️', '🏔️', '⛰️', '🌋', '🗻', '🏕️', '🏞️', '🌅', '🌄',
      '🌊', '🏄‍♂️', '🏄‍♀️', '🏊‍♂️', '🏊‍♀️', '🤽‍♂️', '🤽‍♀️', '🚣‍♂️', '🚣‍♀️', '🏇'
    ]
  },
  restaurants: {
    label: 'Food & Dining',
    icons: [
      '🍽️', '🍴', '🍸', '🍷', '🍹', '🍺', '🍻', '🥂', '🥃', '🍾',
      '🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥙', '🥗', '🥘',
      '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '🍥', '🍡',
      '🍢', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍮',
      '☕', '🍵', '🥤', '🧃', '🧉', '🧊', '🍯', '🥛', '🍼', '🍶',
      '🏪', '🏬', '🏭', '🏮', '🕯️', '💡', '🔦', '🕯️', '🪔', '🕯️'
    ]
  }
};

// Flatten all icons for backward compatibility
const CUSTOM_ICONS = [
  ...ICON_CATEGORIES.hazards.icons,
  ...ICON_CATEGORIES.tourism.icons,
  ...ICON_CATEGORIES.restaurants.icons
];

const SEVERITY_LEVELS = [
  { value: 'low', label: 'Low', color: '#10B981' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high', label: 'High', color: '#EF4444' },
  { value: 'critical', label: 'Critical', color: '#DC2626' }
];

const UserAlarmModal: React.FC<UserAlarmModalProps> = ({
  isOpen,
  onClose,
  coordinates,
  onCreateAlarm,
  isAuthenticated,
  theme = 'dark',
  userEmail,
  username
}) => {
  // Helper function to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Add CSS animations and severity styles
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { 
          opacity: 0;
          transform: translateY(20px);
        }
        to { 
          opacity: 1;
          transform: translateY(0);
        }
      }
      .severity-low { 
        background-color: rgba(16, 185, 129, 0.2) !important; 
        border-color: #10B981 !important; 
      }
      .severity-medium { 
        background-color: rgba(245, 158, 11, 0.2) !important; 
        border-color: #F59E0B !important; 
      }
      .severity-high { 
        background-color: rgba(239, 68, 68, 0.2) !important; 
        border-color: #EF4444 !important; 
      }
      .severity-critical { 
        background-color: rgba(220, 38, 38, 0.2) !important; 
        border-color: #DC2626 !important; 
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  const [selectedType, setSelectedType] = useState<string>('jellyfish');
  const [selectedCustomIcon, setSelectedCustomIcon] = useState<string>('⚠️');
  const [selectedIconCategory, setSelectedIconCategory] = useState<string>('hazards');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [severity, setSeverity] = useState<string>('medium');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);

  // Debug logging
  React.useEffect(() => {
    console.log('UserAlarmModal - Current state:', { selectedType, severity });
    console.log('UserAlarmModal - CSS classes should be:', `severity-${severity}`);
    
    // Check if any alert type is selected and log the expected styles
    if (selectedType) {
      const expectedStyle = severity === 'low' ? 'rgba(16, 185, 129, 0.3)' : 
                           severity === 'medium' ? 'rgba(245, 158, 11, 0.3)' :
                           severity === 'high' ? 'rgba(239, 68, 68, 0.3)' :
                           severity === 'critical' ? 'rgba(220, 38, 38, 0.3)' :
                           'rgba(255, 255, 255, 0.2)';
      console.log('UserAlarmModal - Expected background color:', expectedStyle);
    }
  }, [selectedType, severity]);

  if (!isOpen) return null;

  const selectedAlarmType = ALARM_TYPES.find(type => type.type === selectedType);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image file size must be less than 5MB');
        return;
      }
      
      setSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setIsUploadingImage(true);
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch(`${getApiBaseUrl()}/api/user-alarms/upload-image`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        return result.imageUrl;
      } else {
        throw new Error('Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      alert('Please enter a title for the alarm');
      return;
    }

    let imageUrl = '';
    
    // Upload image if selected
    if (selectedImage) {
      const uploadedImageUrl = await uploadImage(selectedImage);
      if (uploadedImageUrl) {
        imageUrl = uploadedImageUrl;
      } else {
        alert('Failed to upload image. Please try again.');
        return;
      }
    }

    const alarmData = {
      id: `user_alarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: selectedType,
      title: title.trim(),
      description: description.trim(),
      coordinates,
      severity,
      icon: selectedType === 'custom' ? selectedCustomIcon : (selectedAlarmType?.icon || '⚠️'),
      color: severity === 'low' ? '#10B981' : 
             severity === 'medium' ? '#F59E0B' :
             severity === 'high' ? '#EA580C' :
             severity === 'critical' ? '#DC2626' :
             '#9333EA',
      imageUrl: imageUrl,
      isActive: true,
      createdBy: 'user', // Will be replaced with actual user ID
      createdByUsername: username || 'anonymous',
      createdByEmail: userEmail || 'anonymous',
      createdAt: new Date().toISOString()
    };

    onCreateAlarm(alarmData);
    onClose();
    
    // Reset form
    setTitle('');
    setDescription('');
    setSeverity('medium');
    setSelectedType('jellyfish');
    setSelectedCustomIcon('⚠️');
    setSelectedIconCategory('hazards');
    setSelectedImage(null);
    setImagePreview('');
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className={`rounded-lg shadow-xl max-w-md w-full p-6 ${
          theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900'
        }`}>
          <div className="text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className={`text-xl font-bold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Authentication Required
            </h2>
            <p className={`mb-6 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              You need to be logged in to create community safety alerts.
            </p>
            <button
              onClick={onClose}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ animation: 'slideUp 0.3s ease-out' }}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white drop-shadow-lg flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white shadow-lg">
                🚨
              </div>
              Create Safety Alert
            </h2>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white hover:text-red-300 transition-all duration-300 hover:scale-110"
            >
              ×
            </button>
          </div>

          <div className="mb-4 p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
            <p className="text-sm text-white/90 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs">
                📍
              </div>
              <strong>Location:</strong> {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
            </p>
          </div>

          {/* Welcome Message */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/20">
          <div className="text-sm leading-relaxed text-white/90 mb-3">
            <strong className="text-white">Hi {username || 'User'},</strong><br />
            Here you can create alerts for other users if you experienced something, everybody should know about.
          </div>
          <div className="text-xs text-white/70 bg-white/10 rounded-xl p-2 border border-white/10">
            ⚠️ Make sure you don't make false reports and please note that your username will be shown on the alarm.
          </div>
        </div>

          <form onSubmit={handleSubmit}>
            {/* Alarm Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-3 text-white/90">
                Alert Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                {ALARM_TYPES.map((alarmType) => (
                  <button
                    key={alarmType.type}
                    type="button"
                    onClick={() => setSelectedType(alarmType.type)}
                    className={`p-3 rounded-2xl border-2 transition-all duration-300 backdrop-blur-sm ${
                      selectedType === alarmType.type
                        ? 'shadow-lg scale-105'
                        : 'border-white/20 hover:border-white/30 hover:bg-white/15 hover:scale-102'
                    }`}
                    style={selectedType === alarmType.type ? {
                      backgroundColor: severity === 'low' ? 'rgba(16, 185, 129, 0.3)' : 
                                     severity === 'medium' ? 'rgba(245, 158, 11, 0.3)' :
                                     severity === 'high' ? 'rgba(234, 88, 12, 0.3)' :
                                     severity === 'critical' ? 'rgba(220, 38, 38, 0.3)' :
                                     'rgba(255, 255, 255, 0.2)',
                      borderColor: severity === 'low' ? '#10B981' : 
                                  severity === 'medium' ? '#F59E0B' :
                                  severity === 'high' ? '#EA580C' :
                                  severity === 'critical' ? '#DC2626' :
                                  '#3b82f6'
                    } : {}}
                  >
                    <div className="text-2xl mb-2">{alarmType.icon}</div>
                    <div className="text-xs font-semibold text-white">
                      {alarmType.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Icon Selection - Show only when Custom Alert is selected */}
            {selectedType === 'custom' && (
              <div className="mb-6">
                <label className="block text-sm font-medium mb-3 text-white/90">
                  Choose Icon Category & Icon
                </label>
                
                {/* Category Selection */}
                <div className="mb-4">
                  <div className="flex gap-2 mb-3">
                    {Object.entries(ICON_CATEGORIES).map(([key, category]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedIconCategory(key)}
                        className={`px-3 py-2 rounded-xl border-2 transition-all duration-300 backdrop-blur-sm text-sm font-medium ${
                          selectedIconCategory === key
                            ? 'border-white/50 bg-white/25 shadow-lg'
                            : 'border-white/20 bg-white/10 hover:border-white/40 hover:bg-white/20'
                        }`}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Icon Selection */}
                <div className="grid grid-cols-8 gap-2 max-h-48 overflow-y-auto p-3 bg-white/5 rounded-2xl border border-white/10">
                  {ICON_CATEGORIES[selectedIconCategory as keyof typeof ICON_CATEGORIES].icons.map((icon, index) => (
                    <button
                      key={`${selectedIconCategory}-icon-${index}`}
                      type="button"
                      onClick={() => setSelectedCustomIcon(icon)}
                      className={`p-2 rounded-xl border-2 transition-all duration-300 text-lg backdrop-blur-sm flex items-center justify-center ${
                        selectedCustomIcon === icon
                          ? 'border-white/50 bg-white/25 shadow-lg scale-110'
                          : 'border-white/20 bg-white/10 hover:border-white/40 hover:bg-white/20 hover:scale-105'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                
                {/* Selected Icon Preview */}
                <div className="mt-3 p-3 bg-white/10 rounded-xl border border-white/20">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{selectedCustomIcon}</span>
                    <span className="text-sm text-white/90">
                      Selected: {ICON_CATEGORIES[selectedIconCategory as keyof typeof ICON_CATEGORIES].label}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Title Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-white/90">
                Alert Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Large jellyfish spotted near shore"
                className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 text-white placeholder-white/50 transition-all duration-300"
                required
              />
            </div>

            {/* Description Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-white/90">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide more details about the danger..."
                rows={3}
                className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 text-white placeholder-white/50 resize-none transition-all duration-300"
              />
            </div>

            {/* Image Upload */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-white/90">
                📸 Upload Photo (Optional)
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="alarm-image-upload"
                />
                <label
                  htmlFor="alarm-image-upload"
                  className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 text-white cursor-pointer transition-all duration-300 hover:bg-white/15 flex items-center justify-center gap-2"
                >
                  📷 Choose Image
                </label>
              </div>
              
              {/* Image Preview */}
              {imagePreview && (
                <div className="mt-3">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full max-w-xs mx-auto rounded-xl border border-white/20"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview('');
                    }}
                    className="mt-2 text-xs text-red-400 hover:text-red-300"
                  >
                    Remove Image
                  </button>
                </div>
              )}
            </div>

            {/* Severity Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-3 text-white/90">
                Severity Level
              </label>
              <div className="flex gap-2 justify-center">
                {SEVERITY_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setSeverity(level.value)}
                    className={`py-2 px-3 rounded-xl border-2 transition-all duration-300 backdrop-blur-sm ${
                      severity === level.value
                        ? 'border-white/50 shadow-lg scale-105'
                        : 'border-white/20 hover:border-white/40 hover:scale-102'
                    }`}
                    style={{
                      backgroundColor: severity === level.value ? `${level.color}30` : 'rgba(255, 255, 255, 0.1)',
                      borderColor: severity === level.value ? level.color : 'rgba(255, 255, 255, 0.2)'
                    }}
                  >
                    <div className="text-xs font-semibold text-white flex items-center justify-center gap-1">
                      <span style={{ color: level.color }}>
                        {level.value === 'low' ? '🟢' : level.value === 'medium' ? '🟡' : level.value === 'high' ? '🟠' : '🔴'}
                      </span>
                      {level.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-2xl hover:bg-white/20 hover:border-white/30 transition-all duration-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 px-4 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-2xl hover:from-red-600 hover:to-orange-600 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl hover:scale-105"
              >
                🚨 Create Alert
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserAlarmModal;
