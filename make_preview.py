from PIL import Image

# Target: standard OG image size (wider, less tall)
TARGET_W, TARGET_H = 1200, 630

# Background colour sampled from logo.png (dark green)
BG_COLOR = (42, 78, 60, 255)

# Load source logo
src = Image.open(r'C:/Users/User/Occurd/logo.png').convert('RGBA')
src_w, src_h = src.size  # 1774 x 887

# Scale so width fits TARGET_W with some side padding
SIDE_PAD = 80  # px each side
avail_w = TARGET_W - SIDE_PAD * 2
scale = avail_w / src_w
new_w = int(src_w * scale)
new_h = int(src_h * scale)

src_scaled = src.resize((new_w, new_h), Image.LANCZOS)

# Create canvas
canvas = Image.new('RGBA', (TARGET_W, TARGET_H), BG_COLOR)

# Paste centred vertically
x = (TARGET_W - new_w) // 2
y = (TARGET_H - new_h) // 2
canvas.paste(src_scaled, (x, y), src_scaled)

out = r'C:/Users/User/Occurd/social-preview.png'
canvas.convert('RGB').save(out, 'PNG', optimize=True)
print(f'Saved {out}  ({TARGET_W}x{TARGET_H})')

# Show resulting scale info
print(f'Logo scaled to {new_w}x{new_h}, pasted at ({x},{y})')
