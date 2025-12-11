# Video Compression Instructions

Your video file `1118.mp4` is currently **5.26 MB** and needs to be compressed for web use.

## Option 1: Install FFmpeg (Recommended)

### Quick Install (if you have admin rights):
```powershell
choco install ffmpeg -y
```

### Manual Install:
1. Download FFmpeg from: https://www.gyan.dev/ffmpeg/builds/
2. Extract to `C:\ffmpeg`
3. Add `C:\ffmpeg\bin` to your PATH environment variable

### Then run this command:
```bash
cd public
ffmpeg -i 1118.mp4 -vcodec h264 -crf 32 -preset slow -vf "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease" -movflags +faststart -an -y 1118-compressed.mp4
```

This should reduce the file to **~200-500 KB** (90%+ reduction).

## Option 2: Use Online Tool (Easiest)

1. Go to: https://www.freeconvert.com/video-compressor
2. Upload `public/1118.mp4`
3. Set quality to "Medium" or "Low"
4. Download the compressed file
5. Replace the original

## Option 3: Use HandBrake (GUI Tool)

1. Download: https://handbrake.fr/
2. Open `1118.mp4`
3. Preset: "Fast 480p30" or "Fast 720p30"
4. Check "Web Optimized"
5. Uncheck "Audio" (if not needed)
6. Encode and replace original

## Compression Settings Explained

- **-crf 32**: Higher compression (lower quality, smaller file)
  - Try 28 for better quality, 35 for smaller file
- **-vf scale='min(512,iw)'**: Limits width to 512px max
- **-an**: Removes audio (saves space for loading animations)
- **-movflags +faststart**: Optimizes for web streaming

## Expected Results

- **Original**: 5.26 MB
- **Compressed**: ~200-500 KB (90%+ reduction)
- **Quality**: Still good for loading animation


